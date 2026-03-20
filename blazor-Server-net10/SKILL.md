---
name: blazor-dotnet10
description: >
  Best practices para Blazor Server .NET 10, C# 14, EF Core y SQL Server.
  Usar cuando: trabajar en componentes Blazor Server, acceso a datos con EF Core,
  arquitectura de servicios, o proyectos .NET 10. Diferente de razor-dotnet10 — este skill
  cubre el modelo de circuito Blazor Server, no HTTP request/response.
  Triggers: componentes Blazor, @code, EditForm, StateHasChanged, IDbContextFactory, DbContext,
  inyección de dependencias en Blazor, ciclo de vida de componentes, SignalR, FILESTREAM,
  SQL Server, Result<T>, Extct.DTO, revisar async en Blazor, diseñar servicios .NET 10.
license: MIT
---

# Blazor Server .NET 10 & C# 14 — Best Practices

.NET 10 (LTS, Nov 2025) with C# 14. Focused on **Blazor Server** (not Minimal APIs/MVC).

## Reference Files

| File | When to read |
|------|-------------|
| [blazor-server.md](references/blazor-server.md) | Component lifecycle, parameters, StateHasChanged, forms, render modes, SignalR |
| [csharp-14.md](references/csharp-14.md) | Extension blocks, `field` keyword, null-conditional assignment, pattern matching |
| [ef-core-data.md](references/ef-core-data.md) | DbContext, IDbContextFactory, queries, FILESTREAM, transactions, migrations |
| [anti-patterns.md](references/anti-patterns.md) | Common mistakes in Blazor Server, EF Core, async, DI |

Read the relevant reference file before implementing. For quick patterns, use this file.

---

## Project Setup

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14</LangVersion>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
```

---

## Architecture: Service Pattern

Never access DbContext directly from components. Always use services.

```csharp
// ✅ Service with IDbContextFactory (Blazor Server safe)
public sealed class OrderService(
    IDbContextFactory<AppDbContext> contextFactory,
    ILogger<OrderService> logger)
{
    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        await using var context = await contextFactory.CreateDbContextAsync(ct);
        return await context.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == id, ct);
    }
}

// ✅ Registration
builder.Services.AddDbContextFactory<AppDbContext>(options =>
    options.UseSqlServer(connectionString));
builder.Services.AddScoped<OrderService>();
```

```csharp
// ❌ NEVER: DbContext directly in component
@inject AppDbContext Context
// ❌ NEVER: Singleton DbContext
builder.Services.AddSingleton<AppDbContext>();
```

**Why IDbContextFactory?** Blazor Server shares a single connection per circuit. DbContext is not thread-safe. The factory creates short-lived contexts per operation, avoiding concurrency issues.

---

## Component Structure

```
Components/
├── Pages/           # Routable pages (@page)
├── Shared/          # Reusable components
├── Layout/          # MainLayout, NavMenu
└── Account/         # Auth components
```

Rules:
- Max **500 lines** per .razor file
- Split to `.razor` + `.razor.cs` if logic exceeds ~100 lines
- Use `[Parameter, EditorRequired]` with sensible defaults
- Dispose resources: implement `IAsyncDisposable`

```csharp
// ✅ Component code-behind pattern
public partial class OrderDetail : ComponentBase, IAsyncDisposable
{
    [Parameter, EditorRequired]
    public int OrderId { get; set; }

    [Inject] private OrderService OrderService { get; set; } = default!;

    private Order? _order;
    private CancellationTokenSource _cts = new();

    protected override async Task OnParametersSetAsync()
    {
        _order = await OrderService.GetByIdAsync(OrderId, _cts.Token);
    }

    public async ValueTask DisposeAsync()
    {
        await _cts.CancelAsync();
        _cts.Dispose();
    }
}
```

---

## Quick Patterns

### Async + StateHasChanged

```csharp
// ✅ External callback (Timer, event, SignalR)
private async Task OnExternalEvent(string data)
{
    await InvokeAsync(() =>
    {
        _message = data;
        StateHasChanged();
    });
}

// ✅ After async load — Blazor calls StateHasChanged automatically after lifecycle
protected override async Task OnInitializedAsync()
{
    _items = await ItemService.GetAllAsync();
    // No need for StateHasChanged() here
}
```

### Forms (Blazor, not HTML)

```razor
<!-- ✅ Always use Blazor forms -->
<EditForm Model="_model" OnValidSubmit="HandleSubmit" FormName="OrderForm">
    <DataAnnotationsValidator />
    <InputText @bind-Value="_model.Name" />
    <ValidationMessage For="() => _model.Name" />
    <button type="submit">Save</button>
</EditForm>

<!-- ❌ NEVER use HTML forms in Blazor -->
<form action="/submit">...</form>
```

### DI Lifetimes in Blazor Server

| Lifetime | Scope in Blazor Server | Use for |
|----------|----------------------|---------|
| Singleton | App-wide, all circuits | Config, caches, HttpClientFactory |
| Scoped | Per circuit (≈ per user session) | Services, state containers |
| Transient | Per injection | Lightweight, stateless helpers |

**Caution**: Scoped in Blazor Server ≠ Scoped in HTTP. A circuit lives for the entire browser session, not per request.

### C# 14 Highlights

```csharp
// field keyword — no manual backing fields
public string Name
{
    get => field;
    set => field = value?.Trim() ?? string.Empty;
}

// Extension blocks
extension(IEnumerable<Order> orders)
{
    public decimal TotalAmount => orders.Sum(o => o.Amount);
    public bool HasPending => orders.Any(o => o.Status == OrderStatus.Pending);
}

// Null-conditional assignment
order?.Notes = "Updated";

// Pattern matching with switch expressions
var icon = order.Status switch
{
    OrderStatus.Pending => "bi-clock",
    OrderStatus.Confirmed => "bi-check",
    OrderStatus.Shipped => "bi-truck",
    _ => "bi-question"
};
```

### Code Style

```csharp
// ✅ Primary constructors for services
public sealed class ProductService(
    IDbContextFactory<AppDbContext> contextFactory,
    ILogger<ProductService> logger) : IProductService
{
    // ...
}

// ✅ Records for DTOs
public sealed record OrderDto(int Id, string Code, decimal Amount, DateTime Created);

// ✅ Expression-bodied when simple
public string FullName => $"{FirstName} {LastName}";

// ✅ CancellationToken on all async methods
public async Task<List<Order>> GetActiveAsync(CancellationToken ct = default)

// ✅ ArgumentException guards
ArgumentException.ThrowIfNullOrWhiteSpace(code);
ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id);
```

### Result Pattern (`Extct.DTO.Result<T>`)

All service methods return `Result<T>` — no exceptions for domain errors.

```csharp
// Namespace: Extct.DTO
// Factory methods:
Result<T>.Success(value)              // OK, no message
Result<T>.SuccessM(value, message)    // OK + message for UI feedback
Result<T>.Failure(error)              // Error, no message
Result<T>.FailureM(error, message)    // Error + message for UI feedback

// ✅ Service returning Result<T>
public async Task<Result<Order>> GetOrderAsync(int id, CancellationToken ct = default)
{
    await using var ctx = await contextFactory.CreateDbContextAsync(ct);
    var order = await ctx.Orders.AsNoTracking()
        .FirstOrDefaultAsync(o => o.Id == id, ct);

    return order is not null
        ? Result<Order>.Success(order)
        : Result<Order>.Failure("Order not found");
}

// ✅ Service with validation + message
public async Task<Result<bool>> ValidateOrderAsync(int id, CancellationToken ct = default)
{
    // ... validation logic
    if (hasErrors)
        return Result<bool>.FailureM("Validation failed", "Missing required fields");

    return Result<bool>.SuccessM(true, "Order validated successfully");
}

// ✅ Consuming in component
var result = await OrderService.GetOrderAsync(id);
if (result.IsSuccess)
{
    _order = result.Value;
    if (!string.IsNullOrEmpty(result.Message))
        _toast = result.Message; // Show feedback
}
else
{
    _errorMessage = result.Error;
}
```

> **Legacy**: `Respuesta<T>` exists but is deprecated — always use `Result<T>` for new code.

---

## MANDATORY Patterns

| Task | ✅ ALWAYS | ❌ NEVER |
|------|----------|---------|
| Service returns | `Result<T>` from `Extct.DTO` | Throwing exceptions for domain errors |
| Data access | Service + IDbContextFactory | DbContext in component |
| Read queries | `.AsNoTracking()` | Tracked reads for display |
| Component params | `[Parameter, EditorRequired]` | `[Parameter]` without default |
| Forms | `<EditForm>` | HTML `<form>` |
| External callbacks | `InvokeAsync(() => StateHasChanged())` | Direct `StateHasChanged()` |
| Nullable | Initialize all, `= default!` for injected | Leave nullable warnings |
| Timestamps | `DateTime.UtcNow` | `DateTime.Now` |
| HttpClient | Inject or `IHttpClientFactory` | `new HttpClient()` |
| Async | `await` all the way | `.Result` or `.Wait()` |
| Disposal | `IAsyncDisposable` for CTS/timers | Forget to dispose |
| Long files | Split `.razor` + `.razor.cs` | 500+ line .razor files |

---

## Decision Flowcharts

### State Management

```
Need state? → Single component → private field
           → Parent-child → [Parameter] + EventCallback
           → Sibling/cross-component → Scoped service + event
           → Persist across navigation → Scoped service (circuit lifetime)
           → Persist across sessions → Database
```

### Error Handling

```
Error type? → Expected domain error → Result<T> (Extct.DTO)
           → Infrastructure failure → Exception + try/catch in component
           → Validation → DataAnnotations + EditForm
           → UI display → ErrorBoundary component
```

### IOptions Selection

```
Need runtime changes? → No → IOptions<T>
                      → Yes → Need per-request? → Yes → IOptionsSnapshot<T>
                                                → No  → IOptionsMonitor<T> + OnChange()
```