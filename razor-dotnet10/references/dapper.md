# Dapper — Reference

## Setup

```csharp
// Program.cs — single SqlConnection per request (Scoped)
builder.Services.AddScoped<IDbConnection>(_ =>
    new SqlConnection(builder.Configuration.GetConnectionString("Default")));
```

## Core Query Patterns

```csharp
// ── Single row ────────────────────────────────────────────────
var product = await db.QuerySingleOrDefaultAsync<ProductDto>(
    new CommandDefinition(
        "SELECT Id, Name, Price FROM Products WHERE Id = @Id",
        new { Id = id },
        cancellationToken: ct));

// ── List ──────────────────────────────────────────────────────
var products = (await db.QueryAsync<ProductDto>(
    new CommandDefinition(
        "SELECT Id, Name, Price FROM Products WHERE Active = 1 ORDER BY Name",
        cancellationToken: ct))).AsList();

// ── Scalar ────────────────────────────────────────────────────
var count = await db.ExecuteScalarAsync<int>(
    new CommandDefinition(
        "SELECT COUNT(*) FROM Products WHERE CategoryId = @CatId",
        new { CatId = categoryId },
        cancellationToken: ct));

// ── Execute (INSERT/UPDATE/DELETE) ────────────────────────────
var rows = await db.ExecuteAsync(
    new CommandDefinition(
        "UPDATE Products SET Price = @Price WHERE Id = @Id",
        new { Price = price, Id = id },
        cancellationToken: ct));
```

## INSERT with OUTPUT (avoid extra SELECT)

```csharp
// SQL Server: OUTPUT INSERTED.* returns the created row immediately
const string sql = """
    INSERT INTO Products (Name, Price, CategoryId, CreatedAt)
    OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Price, INSERTED.CreatedAt
    VALUES (@Name, @Price, @CategoryId, SYSUTCDATETIME())
    """;

var created = await db.QuerySingleAsync<ProductDto>(
    new CommandDefinition(sql, input, cancellationToken: ct));
```

## Multi-Mapping (JOINs)

```csharp
// One-to-one JOIN
const string sql = """
    SELECT p.Id, p.Name, p.Price,
           c.Id, c.Name AS CategoryName
    FROM Products p
    INNER JOIN Categories c ON c.Id = p.CategoryId
    WHERE p.Id = @Id
    """;

var result = await db.QueryAsync<ProductDto, CategoryDto, ProductDto>(
    new CommandDefinition(sql, new { Id = id }, cancellationToken: ct),
    map: (product, category) =>
    {
        product.Category = category;
        return product;
    },
    splitOn: "Id");  // column where the second object starts

var product = result.FirstOrDefault();
```

```csharp
// One-to-many (aggregate manually)
const string sql = """
    SELECT o.Id, o.Code, o.Total,
           ol.Id, ol.ProductName, ol.Quantity, ol.UnitPrice
    FROM Orders o
    INNER JOIN OrderLines ol ON ol.OrderId = o.Id
    WHERE o.Id = @Id
    """;

var orderDict = new Dictionary<int, OrderDto>();

await db.QueryAsync<OrderDto, OrderLineDto, OrderDto>(
    new CommandDefinition(sql, new { Id = id }, cancellationToken: ct),
    map: (order, line) =>
    {
        if (!orderDict.TryGetValue(order.Id, out var existing))
        {
            existing = order;
            existing.Lines = [];
            orderDict[order.Id] = existing;
        }
        existing.Lines.Add(line);
        return existing;
    },
    splitOn: "Id");

var result = orderDict.Values.FirstOrDefault();
```

## Multiple Result Sets

```csharp
const string sql = """
    SELECT * FROM Products WHERE CategoryId = @CatId;
    SELECT COUNT(*) FROM Products WHERE CategoryId = @CatId;
    """;

using var multi = await db.QueryMultipleAsync(
    new CommandDefinition(sql, new { CatId = categoryId }, cancellationToken: ct));

var products = (await multi.ReadAsync<ProductDto>()).AsList();
var total    = await multi.ReadSingleAsync<int>();
```

## Transactions

```csharp
public async Task<bool> CreateOrderAsync(OrderInputModel input, CancellationToken ct = default)
{
    // Ensure connection is open (Dapper opens per query by default)
    if (db is SqlConnection sqlConn && sqlConn.State != ConnectionState.Open)
        await sqlConn.OpenAsync(ct);

    await using var tx = await ((SqlConnection)db).BeginTransactionAsync(ct);
    try
    {
        var orderId = await db.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            INSERT INTO Orders (CustomerId, Total, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@CustomerId, @Total, SYSUTCDATETIME())
            """,
            new { input.CustomerId, input.Total }, tx, cancellationToken: ct));

        foreach (var line in input.Lines)
        {
            await db.ExecuteAsync(new CommandDefinition(
                "INSERT INTO OrderLines (OrderId, ProductId, Quantity, UnitPrice) VALUES (@OrderId, @ProductId, @Quantity, @UnitPrice)",
                new { OrderId = orderId, line.ProductId, line.Quantity, line.UnitPrice },
                tx, cancellationToken: ct));
        }

        await tx.CommitAsync(ct);
        return true;
    }
    catch
    {
        await tx.RollbackAsync(ct);
        throw; // re-throw — let service layer handle
    }
}
```

## Bulk Insert (Table-Valued Parameter)

```csharp
// For large batches — TVP is faster than looped inserts
var table = new DataTable();
table.Columns.Add("ProductId", typeof(int));
table.Columns.Add("Quantity", typeof(int));
foreach (var item in items)
    table.Rows.Add(item.ProductId, item.Quantity);

var param = new { Lines = table.AsTableValuedParameter("dbo.OrderLineType") };
await db.ExecuteAsync(new CommandDefinition(
    "EXEC InsertOrderLines @Lines",
    param, cancellationToken: ct));
```

## Dynamic Parameters

```csharp
// Build WHERE clause dynamically
var conditions = new List<string>();
var parameters = new DynamicParameters();

if (!string.IsNullOrEmpty(search))
{
    conditions.Add("Name LIKE @Search");
    parameters.Add("Search", $"%{search}%");
}
if (categoryId.HasValue)
{
    conditions.Add("CategoryId = @CategoryId");
    parameters.Add("CategoryId", categoryId.Value);
}

var where = conditions.Count > 0
    ? "WHERE " + string.Join(" AND ", conditions)
    : string.Empty;

var sql = $"SELECT Id, Name, Price FROM Products {where} ORDER BY Name";
var result = (await db.QueryAsync<ProductDto>(
    new CommandDefinition(sql, parameters, cancellationToken: ct))).AsList();
```

## Repository Pattern

```csharp
public interface IProductRepository
{
    Task<IReadOnlyList<ProductDto>> GetAllAsync(CancellationToken ct = default);
    Task<ProductDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<ProductDto> CreateAsync(ProductInputModel input, CancellationToken ct = default);
    Task<bool> UpdateAsync(int id, ProductInputModel input, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
}

public sealed class ProductRepository(IDbConnection db) : IProductRepository
{
    // Implement interface — inject IDbConnection (Scoped)
}

// Registration
builder.Services.AddScoped<IProductRepository, ProductRepository>();
```

## Stored Procedures

```csharp
var result = await db.QueryAsync<ProductDto>(
    new CommandDefinition(
        "dbo.GetProductsByCategory",
        new { CategoryId = id, Active = true },
        commandType: CommandType.StoredProcedure,
        cancellationToken: ct));
```

## Rules

| Do | Don't |
|----|-------|
| Always use `CommandDefinition` for CT | Ignore `CancellationToken` |
| `OUTPUT INSERTED.*` for INSERT result | Extra SELECT after INSERT |
| `QuerySingleOrDefaultAsync` for 0-1 | `QueryAsync().FirstOrDefault()` |
| Open connection explicitly before TX | Rely on auto-open in transactions |
| `DynamicParameters` for dynamic SQL | `string.Format` / interpolation in SQL |
| `.AsList()` instead of `.ToList()` | `.ToList()` (allocates extra) |
