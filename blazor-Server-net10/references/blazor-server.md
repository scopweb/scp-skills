# Blazor Server Patterns

## Component Lifecycle

Execution order:
1. `SetParametersAsync` — raw parameter assignment
2. `OnInitialized[Async]` — first render only
3. `OnParametersSet[Async]` — every parameter change
4. `OnAfterRender[Async](firstRender)` — after DOM update

```csharp
// ✅ Load data on init, reload on parameter change
protected override async Task OnInitializedAsync()
{
    // One-time setup (subscriptions, initial config)
    _config = await ConfigService.LoadAsync();
}

protected override async Task OnParametersSetAsync()
{
    // Runs on every parameter change — reload data here
    _order = await OrderService.GetByIdAsync(OrderId);
}

protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (firstRender)
    {
        // JS interop, DOM manipulation — only after render
        await JSRuntime.InvokeVoidAsync("initTooltips");
    }
}
```

### When to use each

| Method | Use for | Runs |
|--------|---------|------|
| `OnInitializedAsync` | One-time setup, subscriptions | Once |
| `OnParametersSetAsync` | Data load based on parameters | Every param change |
| `OnAfterRenderAsync` | JS interop, DOM access | After each render |
| `Dispose/DisposeAsync` | Cleanup timers, CTS, subscriptions | Circuit end |

---

## Parameters and Communication

### Parent → Child

```csharp
// Child component
[Parameter, EditorRequired]
public int OrderId { get; set; }

[Parameter]
public string CssClass { get; set; } = string.Empty;

[Parameter]
public RenderFragment? ChildContent { get; set; }
```

### Child → Parent (EventCallback)

```csharp
// Child
[Parameter]
public EventCallback<Order> OnOrderSelected { get; set; }

private async Task SelectOrder(Order order)
{
    await OnOrderSelected.InvokeAsync(order);
}

// Parent
<OrderList OnOrderSelected="HandleOrderSelected" />
```

### Cascading Values

```csharp
// Provider (Layout or parent)
<CascadingValue Value="_currentUser" Name="CurrentUser">
    @Body
</CascadingValue>

// Consumer (any descendant)
[CascadingParameter(Name = "CurrentUser")]
public UserInfo CurrentUser { get; set; } = default!;
```

Use cascading parameters sparingly — they trigger re-renders on all descendants when the value changes.

---

## StateHasChanged Rules

Blazor automatically calls `StateHasChanged` after:
- Lifecycle methods (`OnInitialized`, `OnParametersSet`)
- `EventCallback` invocations
- UI event handlers (`@onclick`, `@onchange`)

You MUST call it manually when:
- External events (Timer.Elapsed, custom events, SignalR hub callbacks)
- Background task completion
- State changed outside Blazor's rendering pipeline

```csharp
// ✅ Timer callback — must use InvokeAsync
private Timer? _timer;

protected override void OnInitialized()
{
    _timer = new Timer(_ => InvokeAsync(() =>
    {
        _elapsed++;
        StateHasChanged();
    }), null, 1000, 1000);
}

// ✅ Service event subscription
protected override void OnInitialized()
{
    NotificationService.OnChange += HandleNotification;
}

private async Task HandleNotification()
{
    await InvokeAsync(StateHasChanged);
}

public void Dispose()
{
    NotificationService.OnChange -= HandleNotification;
    _timer?.Dispose();
}
```

**Critical**: Never call `StateHasChanged()` directly from a non-UI thread. Always wrap in `InvokeAsync`. Blazor Server uses SignalR — the render must happen on the synchronization context.

---

## Forms and Validation

```razor
<EditForm Model="_model" OnValidSubmit="HandleSubmit" FormName="CreateOrder">
    <DataAnnotationsValidator />
    <ValidationSummary />

    <div class="mb-3">
        <label>Code</label>
        <InputText @bind-Value="_model.Code" class="form-control" />
        <ValidationMessage For="() => _model.Code" />
    </div>

    <div class="mb-3">
        <label>Amount</label>
        <InputNumber @bind-Value="_model.Amount" class="form-control" />
    </div>

    <div class="mb-3">
        <label>Date</label>
        <InputDate @bind-Value="_model.Date" class="form-control" />
    </div>

    <div class="mb-3">
        <InputSelect @bind-Value="_model.Status" class="form-select">
            @foreach (var status in Enum.GetValues<OrderStatus>())
            {
                <option value="@status">@status</option>
            }
        </InputSelect>
    </div>

    <button type="submit" disabled="@_saving">
        @(_saving ? "Saving..." : "Save")
    </button>
</EditForm>

@code {
    private OrderModel _model = new();
    private bool _saving;

    private async Task HandleSubmit()
    {
        _saving = true;
        try
        {
            await OrderService.CreateAsync(_model);
            NavigationManager.NavigateTo("/orders");
        }
        finally
        {
            _saving = false;
        }
    }
}
```

### Custom Validation

```csharp
public class OrderModel
{
    [Required(ErrorMessage = "Code is required")]
    [StringLength(20, MinimumLength = 5)]
    public string Code { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be positive")]
    public decimal Amount { get; set; }

    public DateTime Date { get; set; } = DateTime.UtcNow;
}
```

---

## SignalR Considerations (Blazor Server)

Blazor Server runs on SignalR. Key implications:

1. **Connection loss** = UI dies. Handle gracefully:
```razor
<!-- In MainLayout or App.razor -->
<div id="reconnect-modal" style="display:none">
    Reconnecting to server...
</div>
```

2. **Circuit timeout**: Default 3 minutes disconnected. Configure (modern .NET 8+/10 Blazor Server):
```csharp
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents(options =>
    {
        options.DisconnectedCircuitRetentionPeriod = TimeSpan.FromMinutes(5);
        options.JSInteropDefaultCallTimeout = TimeSpan.FromSeconds(30);
    });
```
(See also `blazor-security-audit` skill for full hardening + `AddInteractiveServerRenderMode()` on the endpoint.)

3. **Large payloads**: Avoid sending large data through SignalR. Stream or paginate.

4. **Concurrent access**: A circuit processes events sequentially, but service calls can overlap if the user clicks fast. Use `SemaphoreSlim` for critical sections:
```csharp
private readonly SemaphoreSlim _semaphore = new(1, 1);

private async Task HandleClick()
{
    if (!await _semaphore.WaitAsync(0)) return; // skip if already processing
    try
    {
        await DoWorkAsync();
    }
    finally
    {
        _semaphore.Release();
    }
}
```

---

## JS Interop

```csharp
// ✅ Call JS from C#
await JSRuntime.InvokeVoidAsync("console.log", "Hello from Blazor");
var width = await JSRuntime.InvokeAsync<int>("getWindowWidth");

// ✅ Call C# from JS (use [JSInvokable])
[JSInvokable]
public async Task ReceiveFromJS(string data)
{
    _receivedData = data;
    await InvokeAsync(StateHasChanged);
}

// ✅ Dispose JS references
public async ValueTask DisposeAsync()
{
    if (_jsModule is not null)
    {
        await _jsModule.DisposeAsync();
    }
}
```

---

## Localization Pattern

For multi-language support (es, ca, en, fr):

```csharp
// Inject localizer
[Inject] private IStringLocalizer<OrderDetail> L { get; set; } = default!;

// Use in markup
<h3>@L["OrderTitle"]</h3>
<p>@L["OrderDescription", _order.Code]</p>
```

Resource files: `Resources/Components/Pages/OrderDetail.es.resx`, `.ca.resx`, `.en.resx`, `.fr.resx`

---

## ErrorBoundary

`<ErrorBoundary>` catches unhandled exceptions in its child render tree and renders a fallback. Without it, an exception in any component tears down the entire app and shows the yellow "An unhandled exception has occurred" page.

```razor
<ErrorBoundary @ref="_boundary">
    <ChildContent>
        <ComponentThatMightThrow />
    </ChildContent>
    <ErrorContent>
        <div class="alert alert-danger">
            <h4>Algo ha fallado</h4>
            <p>@context.Message</p>
            <button class="btn btn-sm btn-secondary"
                    @onclick="() => _boundary.Recover()">
                Reintentar
            </button>
        </div>
    </ErrorContent>
</ErrorBoundary>

@code {
    private ErrorBoundary _boundary = default!;
}
```

### App-level boundary (in `App.razor` or `Routes.razor`)

```razor
<ErrorBoundary>
    <ChildContent>
        <Router AppAssembly="@typeof(App).Assembly">
            <Found Context="routeData">
                <RouteView RouteData="@routeData" DefaultLayout="@typeof(Layout.MainLayout)" />
            </Found>
        </Router>
    </ChildContent>
    <ErrorContent Context="ex">
        <p class="text-danger">App error: @ex.Message</p>
    </ErrorContent>
</ErrorBoundary>
```

### Recover vs Reset

- `ErrorBoundary.Recover()` — clears the error and re-renders the children
- Useful pattern: a "retry" button that re-runs the failed operation after fixing input

```razor
@code {
    private async Task Retry()
    {
        _boundary.Recover();
        await LoadAsync();  // re-run the load that failed
    }
}
```

### Limits

- **Does not** catch exceptions in event handlers (`@onclick`); wrap those in try/catch
- **Does not** catch exceptions in lifecycle methods outside the rendering phase
- Logs to `ILogger` automatically — add your own logging in the catch block if you need domain-specific context

---

## Streaming Rendering (`[StreamRendering]`)

`[StreamRendering]` (the default for `InteractiveServer` in .NET 8+) lets a component render **once immediately** with a placeholder, then re-render when async data finishes. The browser sees the HTML right away and updates it in place.

```razor
@page "/dashboard"
@attribute [StreamRendering]

@if (_stats is null)
{
    <p>Cargando...</p>
}
else
{
    <h1>@_stats.TotalOrders pedidos</h1>
    <DashboardGrid Stats="_stats" />
}

@code {
    private DashboardStats? _stats;

    protected override async Task OnInitializedAsync()
    {
        // First render happens with _stats = null → placeholder
        _stats = await DashboardService.LoadAsync();
        // Second render with the data
    }
}
```

### Behavior

- HTML is flushed with the placeholder state during prerender / initial render
- Once the awaited task completes, a delta render is sent (via SignalR for `InteractiveServer`)
- Users see a skeleton / spinner / placeholder immediately, then content

### When to disable

Add `[StreamRendering(disabled: true)]` when the whole component **must** wait for the data (avoids the placeholder flash).

```razor
@attribute [StreamRendering(disabled: true)]
```

For data that should not be re-fetched on the prerender → interactive handoff, combine with `PersistentComponentState` (see [persistent-state.md](persistent-state.md)).
