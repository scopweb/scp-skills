# EF Core & Data Access Patterns

## IDbContextFactory (Required for Blazor Server)

Blazor Server circuits are long-lived. DbContext is NOT thread-safe. Always use the factory pattern.

```csharp
// ✅ Registration
builder.Services.AddDbContextFactory<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

// ✅ Service usage — create and dispose per operation
public sealed class OrderService(
    IDbContextFactory<AppDbContext> contextFactory,
    ILogger<OrderService> logger)
{
    public async Task<List<Order>> GetActiveAsync(CancellationToken ct = default)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        return await ctx.Orders
            .AsNoTracking()
            .Where(o => o.IsActive)
            .OrderByDescending(o => o.Created)
            .ToListAsync(ct);
    }

    public async Task<bool> UpdateStatusAsync(int id, OrderStatus status, CancellationToken ct = default)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var order = await ctx.Orders.FindAsync([id], ct);
        if (order is null) return false;

        order.Status = status;
        order.Modified = DateTime.UtcNow;
        await ctx.SaveChangesAsync(ct);
        return true;
    }
}
```

```csharp
// ❌ NEVER inject DbContext directly in Blazor Server components
@inject AppDbContext Context  // WRONG — shared across the circuit lifetime
```

---

## Query Optimization

### AsNoTracking for reads

```csharp
// ✅ Read-only queries — always AsNoTracking
var orders = await ctx.Orders
    .AsNoTracking()
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(ct);

// ✅ Global default for read-heavy contexts
ctx.ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
```

### Projections — select only what you need

```csharp
// ✅ Project to DTO
var summaries = await ctx.Orders
    .AsNoTracking()
    .Where(o => o.Year == 2026)
    .Select(o => new OrderSummary(o.Id, o.Code, o.Amount, o.Created))
    .ToListAsync(ct);

// ❌ Loading full entity when you only need 3 fields
var orders = await ctx.Orders.ToListAsync();
var codes = orders.Select(o => o.Code); // Loaded ALL columns for nothing
```

### Split Queries (avoid cartesian explosion)

```csharp
// ✅ When including multiple collections
var order = await ctx.Orders
    .AsSplitQuery()
    .Include(o => o.Items)
    .Include(o => o.Documents)
    .FirstOrDefaultAsync(o => o.Id == id, ct);
```

### Compiled Queries (hot paths)

```csharp
// ✅ For frequently executed queries
private static readonly Func<AppDbContext, int, CancellationToken, Task<Order?>> _getById =
    EF.CompileAsyncQuery((AppDbContext ctx, int id, CancellationToken ct) =>
        ctx.Orders.AsNoTracking().FirstOrDefault(o => o.Id == id));

public Task<Order?> GetByIdAsync(int id, CancellationToken ct)
    => _getById(ctx, id, ct);
```

### Pagination

```csharp
// ✅ Keyset pagination (better than Skip/Take for large datasets)
var nextPage = await ctx.Orders
    .AsNoTracking()
    .Where(o => o.Id > lastSeenId)
    .OrderBy(o => o.Id)
    .Take(pageSize)
    .ToListAsync(ct);

// ✅ Standard pagination (OK for small datasets)
var page = await ctx.Orders
    .AsNoTracking()
    .OrderByDescending(o => o.Created)
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync(ct);
```

---

## EF Core 10 Highlights

EF Core 10 ships alongside .NET 10 (EF Core 11 is expected Nov 2026). The most useful additions for this stack:

### Named query filters (multiple filters per entity)

```csharp
// ✅ Two independent global filters on the same entity
modelBuilder.Entity<Order>()
    .HasQueryFilter("SoftDelete", o => !o.IsDeleted)
    .HasQueryFilter("Tenant", o => o.TenantId == tenantProvider.TenantId);

// ✅ Disable only one filter for a specific query
var includingDeleted = await ctx.Orders
    .IgnoreQueryFilters(["SoftDelete"])   // tenant filter still applies
    .AsNoTracking()
    .ToListAsync(ct);
```

> Before EF Core 10 an entity could only have **one** query filter and `IgnoreQueryFilters()` was all-or-nothing — a common source of tenant-leak bugs.

### SQL Server 2025 JSON columns

```csharp
// ✅ Map to the native `json` column type (SQL Server 2025)
modelBuilder.Entity<Order>()
    .OwnsOne(o => o.Metadata, b => b.ToJson());   // stored/queried as JSON
```

### SQL Server 2025 VECTOR columns

EF Core 10 supports the SQL Server 2025 `VECTOR` type (via `Microsoft.Data.SqlClient`'s `SqlVector`) for similarity search — map the column type explicitly and use `EF.Functions.VectorDistance(...)` in LINQ.

### LINQ improvements

General translation improvements — as always, verify generated SQL for hot paths with `.ToQueryString()` / logging.

---

## SQL Server Specifics

### Raw SQL when EF falls short

```csharp
// ✅ FormattableString — parameterized automatically
var orders = await ctx.Orders
    .FromSqlInterpolated($"""
        SELECT * FROM Pedidos
        WHERE CodiGDP LIKE {pattern}
        AND SerieGDP = {serie}
    """)
    .AsNoTracking()
    .ToListAsync(ct);

// ✅ Execute raw SQL for complex operations
await ctx.Database.ExecuteSqlInterpolatedAsync($"""
    UPDATE Pedidos SET EstatPedido = {newStatus}
    WHERE ID = {orderId}
""", ct);
```

### Views (C1-C6 convention)

```csharp
// ✅ Map views in DbContext — read-only, no key tracking
modelBuilder.Entity<C4PedidosView>(entity =>
{
    entity.HasNoKey();
    entity.ToView("C4PedidosRepresentant");
});

// ✅ Query views
var view = await ctx.Set<C4PedidosView>()
    .FromSqlRaw("SELECT * FROM C4PedidosRepresentant WHERE RepID = @p0", repId)
    .AsNoTracking()
    .ToListAsync(ct);
```

### Stored Procedures

```csharp
// ✅ Call stored procedures
var result = await ctx.Database
    .SqlQueryRaw<SpResult>("EXEC sp_GetOrderSummary @OrderId = {0}", orderId)
    .ToListAsync(ct);
```

---

## FILESTREAM / Blob Storage

Pattern: separate blob tables (`*_Blobs`) with FILESTREAM columns.

```csharp
// ✅ Service pattern for document management
public sealed class DocumentService(
    IDbContextFactory<AppDbContext> contextFactory,
    ILogger<DocumentService> logger)
{
    public async Task<byte[]?> GetDocumentAsync(int documentId, CancellationToken ct = default)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var blob = await ctx.DocumentBlobs
            .AsNoTracking()
            .Where(b => b.DocumentId == documentId)
            .Select(b => b.Content)
            .FirstOrDefaultAsync(ct);
        return blob;
    }

    public async Task SaveDocumentAsync(int documentId, byte[] content, string fileName, CancellationToken ct = default)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var blob = new DocumentBlob
        {
            DocumentId = documentId,
            Content = content,
            FileName = fileName,
            Created = DateTime.UtcNow
        };
        ctx.DocumentBlobs.Add(blob);
        await ctx.SaveChangesAsync(ct);
    }
}
```

---

## Transactions

```csharp
// ✅ Explicit transaction for multi-step operations
public async Task TransferOrderAsync(int orderId, int newRepId, CancellationToken ct = default)
{
    await using var ctx = await contextFactory.CreateDbContextAsync(ct);
    await using var transaction = await ctx.Database.BeginTransactionAsync(ct);
    try
    {
        var order = await ctx.Orders.FindAsync([orderId], ct)
            ?? throw new InvalidOperationException($"Order {orderId} not found");

        order.RepresentantId = newRepId;
        order.Modified = DateTime.UtcNow;

        ctx.AuditLogs.Add(new AuditLog
        {
            EntityId = orderId,
            Action = "Transfer",
            Details = $"Rep changed to {newRepId}"
        });

        await ctx.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
    catch
    {
        await transaction.RollbackAsync(ct);
        throw;
    }
}
```

---

## Type Casting (SQL Server ↔ C#)

Common gotcha: SQL Server `tinyint` maps to C# `byte`, not `int`.

```csharp
// ✅ Map column types explicitly when needed
modelBuilder.Entity<Order>(entity =>
{
    entity.Property(e => e.Status)
        .HasColumnType("tinyint");
});

// ✅ In raw SQL, CAST to avoid materialization errors
var items = await ctx.Database
    .SqlQueryRaw<StatusDto>("""
        SELECT CAST(EstatPedido AS int) AS Status, COUNT(*) AS Count
        FROM Pedidos
        GROUP BY EstatPedido
    """)
    .ToListAsync(ct);
```

---

## Migrations

```bash
# Add migration
dotnet ef migrations add AddOrderTracking --project Data --startup-project Web

# Update database
dotnet ef database update --project Data --startup-project Web

# Generate SQL script (for production)
dotnet ef migrations script --idempotent --project Data --startup-project Web -o migration.sql
```

Best practices:
- Always review generated migration before applying
- Use `--idempotent` scripts for production
- Never auto-migrate in production (`Database.Migrate()` in startup)
- Keep migrations small and focused
