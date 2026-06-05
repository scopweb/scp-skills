# PersistentComponentState for Blazor Server (.NET 10)

`PersistentComponentState` lets a Blazor Server component **persist data across the prerender → interactive handoff**. State is serialized into the page on prerender and rehydrated on the first interactive render, so the user does not see a loading flash and the server does not re-fetch what the prerender already loaded.

In .NET 10 with `InteractiveServer` render mode, this is essential for the prerender+circuit pattern.

---

## The Problem It Solves

Without `PersistentComponentState`:

```
1. Server prerender → fetch data → render HTML → flush to browser
2. Browser runs app, opens SignalR circuit
3. OnInitialized runs AGAIN on the server
4. The same data is fetched a second time
```

With `PersistentComponentState`:

```
1. Server prerender → fetch data → render HTML
2. State persisted into the page (base64 JSON)
3. Browser opens circuit → rehydrates state from the page → no second fetch
```

---

## Component Pattern

```razor
@page "/orders"
@inject PersistentComponentState State
@inject OrderService OrderService
@implements IDisposable

<h1>Orders (@_orders.Count)</h1>

@code {
    private List<OrderDto> _orders = new();
    private PersistingComponentStateSubscription? _subscription;

    protected override void OnInitialized()
    {
        _subscription = State.RegisterOnPersisting(PersistOrders);

        if (!State.TryTakeFromJson<List<OrderDto>>(nameof(_orders), out var saved))
        {
            // First render (prerender) — load and persist
            _orders = LoadOrdersSync();  // synchronous for prerender
        }
        else
        {
            // Rehydrated from prerender
            _orders = saved!;
        }
    }

    private Task PersistOrders()
    {
        State.PersistAsJson(nameof(_orders), _orders);
        return Task.CompletedTask;
    }

    public void Dispose() => _subscription?.Dispose();
}
```

The `RegisterOnPersisting` callback runs **just before** the prerendered HTML is flushed to the browser.

---

## Async Loading (Recommended)

If your data is loaded asynchronously, the `factory` overload of `PersistAsJson` runs the work and serializes the result:

```razor
@implements IDisposable
@inject PersistentComponentState State
@inject OrderService OrderService

@code {
    private List<OrderDto> _orders = new();
    private PersistingComponentStateSubscription? _subscription;

    protected override async Task OnInitializedAsync()
    {
        _subscription = State.RegisterOnPersisting(PersistOrdersAsync);

        if (!State.TryTakeFromJson<List<OrderDto>>("orders", out var saved))
        {
            _orders = await OrderService.GetAllAsync();
        }
        else
        {
            _orders = saved!;
        }
    }

    private async Task PersistOrdersAsync()
    {
        await State.PersistAsJsonAsync("orders", _orders);
    }

    public void Dispose() => _subscription?.Dispose();
}
```

---

## Streaming Rendering + Persistent State

With `[StreamRendering]` (the default for interactive Blazor in .NET 8+), combine with a guard so the persisted state isn't overwritten on the first interactive render:

```razor
@page "/dashboard"
@attribute [StreamRendering]
@inject PersistentComponentState State
@inject DashboardService Dashboard

@if (_stats is null)
{
    <p>Loading...</p>
}
else
{
    <DashboardGrid Stats="_stats" />
}

@code {
    private DashboardStats? _stats;
    private PersistingComponentStateSubscription? _sub;

    protected override async Task OnInitializedAsync()
    {
        _sub = State.RegisterOnPersisting(PersistAsync);

        if (State.TryTakeFromJson<DashboardStats>("stats", out var saved))
        {
            _stats = saved;
            return;
        }

        _stats = await Dashboard.LoadAsync();
    }

    private Task PersistAsync()
    {
        State.PersistAsJson("stats", _stats!);
        return Task.CompletedTask;
    }

    public void Dispose() => _sub?.Dispose();
}
```

---

## Scoped Service (No Persistence Needed)

For data that **only needs to survive a single circuit** (not prerender), a scoped service is simpler:

```csharp
public sealed class UserSession
{
    public string? SelectedTenantId { get; set; }
    public List<int> RecentlyViewed { get; } = new();
}

builder.Services.AddScoped<UserSession>();
```

> `PersistentComponentState` is for **prerender → interactive handoff**. Scoped services are for **within a single circuit**. Don't conflate them.

---

## What to Persist (and What Not To)

| Persist | Don't persist |
|---------|---------------|
| Reference data (lists, lookups) | Connection handles, DbContexts |
| Initial page state (sort, filter) | Per-user secrets |
| Pre-computed aggregates | Anything non-serializable |
| Dashboard data | Authentication tokens |
| Anything that survives a refresh | Large blobs (size limit) |

> The persisted state is serialized into the HTML payload — keep it small (< ~100 KB) and JSON-safe.

---

## Anti-Patterns

```razor
<!-- ❌ WRONG — TryTake AFTER running the load, state never rehydrates -->
if (!State.TryTakeFromJson<List<OrderDto>>(...)) {
    _orders = await OrderService.GetAllAsync();
}
<!-- but the load is async, so register persisting first, then check state, then load -->

<!-- ❌ WRONG — not subscribing → state never gets persisted -->
@code {
    protected override void OnInitialized() {
        _data = await Service.LoadAsync();
        // forgot: State.RegisterOnPersisting(...)
    }
}

<!-- ❌ WRONG — persisting a DbContext or live connection -->
State.PersistAsJson("ctx", _context);  // JsonException on serialize

<!-- ❌ WRONG — persisting on every interactive render -->
State.PersistAsJson("state", _state);  // call inside RegisterOnPersisting callback

<!-- ❌ WRONG — using PersistentComponentState as a session store -->
// That's `ISession` or a scoped service, not PersistentComponentState
```

---

## Quick Reference

| Need | API |
|------|-----|
| Subscribe to persist callback | `State.RegisterOnPersisting(Func<Task> callback)` |
| Read rehydrated state | `State.TryTakeFromJson<T>(key, out var value)` |
| Write state synchronously | `State.PersistAsJson(key, value)` |
| Write state async | `State.PersistAsJsonAsync(key, value)` |
| Per-circuit only | Scoped service |
| Across browser refreshes | Local storage / session storage |
| Across users | Database |
