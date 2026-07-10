# HybridCache (.NET 9+, stable in .NET 10)

`Microsoft.Extensions.Caching.Hybrid` (NuGet package) is the modern, two-tier cache (L1 + optional L2) that became stable in .NET 10. It combines:

- **L1**: in-process `IMemoryCache` (fast, per-instance)
- **L2**: distributed cache (Redis, SQL Server, Cosmos, etc.) — optional
- **Stampede protection** (only one caller populates the cache for a given key)
- **Tag-based invalidation** for efficient bulk removal
- **Generic `GetOrCreateAsync<T>`** — no need to handle `byte[]`/`string` yourself

Prefer `HybridCache` over raw `IMemoryCache` for read-heavy services.

---

## Registration

```csharp
// L1 only (in-process) — simplest, single-instance apps
builder.Services.AddHybridCache();

// L1 + L2 (Redis)
builder.Services.AddStackExchangeRedisCache(o =>
    o.Configuration = builder.Configuration.GetConnectionString("Redis")!);

builder.Services.AddHybridCache(options =>
{
    options.DefaultExpiration = TimeSpan.FromMinutes(5);
    options.MaximumPayloadBytes = 1024 * 1024;          // 1 MB
    options.MaximumKeyLength = 512;
});

// L1 + L2 (SQL Server)
builder.Services.AddDistributedSqlServerCache(o =>
{
    o.ConnectionString = builder.Configuration.GetConnectionString("Default")!;
    o.SchemaName = "dbo";
    o.TableName = "Cache";
});
builder.Services.AddHybridCache();
```

---

## `GetOrCreateAsync<T>` — the main API

```csharp
public sealed class OrderService(
    HybridCache cache,
    IDbConnectionFactory<SqlConnection> connectionFactory,
    ILogger<OrderService> logger)
{
    public async ValueTask<OrderDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        return await cache.GetOrCreateAsync<OrderDto?>(
            key: $"order:{id}",
            factory: async token =>
            {
                logger.LogDebug("Cache miss for order {Id}", id);
                await using var conn = await connectionFactory.CreateConnectionAsync(token);
                return await conn.QueryFirstOrDefaultAsync<OrderDto>(
                    new CommandDefinition(
                        "SELECT Id, Code, Amount, Status FROM dbo.Orders WHERE Id = @Id",
                        new { Id = id },
                        cancellationToken: token));
            },
            options: new HybridCacheEntryOptions
            {
                Expiration = TimeSpan.FromMinutes(10),
                LocalCacheExpiration = TimeSpan.FromMinutes(2)
            },
            cancellationToken: ct);
    }
}
```

- `Expiration` → L2 (distributed)
- `LocalCacheExpiration` → L1 (in-process); default is min(Expiration, 2 min)
- The `factory` is **only called on cache miss**, and only **once per key** across all callers (stampede protection)

---

## Async Loading (`GetOrCreateAsync` is `ValueTask`)

HybridCache returns `ValueTask<T>` — it's often sync-completed when the value is already in L1. The signature is intentionally allocation-free for the hot path.

---

## Manual `Set` / `Remove`

```csharp
// Set without factory
await cache.SetAsync(
    key: $"order:{id}",
    value: dto,
    options: new HybridCacheEntryOptions { Expiration = TimeSpan.FromMinutes(5) },
    cancellationToken: ct);

// Remove single key
await cache.RemoveAsync($"order:{id}", cancellationToken: ct);
```

---

## Tag-Based Invalidation

Tag entries on write, remove all entries with a tag when the underlying data changes.

```csharp
// Write
await cache.SetAsync(
    key: $"order:{id}",
    value: dto,
    options: new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(10),
        Tags = new[] { "orders", $"customer:{dto.CustomerId}" }
    },
    cancellationToken: ct);
```

```csharp
// Invalidate all orders
await cache.RemoveByTagAsync("orders", cancellationToken: ct);

// Invalidate just one customer's orders
await cache.RemoveByTagAsync($"customer:{customerId}", cancellationToken: ct);
```

> Tags live in L2 only. On L1, removing a tag does not invalidate the local copy — use short `LocalCacheExpiration` for entries that need to react to tag changes quickly.

---

## Caching Lists / Collections

```csharp
public async ValueTask<IReadOnlyList<OrderDto>> GetRecentAsync(int take, CancellationToken ct = default)
{
    return await cache.GetOrCreateAsync<IReadOnlyList<OrderDto>>(
        key: $"orders:recent:{take}",
        factory: async token =>
        {
            await using var conn = await connectionFactory.CreateConnectionAsync(token);
            var rows = await conn.QueryAsync<OrderDto>(new CommandDefinition(
                """SELECT TOP(@Take) Id, Code, Amount, Status, Created
                   FROM dbo.Orders ORDER BY Created DESC""",
                new { Take = take },
                cancellationToken: token));
            return rows.AsList();
        },
        options: new HybridCacheEntryOptions { Expiration = TimeSpan.FromMinutes(2) },
        cancellationToken: ct)!;
}
```

> Cache the **materialized list** (`.AsList()`), not the lazy `IEnumerable`. The factory returns once; the cache stores the value, not a deferred query.

---

## Caching with `Result<T>`

If your service returns `Result<T>`, cache the `Result<T>` itself, not just the value:

```csharp
public async ValueTask<Result<OrderDto>> GetOrderResultAsync(int id, CancellationToken ct = default)
{
    return await cache.GetOrCreateAsync<Result<OrderDto>>(
        key: $"order:result:{id}",
        factory: async token =>
        {
            await using var conn = await connectionFactory.CreateConnectionAsync(token);
            var order = await conn.QueryFirstOrDefaultAsync<OrderDto>(/*...*/);
            return order is not null
                ? Result<OrderDto>.Success(order)
                : Result<OrderDto>.Failure("Order not found");
        },
        options: new HybridCacheEntryOptions { Expiration = TimeSpan.FromMinutes(10) },
        cancellationToken: ct);
}
```

This avoids hitting the DB just to learn "Order not found" repeatedly.

---

## When to Use What

| Need | Use |
|------|-----|
| In-process cache only (single instance) | `AddMemoryCache()` + `IMemoryCache` |
| L1 + L2, stampede protection, tags | **`HybridCache`** |
| Session-scoped state (per circuit) | Scoped service (not a cache) |
| Cross-circuit, short-lived state | Scoped service with short lifetime |
| Output caching (HTTP responses) | `AddOutputCache()` (different feature) |

---

## Anti-Patterns

```csharp
// ❌ WRONG — factory returns lazy IEnumerable
factory: async ct => conn.QueryAsync<Order>(sql)
// Cache stores the lazy enumerable; first enumeration re-runs the query

// ❌ WRONG — caching DbContext or change-tracked entity
factory: async ct => await ctx.Orders.FirstOrDefaultAsync(o => o.Id == id)
// DbContext dies, tracked entity is useless anyway

// ❌ WRONG — caching for too long when the source changes
Expiration = TimeSpan.FromDays(7)  // for a mutable record

// ❌ WRONG — cache key with user-controlled input (cache poisoning)
key: $"order:{Request.Query["id"]}"  // cross-tenant data leak

// ❌ WRONG — using HybridCache for a per-user feature flag stored in claims
// That belongs to AuthenticationState, not a distributed cache

// ❌ WRONG — wrapping GetOrCreateAsync in a try/catch that swallows errors
try { return await cache.GetOrCreateAsync(...); }
catch { /* fall through to DB */ }
// Silently bypassing the cache hides the real failure
```

---

## Quick Reference

| Task | API |
|------|-----|
| Get or compute | `cache.GetOrCreateAsync<T>(key, factory, options, ct)` |
| Set without factory | `cache.SetAsync(key, value, options, ct)` |
| Remove one key | `cache.RemoveAsync(key, ct)` |
| Invalidate by tag | `cache.RemoveByTagAsync(tag, ct)` |
| L1 only, no L2 | `AddHybridCache()` alone (no distributed) |
| L1 + L2 | Add a distributed cache (Redis/SQL/Cosmos) **then** `AddHybridCache()` |
| Default expiration | `HybridCacheOptions.DefaultExpiration` |
| Tag entries | `HybridCacheEntryOptions.Tags = new[] { "..." }` |
