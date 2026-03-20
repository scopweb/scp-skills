# Razor Pages — Reference

## Folder Structure

```
Pages/
├── _ViewImports.cshtml     # @using, @addTagHelper
├── _ViewStart.cshtml       # Layout default
├── Shared/
│   ├── _Layout.cshtml
│   └── _ValidationScriptsPartial.cshtml
├── Index.cshtml            # → /
├── Error.cshtml
└── Products/
    ├── Index.cshtml        # → /Products
    ├── Create.cshtml       # → /Products/Create
    ├── Edit.cshtml         # → /Products/Edit?id=1
    └── Detail.cshtml       # → /Products/Detail/1
```

## Handler Methods

```csharp
// Convention: On{Verb}[HandlerName]Async
public Task<IActionResult> OnGetAsync()         // GET /page
public Task<IActionResult> OnPostAsync()        // POST /page
public Task<IActionResult> OnPostDeleteAsync()  // POST /page?handler=delete
public Task<IActionResult> OnGetDetailAsync()   // GET /page?handler=detail
```

## Model Binding

```csharp
// [BindProperty] — bound on POST by default
[BindProperty]
public ProductInputModel Input { get; set; } = new();

// [BindProperty(SupportsGet = true)] — bound on GET too (use carefully)
[BindProperty(SupportsGet = true)]
public int PageNumber { get; set; } = 1;

// Route values via [FromRoute]
public async Task<IActionResult> OnGetAsync([FromRoute] int id) { }

// Query string (GET parameters)
public async Task<IActionResult> OnGetAsync(string? search, int page = 1) { }
```

## Validation

```csharp
// Input model with Data Annotations
public record ProductInputModel
{
    [Required(ErrorMessage = "Name is required.")]
    [MaxLength(200)]
    public string Name { get; init; } = string.Empty;

    [Required]
    [Range(0.01, 999999.99, ErrorMessage = "Price must be positive.")]
    public decimal Price { get; init; }
}

// Check in handler
if (!ModelState.IsValid) return Page();

// Add custom error
ModelState.AddModelError("Input.Name", "Name already exists.");
ModelState.AddModelError(string.Empty, "Generic page-level error.");
```

```html
<!-- Razor view validation -->
<form method="post">
    <div asp-validation-summary="ModelOnly" class="text-danger"></div>
    <div class="mb-3">
        <label asp-for="Input.Name"></label>
        <input asp-for="Input.Name" class="form-control" />
        <span asp-validation-for="Input.Name" class="text-danger"></span>
    </div>
    <button type="submit">Save</button>
</form>

@section Scripts {
    <partial name="_ValidationScriptsPartial" />
}
```

## TempData

```csharp
// Set (survives one redirect)
TempData["Success"] = "Product saved.";
TempData["Error"] = "Something went wrong.";

// Read in next request
if (TempData["Success"] is string msg) { ... }
```

```html
<!-- _Layout.cshtml — global TempData display -->
@if (TempData["Success"] is string success)
{
    <div class="alert alert-success">@success</div>
}
@if (TempData["Error"] is string error)
{
    <div class="alert alert-danger">@error</div>
}
```

## Tag Helpers

```html
<!-- Links -->
<a asp-page="/Products/Edit" asp-route-id="@item.Id">Edit</a>
<a asp-page="./Index">Back to list</a>

<!-- Forms -->
<form method="post" asp-page-handler="delete" asp-route-id="@item.Id">
    <button type="submit">Delete</button>
</form>

<!-- Anti-forgery is injected automatically in forms -->
```

## Partial Views & View Components

```html
<!-- Partial (simple HTML fragment) -->
<partial name="_ProductCard" model="item" />

<!-- View Component (with logic) -->
@await Component.InvokeAsync("RecentOrders", new { count = 5 })
```

```csharp
// View Component
public class RecentOrdersViewComponent(IOrderRepository repo) : ViewComponent
{
    public async Task<IViewComponentResult> InvokeAsync(int count)
    {
        var orders = await repo.GetRecentAsync(count);
        return View(orders);
    }
}
// View: Views/Shared/Components/RecentOrders/Default.cshtml
```

## Authorization on Pages

```csharp
// Attribute on PageModel
[Authorize]
[Authorize(Roles = "Admin")]
[Authorize(Policy = "AdminOnly")]
public class EditModel : PageModel { }

// Allow anonymous on an otherwise-protected page
[AllowAnonymous]
public class LoginModel : PageModel { }
```

```csharp
// Convention in Program.cs (authorize all pages by default)
builder.Services.AddRazorPages(o =>
{
    o.Conventions.AuthorizeFolder("/");           // All pages require auth
    o.Conventions.AllowAnonymousToPage("/Account/Login");
    o.Conventions.AllowAnonymousToPage("/Account/Register");
    o.Conventions.AuthorizePage("/Admin/Users", "AdminOnly");
});
```
