# C# 14 Features (.NET 10)

## Extension Blocks

Replace traditional static extension methods with cleaner syntax:

```csharp
// ✅ C# 14 extension block
extension(IEnumerable<Order> orders)
{
    public decimal TotalAmount => orders.Sum(o => o.Amount);
    public bool HasPending => orders.Any(o => o.Status == OrderStatus.Pending);
    public IEnumerable<Order> Active() => orders.Where(o => !o.IsDeleted);
}

// ✅ Generic extension block
extension<T>(IEnumerable<T> source)
{
    public bool IsEmpty => !source.Any();
    public T? FirstOrNull() where T : struct => source.Any() ? source.First() : null;
}

// Usage reads naturally
var total = orders.TotalAmount;
var hasWork = orders.HasPending;
if (items.IsEmpty) { ... }
```

```csharp
// ❌ Old style — still works but prefer extension blocks for new code
public static class OrderExtensions
{
    public static decimal TotalAmount(this IEnumerable<Order> orders)
        => orders.Sum(o => o.Amount);
}
```

> **Container rule:** an `extension` block lives inside a `static class` (like classic extension methods). The block declares the receiver; the enclosing static class is what the compiler indexes:
>
> ```csharp
> public static class OrderExtensions
> {
>     extension(IEnumerable<Order> orders)
>     {
>         public decimal TotalAmount => orders.Sum(o => o.Amount);
>     }
> }
> ```

---

## `field` Keyword

Semi-auto properties — use backing field without declaring it:

```csharp
// ✅ Validation in setter
public string Name
{
    get => field;
    set => field = value?.Trim() ?? string.Empty;
}

// ✅ Lazy initialization
public List<Item> Items
{
    get => field ??= [];
    set => field = value ?? [];
}

// ✅ Change notification
public decimal Amount
{
    get => field;
    set
    {
        if (field == value) return;
        field = value;
        OnPropertyChanged();
    }
}
```

```csharp
// ❌ Old style — manual backing field
private string _name = string.Empty;
public string Name
{
    get => _name;
    set => _name = value?.Trim() ?? string.Empty;
}
```

---

## Null-Conditional Assignment

```csharp
// ✅ C# 14
order?.Notes = "Updated";
customer?.Address?.City = "Barcelona";

// ❌ Old style
if (order is not null)
    order.Notes = "Updated";
```

---

## Pattern Matching (C# 12-14)

```csharp
// Switch expressions
var description = order.Status switch
{
    OrderStatus.Pending => "Awaiting confirmation",
    OrderStatus.Confirmed when order.Amount > 1000 => "Large order confirmed",
    OrderStatus.Confirmed => "Order confirmed",
    OrderStatus.Shipped => $"Shipped via {order.Carrier}",
    _ => "Unknown status"
};

// Property patterns
if (order is { Status: OrderStatus.Shipped, Carrier: not null } shipped)
{
    await TrackShipment(shipped.Carrier);
}

// List patterns
var result = numbers switch
{
    [] => "empty",
    [var single] => $"one: {single}",
    [var first, .., var last] => $"from {first} to {last}",
};

// Relational patterns
var tier = amount switch
{
    < 100 => "Small",
    >= 100 and < 1000 => "Medium",
    >= 1000 => "Large"
};
```

---

## Primary Constructors

```csharp
// ✅ Services — captures DI parameters
public sealed class OrderService(
    IDbContextFactory<AppDbContext> contextFactory,
    ILogger<OrderService> logger)
{
    public async Task<Order?> GetAsync(int id, CancellationToken ct = default)
    {
        logger.LogDebug("Getting order {Id}", id);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        return await ctx.Orders.FindAsync([id], ct);
    }
}

// ✅ Records for immutable DTOs
public sealed record OrderSummary(
    int Id,
    string Code,
    decimal Amount,
    DateTime Created);

// ✅ Required members for mutable models
public class OrderModel
{
    public required string Code { get; set; }
    public required decimal Amount { get; set; }
    public string? Notes { get; set; }
}
```

---

## Collection Expressions

```csharp
// ✅ C# 12+ collection expressions
List<string> names = ["Alice", "Bob", "Carol"];
int[] numbers = [1, 2, 3, 4, 5];
ReadOnlySpan<byte> bytes = [0x00, 0xFF];

// Spread operator
int[] combined = [..firstArray, ..secondArray, 99];

// Empty collections
List<Order> empty = [];
```

---

## Async Patterns

```csharp
// ✅ IAsyncEnumerable for streaming
public async IAsyncEnumerable<Order> StreamOrdersAsync(
    [EnumeratorCancellation] CancellationToken ct = default)
{
    await using var ctx = await contextFactory.CreateDbContextAsync(ct);
    await foreach (var order in ctx.Orders.AsAsyncEnumerable().WithCancellation(ct))
    {
        yield return order;
    }
}

// ✅ ValueTask for hot paths that often complete synchronously
public ValueTask<Order?> GetCachedAsync(int id)
{
    if (_cache.TryGetValue(id, out var order))
        return ValueTask.FromResult<Order?>(order);
    return new ValueTask<Order?>(LoadFromDbAsync(id));
}

// ✅ CancellationToken everywhere
public async Task<List<Order>> SearchAsync(
    string query,
    CancellationToken ct = default)
{
    ct.ThrowIfCancellationRequested();
    // ...
}
```

---

## Nullable Reference Types

```csharp
// ✅ Injected services — use default! (DI guarantees non-null)
[Inject] private OrderService OrderService { get; set; } = default!;

// ✅ Nullable when it can be null
private Order? _selectedOrder;

// ✅ Null guards
public void Process(Order? order)
{
    ArgumentNullException.ThrowIfNull(order);
    // order is non-null here
}

// ✅ Null-forgiving only when you KNOW it's safe
var name = user!.Name; // Only if null is truly impossible

// ✅ Pattern-based null checks
if (order is { Customer.Name: var name })
{
    logger.LogInfo("Customer: {Name}", name);
}
```
