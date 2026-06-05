---
name: blazor-dotnet10
description: >
  Best practices para Blazor Server .NET 10.0.8 (SDK 10.0.300), C# 14, EF Core y SQL Server.
  Usar cuando: trabajar en componentes Blazor Server, acceso a datos con EF Core,
  arquitectura de servicios, o proyectos .NET 10. Diferente de razor-dotnet10 — este skill
  cubre el modelo de circuito Blazor Server, no HTTP request/response.
  Triggers: componentes Blazor, @code, EditForm, StateHasChanged, IDbContextFactory, DbContext,
  inyección de dependencias en Blazor, ciclo de vida de componentes, SignalR, FILESTREAM,
  SQL Server, Result<T>, Extct.DTO, revisar async en Blazor, diseñar servicios .NET 10.
license: MIT
---

# Blazor Server .NET 10 & C# 14 — Best Practices

**.NET 10.0.8** (LTS, Nov 2025) with **SDK 10.0.300** and **C# 14**.
Focused on **Blazor Server** (not Minimal APIs/MVC).

## Versions

| Component | Version |
|-----------|---------|
| .NET Runtime | 10.0.8 |
| .NET SDK | 10.0.300 |
| C# | 14 |
| TargetFramework | `net10.0` |
| LangVersion | `14` |

> SDK 10.0.300 is the banded SDK that ships 10.0.8 — pin your `global.json` to it for reproducible builds.

## Reference Files

| File | When to read |
|------|-------------|
| [blazor-server.md](references/blazor-server.md) | Component lifecycle, parameters, StateHasChanged, forms, render modes, SignalR, ErrorBoundary, streaming rendering |
| [csharp-14.md](references/csharp-14.md) | Extension blocks, `field` keyword, null-conditional assignment, pattern matching |
| [ef-core-data.md](references/ef-core-data.md) | DbContext, IDbContextFactory, queries, FILESTREAM, transactions, migrations |
| [dapper-data.md](references/dapper-data.md) | IDbConnectionFactory, async Dapper, multi-mapping, transactions, type handlers, Dapper vs EF Core |
| [quickgrid.md](references/quickgrid.md) | `<QuickGrid>` columns, sort, pagination, ItemsProvider, virtualization, filtering |
| [auth.md](references/auth.md) | `AuthenticationStateProvider`, `AuthorizeView`, `[Authorize]`, policies, resource-based auth |
| [persistent-state.md](references/persistent-state.md) | `PersistentComponentState` for prerender → interactive handoff |
| [hybrid-cache.md](references/hybrid-cache.md) | L1+L2 cache, `GetOrCreateAsync<T>`, tags, stampede protection |
| [resilience.md](references/resilience.md) | Polly v8, `AddStandardResilienceHandler`, retry/circuit-breaker/timeout for HTTP and Dapper |
| [health-checks.md](references/health-checks.md) | `/health/live` vs `/health/ready`, SQL/EF/Redis checks, custom `IHealthCheck` |
| [anti-patterns.md](references/anti-patterns.md) | Common mistakes in Blazor Server, EF Core, Dapper, async, DI |

Read the relevant reference file before implementing. For quick patterns, use this file.

---

## Project Setup

### Pin SDK with `global.json`

Place at repo root to lock the SDK to **10.0.300** for reproducible builds:

```json
{
  "sdk": {
    "version": "10.0.300",
    "rollForward": "latestFeature"
  }
}
```

### Shared MSBuild properties (`Directory.Build.props`)

Place at repo root to apply consistent settings across every project in the solution (each `.csproj` inherits these automatically):

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <WarningsNotAsErrors>CS1591</WarningsNotAsErrors>  <!-- missing XML doc; noisy -->
    <InvariantGlobalization>false</InvariantGlobalization>
    <AnalysisLevel>latest</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
  </PropertyGroup>
</Project>
```

> The per-project `.csproj` can still override any of these. `Directory.Build.props` removes duplication and makes upgrades (e.g. new SDK) a one-line change.

### Project file (`Microsoft.NET.Sdk.Web`)

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <!-- Optional: pin runtime to 10.0.8 for self-contained/published apps -->
    <RuntimeFrameworkVersion>10.0.8</RuntimeFrameworkVersion>
  </PropertyGroup>

  <ItemGroup>
    <!-- EF Core + SQL Server (for domain + Identity if used) -->
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.*" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="10.*" PrivateAssets="all" />

    <!-- Dapper + modern SqlClient -->
    <PackageReference Include="Dapper" Version="2.*" />
    <PackageReference Include="Microsoft.Data.SqlClient" Version="6.*" />

    <!-- HybridCache (L1 + optional L2 + stampede protection) -->
    <PackageReference Include="Microsoft.Extensions.Caching.Hybrid" Version="10.*" />

    <!-- Resilience (Polly v8 integrated) -->
    <PackageReference Include="Microsoft.Extensions.Http.Resilience" Version="10.*" />
    <!-- For non-HTTP pipelines (Dapper etc.) -->
    <PackageReference Include="Microsoft.Extensions.Resilience" Version="10.*" />

    <!-- QuickGrid is built-in with Microsoft.AspNetCore.Components.QuickGrid (no extra package) -->
  </ItemGroup>
</Project>
```

> `TargetFramework` stays `net10.0` (a floating major). `RuntimeFrameworkVersion` is what pins the **runtime** patch to `10.0.8`; `global.json` pins the **SDK** band to `10.0.300`. Use both when reproducibility matters.
>
> For full modern structure (`.slnx`, `Directory.Build.props`, central package management via `Directory.Packages.props`, SourceLink, RELEASE_NOTES.md), see the `dotnet-project-structure` skill.

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

## Data Access: Dapper

For raw SQL, reporting, stored procedures, and hot read paths, use **Dapper** alongside EF Core. See [dapper-data.md](references/dapper-data.md) for the full guide.

```csharp
// ✅ Dapper with IDbConnectionFactory<SqlConnection> (per-operation connections via custom factory)
public sealed class OrderQueryService(
    IDbConnectionFactory<SqlConnection> connectionFactory,
    ILogger<OrderQueryService> logger)
{
    public async Task<IReadOnlyList<OrderDto>> GetActiveAsync(CancellationToken ct = default)
    {
        await using var conn = await connectionFactory.CreateConnectionAsync(ct);

        const string sql = """
            SELECT Id, Code, Amount, Status, Created
            FROM   dbo.Orders
            WHERE  Status = @Active
            ORDER  BY Created DESC
            """;

        var rows = await conn.QueryAsync<OrderDto>(
            new CommandDefinition(sql, new { Active = "Active" }, cancellationToken: ct));
        return rows.AsList();
    }
}

// Registration (see dapper-data.md for the SqlConnectionFactory implementation)
builder.Services.AddSingleton<IDbConnectionFactory<SqlConnection>>(sp =>
    new SqlConnectionFactory(
        sp.GetRequiredService<IConfiguration>().GetConnectionString("Default")!,
        sp.GetRequiredService<ILogger<SqlConnectionFactory>>()));
builder.Services.AddScoped<OrderQueryService>();
```

> **The cardinal rule**: in Blazor Server, **always** use the `*Async` Dapper methods (`QueryAsync`, `ExecuteAsync`, `QueryFirstOrDefaultAsync`, …) and pass `CommandDefinition` with `cancellationToken: ct`. Sync calls block the circuit thread and freeze the UI.

```csharp
// ❌ NEVER — sync Dapper call blocks the Blazor circuit
public OrderDto? GetById(int id)
{
    using var conn = new SqlConnection(_connString);
    conn.Open();
    return conn.QueryFirstOrDefault<OrderDto>("SELECT ... WHERE Id = @Id", new { id });
}
```

### Dapper vs EF Core — at a glance

| Scenario | Pick |
|----------|------|
| Domain model, change tracking, migrations, code-first | **EF Core** |
| Complex aggregates + `Include` graph | **EF Core** |
| Cross-database portability | **EF Core** |
| Reporting, complex analytical SQL, stored procedures | **Dapper** |
| Hot read paths, microsecond-sensitive reads | **Dapper** |
| Bulk insert/update/delete | **Dapper** |
| Multi-result sets, dynamic queries | **Dapper** |
| Mix | **EF for writes, Dapper for reads** |

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

> **About `Extct.DTO`**: this is an **internal Scopweb package** (not on nuget.org) shipped via the organization's private feed. It provides `Result<T>` with `Success`/`SuccessM`/`Failure`/`FailureM` factories and a `Message` channel for UI feedback. If you're outside that org, swap in your own equivalent (`OneOf`, `ErrorOr`, `Ardalis.Result`, or a 30-line home-grown record) — the rest of the skill still applies.

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

### QuickGrid (built-in, no extra package)

```razor
@using Microsoft.AspNetCore.Components.QuickGrid

<Paginator State="@_pagination" />
<QuickGrid Items="@_orders.AsQueryable()" Pagination="@_pagination">
    <PropertyColumn Property="@(o => o.Code)" Sortable="true" />
    <PropertyColumn Property="@(o => o.Amount)" Format="C" Sortable="true" />
    <TemplateColumn Title="Status">
        <StatusBadge Status="@context.Status" />
    </TemplateColumn>
</QuickGrid>

@code {
    private IReadOnlyList<OrderDto> _orders = Array.Empty<OrderDto>();
    private readonly PaginationState _pagination = new() { ItemsPerPage = 25 };
}
```

> For **>1k rows** use `ItemsProvider` + `Virtualize="true"` and push paging/sorting to the database — see [quickgrid.md](references/quickgrid.md).

### Authentication & Authorization

```razor
@* Page-level gate *@
@page "/admin"
@attribute [Authorize(Policy = "AdminOnly")]

@* Conditional UI *@
<AuthorizeView>
    <Authorized><p>Hola, @context.User.Identity!.Name</p></Authorized>
    <NotAuthorized><a href="/login">Sign in</a></NotAuthorized>
</AuthorizeView>
```

```csharp
// Program.cs
builder.Services.AddCascadingAuthenticationState();
builder.Services.AddAuthentication(IdentityConstants.ApplicationCookie).AddApplicationCookie();
builder.Services.AddAuthorization(o => o.AddPolicy("AdminOnly", p => p.RequireRole("Admin")));
```

> UI check + service check + data query with `Where(TenantId == user.TenantId)`. **Never** rely on a UI-only check — see [auth.md](references/auth.md).

### `PersistentComponentState` (prerender → interactive handoff)

```razor
@implements IDisposable
@inject PersistentComponentState State
@inject OrderService OrderService

@code {
    private List<OrderDto> _orders = new();
    private PersistingComponentStateSubscription? _sub;

    protected override async Task OnInitializedAsync()
    {
        _sub = State.RegisterOnPersisting(PersistAsync);

        if (!State.TryTakeFromJson<List<OrderDto>>("orders", out var saved))
            _orders = await OrderService.GetAllAsync();
        else
            _orders = saved!;
    }

    private Task PersistAsync() => State.PersistAsJsonAsync("orders", _orders);
    public void Dispose() => _sub?.Dispose();
}
```

> Without this, data is fetched **twice** (prerender + circuit). See [persistent-state.md](references/persistent-state.md).

### HybridCache (L1 + L2 + stampede protection)

Requires package `Microsoft.Extensions.Caching.Hybrid` (see Project Setup above).

```csharp
public sealed class OrderService(
    HybridCache cache,
    IDbConnectionFactory<SqlConnection> factory)
{
    public async ValueTask<OrderDto?> GetByIdAsync(int id, CancellationToken ct = default)
        => await cache.GetOrCreateAsync<OrderDto?>(
            key: $"order:{id}",
            factory: async token =>
            {
                await using var conn = await factory.CreateConnectionAsync(token);
                return await conn.QueryFirstOrDefaultAsync<OrderDto>(/*...*/);
            },
            options: new HybridCacheEntryOptions { Expiration = TimeSpan.FromMinutes(10) },
            cancellationToken: ct);
}
```

```csharp
// Program.cs
builder.Services.AddHybridCache();                       // L1 only
// or
builder.Services.AddStackExchangeRedisCache(/*...*/);
builder.Services.AddHybridCache();                       // L1 + L2
```

> Invalidate by tag when source changes: `await cache.RemoveByTagAsync("orders", ct);` — see [hybrid-cache.md](references/hybrid-cache.md).

### Resilience (Polly v8 via `Microsoft.Extensions.Http.Resilience`)

```csharp
builder.Services.AddHttpClient<ExternalApiClient>(c =>
{
    c.BaseAddress = new Uri("https://api.example.com");
})
.AddStandardResilienceHandler();   // retry + circuit breaker + timeout, sensible defaults
```

For non-HTTP (Dapper, EF):

```csharp
builder.Services.AddResiliencePipeline("dapper-read", b =>
{
    b.AddRetry(new RetryStrategyOptions
    {
        MaxRetryAttempts = 3,
        ShouldHandle = new PredicateBuilder().Handle<SqlException>(ex => ex.Number is 1205 or 1222)
    });
    b.AddTimeout(TimeSpan.FromSeconds(10));
});
```

> **Never** retry a non-idempotent operation (no idempotency key). See [resilience.md](references/resilience.md).

### Health Checks (`/health/live` vs `/health/ready`)

```csharp
builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("Default")!, tags: new[] { "ready" })
    .AddDbContextCheck<AppDbContext>("ef", tags: new[] { "ready" });

app.MapHealthChecks("/health/live",  new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = c => c.Tags.Contains("ready") });
```

> `/health/live` is "is the process up?" — **never** check the DB there. `/health/ready` is "can it serve?" — DB / cache / external deps go here. See [health-checks.md](references/health-checks.md).

### ErrorBoundary

```razor
<ErrorBoundary @ref="_boundary">
    <ChildContent><RiskyComponent /></ChildContent>
    <ErrorContent>
        <div class="alert alert-danger">
            <p>Error: @context.Message</p>
            <button @onclick="() => _boundary.Recover()">Retry</button>
        </div>
    </ErrorContent>
</ErrorBoundary>
```

> Catch in render tree, not in event handlers (wrap those in try/catch). Wrap the **whole app** at the router level. See the **ErrorBoundary** section in [blazor-server.md](references/blazor-server.md).

### Streaming Rendering

```razor
@page "/dashboard"
@attribute [StreamRendering]

@if (_stats is null) { <p>Cargando...</p> }
else { <DashboardGrid Stats="_stats" /> }
```

> Default for `InteractiveServer` in .NET 8+. The page is sent immediately with a placeholder, then delta-rendered when the load finishes. Combine with `PersistentComponentState` to avoid re-fetching.

---

## MANDATORY Patterns

| Task | ✅ ALWAYS | ❌ NEVER |
|------|----------|---------|
| Service returns | `Result<T>` from `Extct.DTO` | Throwing exceptions for domain errors |
| Data access (EF) | Service + `IDbContextFactory<AppDbContext>` | `DbContext` in component |
| Data access (Dapper) | Service + `IDbConnectionFactory<SqlConnection>` + `*Async` methods | Sync `Query`/`Execute` or `new SqlConnection` in component |
| Dapper queries | `CommandDefinition` with `cancellationToken: ct` | Dapper call without `CancellationToken` |
| Dapper results | `.AsList()` / `.ToList()` at service boundary | Return lazy `IEnumerable<T>` from service |
| Read queries | `.AsNoTracking()` (EF) / `QueryAsync` (Dapper) | Tracked reads for display |
| Caching | `HybridCache.GetOrCreateAsync<T>` | Raw `IMemoryCache` for shared state |
| Prerender state | `PersistentComponentState.RegisterOnPersisting` | Loading the same data twice (prerender + circuit) |
| Authorization | Service check + `[Authorize]` on page + data filter by tenant | UI-only check; trusting client claims |
| HTTP resilience | `AddHttpClient(...).AddStandardResilienceHandler()` | `new HttpClient()`, manual retry loops |
| Health checks | `/health/live` (no deps) + `/health/ready` (DB+cache) | DB checks in `/live` |
| Grids >1k rows | `ItemsProvider` + `Virtualize="true"` | In-memory `IQueryable` for the whole table |
| Component params | `[Parameter, EditorRequired]` | `[Parameter]` without default |
| Forms | `<EditForm>` | HTML `<form>` |
| External callbacks | `InvokeAsync(() => StateHasChanged())` | Direct `StateHasChanged()` |
| Error handling (render) | Wrap in `<ErrorBoundary>` at app level | Unhandled exception → yellow screen of death |
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

### Data Access (EF Core vs Dapper)

```
Need to read/write?
  ├── Domain model + change tracking + migrations → EF Core (IDbContextFactory)
  ├── Complex analytical SQL / reporting          → Dapper (IDbConnectionFactory)
  ├── Stored procedures                           → Dapper
  ├── Bulk insert/update/delete                   → Dapper (+ SqlBulkCopy / Dapper.Contrib)
  ├── Hot read path on a critical list/detail     → Dapper
  └── Mixed                                        → EF Core (writes) + Dapper (reads) on same DB
Connection lifetime?
  └── ALWAYS short-lived per operation — never hold a connection/Context across the circuit
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