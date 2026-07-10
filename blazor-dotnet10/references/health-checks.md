# Health Checks for Blazor Server (.NET 10)

`Microsoft.Extensions.Diagnostics.HealthChecks` exposes `/health` endpoints so orchestrators (Kubernetes, Docker, load balancers, Azure App Service) know if your Blazor Server app can serve traffic.

Two distinct signals:

- **Liveness** (`/health/live`) — "is the process alive?" — never depends on external resources
- **Readiness** (`/health/ready`) — "can it actually serve requests?" — checks DB, cache, downstream APIs

---

## Minimal Setup

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("Default")!, name: "sql")
    .AddDbContextCheck<AppDbContext>("ef")
    .AddCheck<CacheHealthCheck>("hybrid-cache");

var app = builder.Build();

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // no checks; just confirms the process is up
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});

app.Run();
```

Tags are how you separate liveness from readiness:

```csharp
.AddSqlServer(connStr, name: "sql", tags: new[] { "ready" })
.AddCheck<CacheHealthCheck>("cache", tags: new[] { "ready" });
```

---

## Built-in Checks

| Check | Package |
|-------|---------|
| `AddSqlServer` | `AspNetCore.HealthChecks.SqlServer` |
| `AddDbContextCheck<T>` | `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` |
| `AddRedis` | `AspNetCore.HealthChecks.Redis` |
| `AddUrlGroup` | `AspNetCore.HealthChecks.Uris` (HTTP ping) |
| `AddDiskStorageHealthCheck` | `AspNetCore.HealthChecks.System` (disk space) |
| `AddProcessAllocatedMemoryHealthCheck` | `AspNetCore.HealthChecks.System` (memory) |
| `AddApplicationInsightsPublisher` | emits results to App Insights |
| `AddSignalRHub` | SignalR hub health |

```csharp
builder.Services.AddHealthChecks()
    .AddSqlServer(connStr, name: "sql",
        healthQuery: "SELECT 1;",
        failureStatus: HealthStatus.Degraded,
        tags: new[] { "ready", "db" })
    .AddDbContextCheck<AppDbContext>("ef", tags: new[] { "ready", "db" })
    .AddRedis(redisConn, name: "redis", tags: new[] { "ready", "cache" })
    .AddUrlGroup(new Uri("https://api.partner.com/health"),
        name: "partner-api", tags: new[] { "ready", "external" });
```

---

## Custom `IHealthCheck`

```csharp
using Microsoft.Extensions.Diagnostics.HealthChecks;

public sealed class HybridCacheHealthCheck(HybridCache cache) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            // Touch the cache to confirm it's responsive
            await cache.GetOrCreateAsync<byte[]>(
                key: "healthcheck:ping",
                factory: _ => ValueTask.FromResult<byte[]>([1]),
                cancellationToken: ct);
            return HealthCheckResult.Healthy("HybridCache OK");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("HybridCache failed", ex);
        }
    }
}
```

```csharp
// Registration
.AddCheck<HybridCacheHealthCheck>("hybrid-cache", tags: new[] { "ready" });
```

### Dapper connection-factory check

`AddSqlServer` pings a raw connection string. If your reads go through the DI-registered `IDbConnectionFactory<SqlConnection>` (the Dapper path in this skill), check *that* so the probe exercises the real code path:

```csharp
public sealed class SqlConnectionHealthCheck(
    IDbConnectionFactory<SqlConnection> factory) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            await using var conn = await factory.CreateConnectionAsync(ct);
            var ok = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition("SELECT 1;", cancellationToken: ct));
            return ok == 1
                ? HealthCheckResult.Healthy("SQL connection factory OK")
                : HealthCheckResult.Unhealthy("SELECT 1 returned an unexpected value");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("SQL connection factory failed", ex);
        }
    }
}

// Registration
.AddCheck<SqlConnectionHealthCheck>("sql-factory", tags: new[] { "ready", "db" });
```

> Don't pair this with `AddSqlServer` on the *same* connection unless you want both — they overlap. Pick the one that matches your real read path (this skill leans Dapper, so the factory check is the truer signal).

---

## Custom Response Writer

Default response is plain text. For JSON:

```csharp
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var json = JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                durationMs = e.Value.Duration.TotalMilliseconds,
                exception = e.Value.Exception?.Message
            }),
            totalDurationMs = report.TotalDuration.TotalMilliseconds
        });
        await context.Response.WriteAsync(json);
    }
});
```

---

## Authorization

`MapHealthChecks` returns an `IEndpointConventionBuilder`. Apply normal ASP.NET auth:

```csharp
app.MapHealthChecks("/health/ready")
   .RequireAuthorization("AdminOnly");
```

For unauthenticated probes (Kubernetes):

```csharp
app.MapHealthChecks("/health/ready").AllowAnonymous();
app.MapHealthChecks("/health/live").AllowAnonymous();
```

---

## Status Codes

| Status | HTTP | When |
|--------|------|------|
| `Healthy` | 200 | All checks pass |
| `Degraded` | 200 | Some non-critical checks fail (configurable) |
| `Unhealthy` | 503 | Critical checks fail (Kubernetes pulls pod out of rotation) |

```csharp
.AddSqlServer(connStr,
    failureStatus: HealthStatus.Unhealthy,    // critical
    tags: new[] { "ready" });

.AddUrlGroup(externalUri,
    failureStatus: HealthStatus.Degraded,     // non-critical
    tags: new[] { "ready", "external" });
```

---

## Publishing

```csharp
// App Insights
.AddApplicationInsightsPublisher();

// Or custom: write to a log
public sealed class LogHealthCheckPublisher(ILogger<LogHealthCheckPublisher> logger)
    : IHealthCheckPublisher
{
    public Task PublishAsync(HealthReport report, CancellationToken ct = default)
    {
        logger.LogInformation("Health check: {Status} ({Duration}ms)",
            report.Status, report.TotalDuration.TotalMilliseconds);
        return Task.CompletedTask;
    }
}
```

---

## Anti-Patterns

```csharp
// ❌ WRONG — readiness check that depends on external APIs that can be down
.AddUrlGroup(new Uri("https://twitter.com"))  // Twitter outage ≠ your app is unhealthy

// ❌ WRONG — checking the DB on /health/live
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")  // kills pod on DB hiccup
});

// ❌ WRONG — heavy check that runs every probe
.AddCheck("expensive", new SlowHealthCheck());  // 5-second query

// ❌ WRONG — checking the same thing twice
.AddSqlServer(connStr)
.AddDbContextCheck<AppDbContext>()  // both run; the EF check already exercises SQL

// ❌ WRONG — exposing sensitive details in the response writer
exception.StackTrace  // leak to unauthenticated probes
```

---

## Quick Reference

| Need | Pattern |
|------|---------|
| Liveness (process up) | `/health/live` with `Predicate = _ => false` |
| Readiness (can serve) | `/health/ready` with `Predicate = c => c.Tags.Contains("ready")` |
| SQL Server | `AddSqlServer(connStr, tags: ["ready"])` |
| EF Core | `AddDbContextCheck<AppDbContext>("ef", tags: ["ready"])` |
| Redis | `AddRedis(redisConn, tags: ["ready"])` |
| HTTP URL | `AddUrlGroup(uri, name: "...")` |
| Custom | Implement `IHealthCheck` → `AddCheck<T>("name", tags: [...])` |
| JSON response | Custom `ResponseWriter` |
| App Insights | `AddApplicationInsightsPublisher()` |
| Protect endpoint | `.RequireAuthorization("AdminOnly")` or `.AllowAnonymous()` |
