# Dapper Patterns for Blazor Server (.NET 10)

## Why Dapper in Blazor Server

- **Raw SQL + object mapping** — full control, no tracking overhead
- **Faster than EF Core** for read-heavy and reporting scenarios
- **Native fit for stored procedures** and complex joins
- **Less abstraction** — easier to reason about query performance
- **Coexists with EF Core** — use Dapper for hot paths, EF for domain

> Dapper complements EF Core; it does not replace it. Use EF for writes, change tracking, migrations. Use Dapper for reads, reports, stored procs, bulk ops.

---

## ⚠️ Critical: Dapper is Sync-First

Dapper is **fundamentally synchronous**. In Blazor Server this is dangerous — sync calls **block the circuit thread** and freeze the entire UI for that user.

| ❌ NEVER (sync) | ✅ ALWAYS (async) |
|----------------|------------------|
| `conn.Query<T>(sql)` | `conn.QueryAsync<T>(sql)` |
| `conn.QueryFirstOrDefault<T>(sql)` | `conn.QueryFirstOrDefaultAsync<T>(sql)` |
| `conn.QuerySingle<T>(sql)` | `conn.QuerySingleAsync<T>(sql)` |
| `conn.Execute(sql)` | `conn.ExecuteAsync(sql)` |
| `conn.QueryMultiple(sql)` | `conn.QueryMultipleAsync(sql)` |
| `conn.BeginTransaction()` | `conn.BeginTransactionAsync(ct)` |
| `conn.Open()` | `conn.OpenAsync(ct)` |
| `tx.Commit()` | `tx.CommitAsync(ct)` |
| `tx.Rollback()` | `tx.RollbackAsync(ct)` |

**Rule**: if a method has an `Async` suffix, use it. No exceptions.

---

## Connection Management

### ⚠️ Why `IDbConnectionFactory<T>` (not `new SqlConnection()`)

Blazor Server circuits are long-lived. A `SqlConnection` cached in a service field **holds the connection open for the entire circuit**, exhausting the pool.

**Always create connections per operation** with a factory. There is **no built-in `AddDbConnectionFactory<T>`** extension in the .NET 10 / Microsoft.Data.SqlClient surface — implement the pattern yourself (simple and explicit).

### Registration (recommended)

```csharp
using System.Data.Common;
using Microsoft.Data.SqlClient;

// Register your factory implementation (per-operation connections)
builder.Services.AddSingleton<IDbConnectionFactory<SqlConnection>>(sp =>
    new SqlConnectionFactory(
        sp.GetRequiredService<IConfiguration>().GetConnectionString("Default")!,
        sp.GetRequiredService<ILogger<SqlConnectionFactory>>()));
```

### Custom factory implementation (IDbConnectionFactory<T>)

```csharp
using System.Data.Common;

public interface IDbConnectionFactory<T> where T : DbConnection
{
    ValueTask<T> CreateConnectionAsync(CancellationToken ct = default);
}

public sealed class SqlConnectionFactory(
    string connectionString,
    ILogger<SqlConnectionFactory> logger) : IDbConnectionFactory<SqlConnection>
{
    public async ValueTask<SqlConnection> CreateConnectionAsync(CancellationToken ct = default)
    {
        logger.LogDebug("Opening new SQL connection");
        var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }
}
```

---

## Repository Pattern with Dapper

```csharp
public sealed class OrderRepository(
    IDbConnectionFactory<SqlConnection> connectionFactory,
    ILogger<OrderRepository> logger) : IOrderRepository
{
    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        await using var conn = await connectionFactory.CreateConnectionAsync(ct);

        const string sql = """
            SELECT Id, Code, Amount, Status, CustomerId, Created, Modified
            FROM   dbo.Orders
            WHERE  Id = @Id
            """;

        return await conn.QueryFirstOrDefaultAsync<Order>(
            new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<Order>> GetByCustomerAsync(int customerId, CancellationToken ct = default)
    {
        await using var conn = await connectionFactory.CreateConnectionAsync(ct);

        const string sql = """
            SELECT Id, Code, Amount, Status, CustomerId, Created
            FROM   dbo.Orders
            WHERE  CustomerId = @CustomerId
            ORDER  BY Created DESC
            """;

        var orders = await conn.QueryAsync<Order>(
            new CommandDefinition(sql, new { CustomerId = customerId }, cancellationToken: ct));
        return orders.AsList();
    }
}
```

```csharp
// Registration
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
```

---

## `CommandDefinition` — Always Pass It

`CommandDefinition` is the only way to thread `CancellationToken`, command timeout, and transaction through to the SQL command.

```csharp
// ✅ Cancellation, timeout, transaction — all in one place
var cmd = new CommandDefinition(
    sql,
    parameters,
    transaction: tx,
    commandTimeout: 30,
    cancellationToken: ct);

await conn.QueryAsync<Order>(cmd);

// ❌ No cancellation propagation — request continues even if user navigates away
await conn.QueryAsync<Order>(sql, parameters);
```

### Default timeout

```csharp
// Global default (set once at startup)
SqlMapper.Settings.CommandTimeout = 30;
```

---

## Parameter Binding

### Anonymous object (most common)

```csharp
new { Id = 42, Status = "Active", Since = DateTime.UtcNow }
```

### `DynamicParameters` (for IN clauses, output params)

```csharp
// IN clause
var ids = new[] { 1, 2, 3, 4 };
var p = new DynamicParameters();
p.Add("@Ids", ids); // Dapper expands to WHERE Id IN @Ids

var orders = await conn.QueryAsync<Order>(
    new CommandDefinition(
        "SELECT * FROM dbo.Orders WHERE Id IN @Ids",
        p,
        cancellationToken: ct));

// Output parameter
var p = new DynamicParameters();
p.Add("@Id", id);
p.Add("@Total", dbType: DbType.Decimal, direction: ParameterDirection.Output);

await conn.ExecuteAsync(new CommandDefinition(
    "dbo.usp_RecalculateOrderTotal", p,
    commandType: CommandType.StoredProcedure, cancellationToken: ct));

var total = p.Get<decimal>("@Total");
```

### List expansion caveats

- Dapper expands `IEnumerable<int>` to `IN (...)` automatically
- For nullable lists use `IN @Ids` with a non-null guard (empty `IN ()` throws on SQL Server)

---

## Multi-Mapping (Joins)

```csharp
const string sql = """
    SELECT o.Id, o.Code, o.Amount, o.Status,
           c.Id, c.Name, c.Email
    FROM   dbo.Orders o
    INNER  JOIN dbo.Customers c ON c.Id = o.CustomerId
    WHERE  o.Id = @Id
    """;

var order = await conn.QueryAsync<Order, Customer, Order>(
    new CommandDefinition(sql, new { Id = id }, cancellationToken: ct),
    map: (o, c) => { o.Customer = c; return o; },
    splitOn: "Id");
```

- `splitOn` is the column where Dapper splits the row into the next type (defaults to `Id`)
- Always pass `splitOn` explicitly — implicit defaults are fragile

### Three-way join

```csharp
const string sql = """
    SELECT o.*, c.*, a.*
    FROM   dbo.Orders o
    JOIN   dbo.Customers c ON c.Id = o.CustomerId
    JOIN   dbo.Addresses  a ON a.Id = c.AddressId
    """;

var orders = await conn.QueryAsync<Order, Customer, Address, Order>(
    sql,
    (o, c, a) => { c.Address = a; o.Customer = c; return o; },
    splitOn: "Id,Id");
```

---

## Multiple Result Sets

```csharp
const string sql = """
    SELECT * FROM dbo.Orders  WHERE CustomerId = @Id;
    SELECT * FROM dbo.Customer WHERE Id = @Id;
    """;

await using var multi = await conn.QueryMultipleAsync(
    new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));

var orders   = (await multi.ReadAsync<Order>()).AsList();
var customer = await multi.ReadFirstOrDefaultAsync<Customer>();
```

---

## Transactions

```csharp
public async Task<Result<bool>> UpdateOrderWithHistoryAsync(
    int orderId, OrderStatus newStatus, CancellationToken ct = default)
{
    await using var conn = await connectionFactory.CreateConnectionAsync(ct);
    await using var tx   = await conn.BeginTransactionAsync(ct);

    try
    {
        const string updateSql = """
            UPDATE dbo.Orders
            SET    Status = @Status, Modified = @Modified
            WHERE  Id = @Id
            """;
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            updateSql, new { Id = orderId, Status = newStatus, Modified = DateTime.UtcNow },
            transaction: tx, cancellationToken: ct));

        if (affected == 0)
        {
            await tx.RollbackAsync(ct);
            return Result<bool>.Failure("Order not found");
        }

        const string historySql = """
            INSERT INTO dbo.OrderHistory (OrderId, Status, Changed)
            VALUES (@OrderId, @Status, @Changed)
            """;
        await conn.ExecuteAsync(new CommandDefinition(
            historySql,
            new { OrderId = orderId, Status = newStatus, Changed = DateTime.UtcNow },
            transaction: tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return Result<bool>.SuccessM(true, $"Order {orderId} updated to {newStatus}");
    }
    catch
    {
        await tx.RollbackAsync(ct);
        throw;
    }
}
```

> **No ambient scope** — unlike EF Core, Dapper transactions do **not** flow through the DI container. You must pass `transaction: tx` to every call.

---

## Stored Procedures

```csharp
const string proc = "dbo.usp_GetOrderSummary";

var summary = await conn.QueryFirstOrDefaultAsync<OrderSummary>(
    new CommandDefinition(
        proc,
        new { Year = 2026, CustomerId = 42 },
        commandType: CommandType.StoredProcedure,
        commandTimeout: 60,
        cancellationToken: ct));
```

```csharp
// Result set from a stored proc
var rows = await conn.QueryAsync<ReportRow>(
    new CommandDefinition(
        "dbo.usp_RunDailyReport",
        new { RunDate = DateOnly.FromDateTime(DateTime.UtcNow) },
        commandType: CommandType.StoredProcedure,
        cancellationToken: ct));
```

---

## Type Handlers

### Built-in (.NET 10 / Dapper recent)

Dapper natively supports:
- `DateTime`, `DateTimeOffset`
- `decimal`, `Guid`, `byte[]`
- `DateOnly`, `TimeOnly` (since Dapper 2.1)
- Enums (map to underlying int)
- `string`, numeric types

### Custom handler — JSON column

```csharp
using System.Data;
using System.Text.Json;
using Dapper;

public sealed class JsonTypeHandler<T> : SqlMapper.TypeHandler<T>
{
    public override T? Parse(object value)
    {
        if (value is null or DBNull) return default;
        return JsonSerializer.Deserialize<T>((string)value);
    }

    public override void SetValue(IDbDataParameter parameter, T? value)
    {
        parameter.DbType = DbType.String;
        parameter.Value  = value is null ? (object)DBNull.Value : JsonSerializer.Serialize(value);
    }
}
```

```csharp
// Register ONCE at startup
public static class DapperConfig
{
    public static void RegisterTypeHandlers()
    {
        SqlMapper.AddTypeHandler(new JsonTypeHandler<Address>());
        SqlMapper.AddTypeHandler(new JsonTypeHandler<OrderMetadata>());
    }
}

// In Program.cs
DapperConfig.RegisterTypeHandlers();
```

### Enum as string (not int)

```csharp
public sealed class OrderStatusTypeHandler : SqlMapper.TypeHandler<OrderStatus>
{
    public override OrderStatus Parse(object value) => Enum.Parse<OrderStatus>((string)value);
    public override void SetValue(IDbDataParameter parameter, OrderStatus value)
        => parameter.Value = value.ToString();
}
```

---

## Bulk Operations

Dapper alone does not have a true `SaveChanges` style bulk API. Options:

| Library | Use for |
|---------|---------|
| `Dapper.Contrib` | Simple insert/update by primary key |
| `DapperPlus` (commercial) | High-volume bulk insert/update/delete |
| Raw `SqlBulkCopy` | When you have a `DataTable` or `IDataReader` |

```csharp
// Dapper.Contrib — entity by Id
await conn.InsertAsync(new Order { Code = "ORD-001", Amount = 99.95m });
await conn.UpdateAsync(order);
```

```csharp
// SqlBulkCopy for very large inserts
using var bulk = new SqlBulkCopy(conn)
{
    DestinationTableName = "dbo.OrderLines",
    BulkCopyTimeout = 60
};
await bulk.WriteToServerAsync(dataTable, ct);
```

---

## Combining EF Core + Dapper

**Use the same connection** to share a transaction:

```csharp
public sealed class HybridOrderService(
    IDbContextFactory<AppDbContext> contextFactory,
    IDbConnectionFactory<SqlConnection> connectionFactory) : IOrderService
{
    public async Task<Order?> GetWithLinesAsync(int id, CancellationToken ct = default)
    {
        // EF for the aggregate root (change tracking, includes)
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var order = await ctx.Orders
            .Include(o => o.Customer)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
        if (order is null) return null;

        // Dapper for the heavy read of child collection (no tracking)
        await using var conn = await connectionFactory.CreateConnectionAsync(ct);
        const string sql = """
            SELECT Id, OrderId, ProductId, Quantity, UnitPrice
            FROM   dbo.OrderLines
            WHERE  OrderId = @Id
            """;
        var lines = await conn.QueryAsync<OrderLine>(
            new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));
        order.Lines = lines.AsList();

        return order;
    }
}
```

> For true transactional sharing you'd need to pull EF's `SqlConnection` from `Database.GetDbConnection()` and use that with Dapper.

---

## Performance Tips

1. **`AsList()` once, at the boundary** — Dapper's `IEnumerable<T>` is lazy; materialize before returning from the service
2. **Project only the columns you need** — Dapper maps every column; `SELECT *` is wasteful
3. **Use `Buffered: false` for huge result sets** — but only if you must stream
4. **Set `CommandTimeout` per query** — long-running reports need >30s
5. **Use `QueryUnbufferedAsync` for `>100k` rows** — avoids loading all into memory
6. **Index your query** — Dapper is fast but the SQL still needs proper indexes
7. **Connection pooling is built-in** — `SqlConnection` reuses physical connections

```csharp
// Streaming huge result sets — QueryUnbufferedAsync returns IAsyncEnumerable<T> (no await here)
var stream = conn.QueryUnbufferedAsync<BigRow>(
    new CommandDefinition("SELECT * FROM dbo.HugeTable", cancellationToken: ct));

await foreach (var row in stream.WithCancellation(ct))
{
    // process one at a time
}
```

---

## Anti-Patterns

```csharp
// ❌ Sync call blocks the Blazor circuit thread
public Order? GetOrder(int id)
{
    using var conn = new SqlConnection(_connString);
    conn.Open();
    return conn.QueryFirstOrDefault<Order>(
        "SELECT * FROM Orders WHERE Id = @Id", new { id });
}

// ❌ Connection held for the entire circuit lifetime
public class OrderService
{
    private readonly SqlConnection _conn;
    public OrderService(IConfiguration cfg)
    {
        _conn = new SqlConnection(cfg.GetConnectionString("Default"));
        _conn.Open();
    }
}

// ❌ Raw SQL in components
@code {
    private async Task LoadAsync()
    {
        using var conn = new SqlConnection(...);
        _orders = (await conn.QueryAsync<Order>("SELECT ...")).ToList();
    }
}

// ❌ No cancellation token
await conn.QueryAsync<Order>(sql, new { id });

// ❌ Assuming implicit transaction scope (Dapper has no ambient UoW)
using var tx = conn.BeginTransaction();
// Other Dapper calls in the request will NOT see this tx unless you pass it

// ❌ Returning lazy IEnumerable from the service
public async Task<IEnumerable<Order>> GetActiveAsync()
{
    await using var conn = await connectionFactory.CreateConnectionAsync();
    return conn.QueryAsync<Order>(sql); // Connection dies when method returns
}
```

---

## Quick Reference

| Task | API |
|------|-----|
| Open connection | `await using var conn = await factory.CreateConnectionAsync(ct);` |
| Single row | `conn.QueryFirstOrDefaultAsync<T>(cmd)` / `QuerySingleAsync<T>(cmd)` |
| Multiple rows | `conn.QueryAsync<T>(cmd)` |
| Execute (INSERT/UPDATE/DELETE) | `conn.ExecuteAsync(cmd)` |
| Scalar | `conn.ExecuteScalarAsync<T>(cmd)` |
| Multi-result | `conn.QueryMultipleAsync(cmd)` + `multi.ReadAsync<T>()` |
| Stored procedure | `commandType: CommandType.StoredProcedure` |
| Cancellation | `new CommandDefinition(sql, params, cancellationToken: ct)` |
| Transaction | `conn.BeginTransactionAsync(ct)` + pass `transaction: tx` |

---

## When to Choose Dapper vs EF Core

| Scenario | Pick |
|----------|------|
| Domain model with change tracking | **EF Core** |
| Migrations, code-first schema | **EF Core** |
| Complex aggregates + `Include` graph | **EF Core** |
| Cross-database portability | **EF Core** |
| Reporting / complex analytical queries | **Dapper** |
| Stored procedures | **Dapper** |
| Hot read paths, microsecond-sensitive | **Dapper** |
| Bulk insert/update/delete | **Dapper** (or Dapper.Contrib/SqlBulkCopy) |
| Multi-database raw SQL | **Dapper** |
| Mix of both | **EF Core for writes, Dapper for reads** |
