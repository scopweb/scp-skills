# Anti-Patterns & Common Mistakes

## Blazor Server Anti-Patterns

### ❌ DbContext in Components

```csharp
// ❌ WRONG — DbContext shared across circuit lifetime, not thread-safe
@inject AppDbContext Context

protected override async Task OnInitializedAsync()
{
    _orders = await Context.Orders.ToListAsync();
}
```

```csharp
// ✅ FIX — Use service with IDbContextFactory
@inject OrderService OrderService

protected override async Task OnInitializedAsync()
{
    _orders = await OrderService.GetActiveAsync();
}
```

### ❌ StateHasChanged from Background Thread

```csharp
// ❌ WRONG — crashes or undefined behavior
private void OnTimerElapsed(object? state)
{
    _count++;
    StateHasChanged(); // Called from Timer thread!
}
```

```csharp
// ✅ FIX — Always wrap in InvokeAsync
private void OnTimerElapsed(object? state)
{
    InvokeAsync(() =>
    {
        _count++;
        StateHasChanged();
    });
}
```

### ❌ HTML Forms in Blazor

```razor
<!-- ❌ WRONG — bypasses Blazor, causes full page reload -->
<form action="/api/submit" method="post">
    <input name="code" />
    <button type="submit">Submit</button>
</form>
```

```razor
<!-- ✅ FIX — Blazor EditForm -->
<EditForm Model="_model" OnValidSubmit="HandleSubmit" FormName="MyForm">
    <InputText @bind-Value="_model.Code" />
    <button type="submit">Submit</button>
</EditForm>
```

### ❌ Missing Disposal

```csharp
// ❌ WRONG — timer/CTS/subscription leaks
private Timer _timer;
private CancellationTokenSource _cts = new();

protected override void OnInitialized()
{
    _timer = new Timer(Tick, null, 0, 1000);
}
// No Dispose → memory leak, callbacks on dead circuits
```

```csharp
// ✅ FIX — implement IAsyncDisposable
public async ValueTask DisposeAsync()
{
    if (_timer is not null)
        await _timer.DisposeAsync();
    await _cts.CancelAsync();
    _cts.Dispose();
}
```

### ❌ Unnecessary StateHasChanged

```csharp
// ❌ WRONG — Blazor already calls it after lifecycle and event handlers
protected override async Task OnInitializedAsync()
{
    _data = await Service.GetAsync();
    StateHasChanged(); // REDUNDANT — Blazor does this automatically
}

private async Task HandleClick()
{
    _loading = true;
    StateHasChanged(); // REDUNDANT — Blazor does this after event handlers
}
```

### ❌ Large Component Files

```razor
<!-- ❌ WRONG — 800-line razor file mixing markup and logic -->
@page "/orders"
<!-- 400 lines of markup -->
@code {
    // 400 lines of logic
}
```

```
// ✅ FIX — Split into .razor + .razor.cs
Orders.razor      → markup only (<200 lines)
Orders.razor.cs   → logic, DI, lifecycle
```

---

## EF Core Anti-Patterns

### ❌ N+1 Queries

```csharp
// ❌ WRONG — 1 query for orders + N queries for items
var orders = await ctx.Orders.ToListAsync();
foreach (var order in orders)
{
    order.Items = await ctx.Items.Where(i => i.OrderId == order.Id).ToListAsync();
}
```

```csharp
// ✅ FIX — Include or projection
var orders = await ctx.Orders
    .Include(o => o.Items)
    .AsSplitQuery()
    .ToListAsync();

// ✅ Better — project only what you need
var orders = await ctx.Orders
    .Select(o => new { o.Id, o.Code, ItemCount = o.Items.Count })
    .ToListAsync();
```

### ❌ Tracked Reads for Display

```csharp
// ❌ WRONG — tracking overhead for read-only display
var orders = await ctx.Orders.ToListAsync();
```

```csharp
// ✅ FIX
var orders = await ctx.Orders.AsNoTracking().ToListAsync();
```

### ❌ Loading Full Entities for Partial Data

```csharp
// ❌ WRONG — loads all 30 columns, blobs included
var orders = await ctx.Orders.ToListAsync();
var names = orders.Select(o => o.CustomerName);
```

```csharp
// ✅ FIX — project to DTO
var names = await ctx.Orders
    .AsNoTracking()
    .Select(o => o.CustomerName)
    .ToListAsync();
```

### ❌ Mixing View Queries with Date Filters

When views have built-in date filters that exclude data you need:

```csharp
// ❌ WRONG — view C4PedidosRepresentant may filter out old records
var order = await ctx.Set<C4View>()
    .Where(v => v.OrderId == id)
    .FirstOrDefaultAsync();
// Returns null for old orders!
```

```csharp
// ✅ FIX — fallback to base table
var order = await ctx.Set<C4View>()
    .Where(v => v.OrderId == id)
    .FirstOrDefaultAsync();

if (order is null)
{
    // Fallback to base table for historical data
    order = await ctx.Orders
        .AsNoTracking()
        .Where(o => o.Id == id)
        .Select(o => MapToViewDto(o))
        .FirstOrDefaultAsync();
}
```

---

## Dapper Anti-Patterns

See [dapper-data.md](dapper-data.md) for the full Dapper guide. Key gotchas in Blazor Server:

### ❌ Sync Dapper Calls

```csharp
// ❌ WRONG — blocks the circuit thread, freezes the UI
public Order? GetOrder(int id)
{
    using var conn = new SqlConnection(_connString);
    conn.Open();
    return conn.QueryFirstOrDefault<Order>(
        "SELECT * FROM Orders WHERE Id = @Id", new { id });
}
```

```csharp
// ✅ FIX — always *Async + CommandDefinition
public async Task<Order?> GetOrderAsync(int id, CancellationToken ct = default)
{
    await using var conn = await connectionFactory.CreateConnectionAsync(ct);
    return await conn.QueryFirstOrDefaultAsync<Order>(new CommandDefinition(
        "SELECT * FROM Orders WHERE Id = @Id",
        new { id },
        cancellationToken: ct));
}
```

### ❌ Connection Held for Circuit Lifetime

```csharp
// ❌ WRONG — SqlConnection lives for the whole circuit, exhausts the pool
public class OrderService
{
    private readonly SqlConnection _conn;
    public OrderService(IConfiguration cfg)
    {
        _conn = new SqlConnection(cfg.GetConnectionString("Default"));
        _conn.Open();
    }
}
```

```csharp
// ✅ FIX — short-lived connection per operation
public sealed class OrderService(IDbConnectionFactory<SqlConnection> factory)
{
    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        await using var conn = await factory.CreateConnectionAsync(ct);
        return await conn.QueryFirstOrDefaultAsync<Order>(/* ... */);
    }
}
```

### ❌ Returning Lazy `IEnumerable<T>` from the Service

```csharp
// ❌ WRONG — connection is disposed when method returns, enumeration throws
public async Task<IEnumerable<Order>> GetActiveAsync()
{
    await using var conn = await factory.CreateConnectionAsync();
    return conn.QueryAsync<Order>(sql); // un-materialized
}
```

```csharp
// ✅ FIX — materialize at the service boundary
public async Task<IReadOnlyList<Order>> GetActiveAsync(CancellationToken ct = default)
{
    await using var conn = await factory.CreateConnectionAsync(ct);
    var rows = await conn.QueryAsync<Order>(new CommandDefinition(sql, cancellationToken: ct));
    return rows.AsList();
}
```

### ❌ Forgetting `transaction: tx`

```csharp
// ❌ WRONG — second call runs OUTSIDE the transaction
await using var tx = await conn.BeginTransactionAsync(ct);
await conn.ExecuteAsync(updateSql, params, transaction: tx);
await conn.ExecuteAsync(historySql, params); // no tx → not atomic!
```

```csharp
// ✅ FIX — pass `transaction: tx` to every call
await conn.ExecuteAsync(new CommandDefinition(updateSql, params, transaction: tx, cancellationToken: ct));
await conn.ExecuteAsync(new CommandDefinition(historySql, params, transaction: tx, cancellationToken: ct));
```

### ❌ Raw SQL in Components

```razor
@* ❌ WRONG — Razor component reaches into the DB directly *@
@code {
    private async Task LoadAsync()
    {
        using var conn = new SqlConnection(...);
        _orders = (await conn.QueryAsync<Order>("SELECT ...")).ToList();
    }
}
```

```razor
@* ✅ FIX — call a service *@
@inject IOrderQueryService Orders

@code {
    private async Task LoadAsync()
    {
        _orders = await Orders.GetActiveAsync();
    }
}
```

### ❌ `SELECT *` with Dapper

```csharp
// ❌ WRONG — Dapper maps every column; later schema changes break the read
var order = await conn.QueryFirstOrDefaultAsync<Order>(
    "SELECT * FROM dbo.Orders WHERE Id = @Id", new { id });
```

```csharp
// ✅ FIX — project only the columns you need
var order = await conn.QueryFirstOrDefaultAsync<Order>(
    """SELECT Id, Code, Amount, Status, Created FROM dbo.Orders WHERE Id = @Id""",
    new { id });
```

---

## Async Anti-Patterns

### ❌ Blocking on Async

```csharp
// ❌ WRONG — deadlock in Blazor Server (SynchronizationContext)
var result = service.GetAsync().Result;
var result2 = service.GetAsync().GetAwaiter().GetResult();
service.SaveAsync().Wait();
```

```csharp
// ✅ FIX — async all the way
var result = await service.GetAsync();
await service.SaveAsync();
```

### ❌ Async Void

```csharp
// ❌ WRONG — exceptions are unobservable, crashes app
private async void HandleClick()
{
    await Service.ProcessAsync();
}
```

```csharp
// ✅ FIX — async Task (except for event handlers that require void)
private async Task HandleClick()
{
    await Service.ProcessAsync();
}
```

### ❌ Missing CancellationToken

```csharp
// ❌ WRONG — no way to cancel long operations when user navigates away
public async Task<List<Order>> SearchAsync(string query)
{
    await Task.Delay(5000); // Simulating slow query
    return await ctx.Orders.Where(o => o.Code.Contains(query)).ToListAsync();
}
```

```csharp
// ✅ FIX — pass CancellationToken
public async Task<List<Order>> SearchAsync(string query, CancellationToken ct = default)
{
    return await ctx.Orders
        .Where(o => o.Code.Contains(query))
        .ToListAsync(ct);
}
```

---

## DI Anti-Patterns

### ❌ Captive Dependency (Singleton captures Scoped)

```csharp
// ❌ WRONG — Singleton holds reference to Scoped service
public class CacheSingleton(OrderService orderService) // Scoped!
{
    // orderService will use a disposed/stale DbContext
}
```

```csharp
// ✅ FIX — Use IServiceScopeFactory
public class CacheSingleton(IServiceScopeFactory scopeFactory)
{
    public async Task RefreshAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<OrderService>();
        await service.RefreshCacheAsync();
    }
}
```

### ❌ new HttpClient()

```csharp
// ❌ WRONG — socket exhaustion
var client = new HttpClient();
var response = await client.GetAsync(url);
```

```csharp
// ✅ FIX — IHttpClientFactory or typed client
builder.Services.AddHttpClient<AgencyClient>(client =>
{
    client.BaseAddress = new Uri("https://api.mrw.es/");
})
.AddStandardResilienceHandler();
```

---

## SQL Server Anti-Patterns

### ❌ OR in JOINs (performance killer)

```sql
-- ❌ WRONG — optimizer can't use indexes efficiently
SELECT * FROM Orders o
JOIN Clients c ON o.ClientId = c.Id OR o.AltClientId = c.Id
```

```sql
-- ✅ FIX — UNION two clean queries
SELECT * FROM Orders o JOIN Clients c ON o.ClientId = c.Id
UNION ALL
SELECT * FROM Orders o JOIN Clients c ON o.AltClientId = c.Id
WHERE o.AltClientId IS NOT NULL
```

### ❌ Type Casting Mismatches

```csharp
// ❌ WRONG — tinyint → int throws InvalidCastException during materialization
.Select(o => new { Status = (int)o.EstatPedido }) // byte, not int!
```

```sql
-- ✅ FIX — explicit CAST in SQL
SELECT CAST(EstatPedido AS int) AS Status FROM Pedidos
```

### ❌ Missing Indexes on Filtered Columns

If you frequently filter or join on a column, it needs an index:

```sql
-- Check missing indexes
SELECT * FROM sys.dm_db_missing_index_details
WHERE database_id = DB_ID('JJP_CRM')
```

---

## UI Anti-Patterns (Blazor)

### ❌ Desktop Tables on Mobile

```razor
<!-- ❌ WRONG — compressed table unreadable on mobile -->
<table class="table table-sm" style="font-size: 0.7rem">
    <!-- 15 columns squeezed into 375px width -->
</table>
```

```razor
<!-- ✅ FIX — card layout for mobile -->
<div class="d-md-none">
    @foreach (var order in _orders)
    {
        <div class="card mb-2">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between">
                    <strong>@order.Code</strong>
                    <StatusBadge Status="@order.Status" />
                </div>
                <small class="text-muted">@order.Created.ToString("dd/MM")</small>
            </div>
        </div>
    }
</div>
<div class="d-none d-md-block">
    <!-- Desktop table here -->
</div>
```

### ❌ Multiple Status Icons with else-if

```csharp
// ❌ WRONG — only shows first matching status
@if (order.IsShipped) { <i class="bi-truck" /> }
else if (order.HasIncidence) { <i class="bi-exclamation" /> }
else if (order.IsValidated) { <i class="bi-check" /> }
// Order that is both shipped AND has incidence only shows truck!
```

```csharp
// ✅ FIX — independent @if for each status flag
@if (order.IsShipped) { <i class="bi-truck" /> }
@if (order.HasIncidence) { <i class="bi-exclamation text-warning" /> }
@if (order.IsValidated) { <i class="bi-check text-success" /> }
```
