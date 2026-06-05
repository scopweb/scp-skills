# QuickGrid Patterns for Blazor Server (.NET 10)

`<QuickGrid>` is built into `Microsoft.AspNetCore.Components.QuickGrid` since .NET 8. It provides sort, filter, pagination and virtualization without external dependencies.

```razor
@using Microsoft.AspNetCore.Components.QuickGrid
```

---

## Basic Grid

```razor
<QuickGrid Items="@_orders" Class="table table-striped">
    <PropertyColumn Property="@(o => o.Code)" />
    <PropertyColumn Property="@(o => o.Amount)" Format="C" />
    <PropertyColumn Property="@(o => o.Status)" />
    <PropertyColumn Property="@(o => o.Created)" Format="yyyy-MM-dd" />
</QuickGrid>

@code {
    private IQueryable<Order> _orders = Enumerable.Empty<Order>().AsQueryable();

    protected override async Task OnInitializedAsync()
    {
        var data = await OrderService.GetAllAsync();
        _orders = data.AsQueryable();
    }
}
```

> `Items` expects `IQueryable<T>`. Convert at the service boundary with `.AsQueryable()`.

---

## Columns

| Column | Use for |
|--------|---------|
| `PropertyColumn` | Direct property binding with optional format |
| `TemplateColumn` | Custom cell content (buttons, badges, links) |
| `Column<T, TProp>` | Fully custom (header + cell) |

```razor
<QuickGrid Items="@_orders">
    <PropertyColumn Property="@(o => o.Code)" Sortable="true" />
    <PropertyColumn Property="@(o => o.CustomerName)" Sortable="true" />

    <TemplateColumn Title="Status">
        <StatusBadge Status="@context.Status" />
    </TemplateColumn>

    <TemplateColumn Title="Actions">
        <button class="btn btn-sm btn-primary"
                @onclick="@(() => Edit(context.Id))">
            Edit
        </button>
        <button class="btn btn-sm btn-danger"
                @onclick="@(() => Delete(context.Id))">
            Delete
        </button>
    </TemplateColumn>
</QuickGrid>
```

---

## Sorting

```razor
<PropertyColumn Property="@(o => o.Amount)"
                Sortable="true"
                IsDefaultSort="true"
                DefaultSortDirection="SortDirection.Descending" />

<PropertyColumn Property="@(o => o.Code)" Sortable="true" />
```

The grid is sortable out of the box when the property is marked `Sortable="true"`.

---

## Pagination

```razor
<Paginator State="@_pagination" />

<QuickGrid Items="@_orders" Pagination="@_pagination">
    <PropertyColumn Property="@(o => o.Code)" />
</QuickGrid>

@code {
    private readonly PaginationState _pagination = new()
    {
        ItemsPerPage = 20
    };
}
```

### Page size selector

```razor
<Paginator State="@_pagination">
    <PageSizeSelector Items="@(new[] { 10, 25, 50, 100 })" />
</Paginator>
```

---

## Server-side Data with `ItemsProvider`

For large datasets, never load everything into memory. Use `ItemsProvider` to push filtering/sorting/paging to the database.

```csharp
private GridItemsProvider<Order> _itemsProvider = default!;

protected override void OnInitialized()
{
    _itemsProvider = async (GridItemsProviderRequest<Order> request) =>
    {
        // request.StartIndex, request.Count, request.SortBy
        var result = await OrderService.GetPagedAsync(
            startIndex: request.StartIndex,
            count:      request.Count,
            sortColumn: request.SortBy?.PropertyName,
            descending: request.SortBy?.DescendingDirection == true,
            ct:         request.CancellationToken);

        return GridItemsProviderResult.From(
            items: result.Items,
            totalItemCount: result.TotalCount);
    };
}
```

```razor
<QuickGrid ItemsProvider="@_itemsProvider" Pagination="@_pagination" Virtualize="true">
    <PropertyColumn Property="@(o => o.Code)" Sortable="true" />
</QuickGrid>
```

### Service signature for paged queries

```csharp
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount);

public async Task<PagedResult<Order>> GetPagedAsync(
    int startIndex,
    int count,
    string? sortColumn,
    bool descending,
    CancellationToken ct = default)
{
    await using var conn = await connectionFactory.CreateConnectionAsync(ct);

    var sql = """
        SELECT Id, Code, Amount, Status, Created
        FROM   dbo.Orders
        ORDER  BY """ + (sortColumn ?? "Id") + (descending ? " DESC" : " ASC") + """
        OFFSET @Start ROWS
        FETCH NEXT @Count ROWS ONLY;

        SELECT COUNT(*) FROM dbo.Orders;
        """;

    await using var multi = await conn.QueryMultipleAsync(
        new CommandDefinition(sql, new { Start = startIndex, Count = count },
            cancellationToken: ct));
    var items = (await multi.ReadAsync<Order>()).AsList();
    var total = await multi.ReadFirstAsync<int>();
    return new PagedResult<Order>(items, total);
}
```

> Use `ORDER BY` with whitelisted columns — never concatenate user input.

---

## Virtualization

For grids that may show 100k+ rows, use `Virtualize="true"` together with `ItemsProvider`:

```razor
<QuickGrid ItemsProvider="@_itemsProvider"
           Virtualize="true"
           ItemSize="42"
           ItemKey="@(o => o.Id)">
    ...
</QuickGrid>
```

`Virtualize` requires `ItemsProvider` (or an in-memory `IQueryable` that supports `.Skip()/.Take()`).

---

## Filtering

QuickGrid does not ship a generic filter UI. Two common patterns:

### 1. External filter controls + reset

```razor
<input @bind="_search" @bind:event="oninput"
       @onkeyup="OnSearchChanged"
       placeholder="Search by code..." />

<QuickGrid Items="@FilteredOrders" Pagination="@_pagination">
    ...
</QuickGrid>

@code {
    private string _search = "";
    private IQueryable<Order> _orders = default!;

    private IQueryable<Order> FilteredOrders =>
        string.IsNullOrWhiteSpace(_search)
            ? _orders
            : _orders.Where(o => o.Code.Contains(_search, StringComparison.OrdinalIgnoreCase));

    private void OnSearchChanged() => _pagination.CurrentPageIndex = 0;
}
```

### 2. Server-side filter via `ItemsProvider`

Pass the filter into the request:

```csharp
private GridItemsProvider<Order> _itemsProvider = default!;

protected override void OnInitialized()
{
    _itemsProvider = async (req) =>
    {
        var result = await OrderService.GetPagedAsync(
            startIndex: req.StartIndex,
            count:      req.Count,
            sortColumn: req.SortBy?.PropertyName,
            descending: req.SortBy?.DescendingDirection == true,
            search:     _search,
            ct:         req.CancellationToken);
        return GridItemsProviderResult.From(result.Items, result.TotalCount);
    };
}
```

---

## Row Click / Selection

```razor
<QuickGrid Items="@_orders" RowClass="@(o => o.Id == _selectedId ? "table-active" : null)">
    <TemplateColumn>
        <button @onclick="@(() => Select(context))">Select</button>
    </TemplateColumn>
    ...
</QuickGrid>
```

### Row Styling (`RowClass`, .NET 10)

`RowClass` (added in .NET 10) takes a function that returns a CSS class for each row. Combine with `<RowClass>` to highlight status, overdue rows, or per-user permissions:

```razor
<QuickGrid Items="@_orders"
           RowClass="@(o => o.Status switch
           {
               OrderStatus.Overdue => "row-danger",
               OrderStatus.Pending => "row-warning",
               _ => null
           })">
    ...
</QuickGrid>
```

```css
/* wwwroot/app.css */
.row-danger  { background-color: var(--bs-table-bg-state-danger-subtle); }
.row-warning { background-color: var(--bs-table-bg-state-warning-subtle); }
```

> Use it instead of inline `style=` — keeps styling in CSS, supports theming, and doesn't bloat the rendered HTML.

---

## Anti-Patterns

```razor
<!-- ❌ WRONG — loading 100k rows client-side, no pagination -->
<QuickGrid Items="@_orders" />

<!-- ❌ WRONG — AsQueryable() inside a re-render path -->
<QuickGrid Items="@(LoadAllAsync().Result.AsQueryable())" />

<!-- ❌ WRONG — using EF tracked entities, leaks DbContext into the grid -->
<QuickGrid Items="@(dbContext.Orders)" />

<!-- ❌ WRONG — concatenating user input into ORDER BY -->
$"ORDER BY {request.SortBy.PropertyName}"
```

---

## Quick Reference

| Need | Pattern |
|------|---------|
| Small list (<1k) | `Items` + `IQueryable` |
| Large list with paging | `ItemsProvider` + `Pagination` |
| Huge list (100k+) | `ItemsProvider` + `Virtualize="true"` |
| Sortable column | `<PropertyColumn Sortable="true" />` |
| Default sort | `IsDefaultSort="true" DefaultSortDirection="SortDirection.Descending"` |
| Custom cell | `<TemplateColumn>@context.Whatever</TemplateColumn>` |
| Filter at the DB | Pass `search`/`filter` into `ItemsProvider` request |
| Row key | `ItemKey="@(o => o.Id)"` (required for Virtualize) |
