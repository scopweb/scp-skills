# Authentication & Authorization for Blazor Server (.NET 10)

Blazor Server uses the same auth pipeline as the rest of ASP.NET Core, but components get the user state via `AuthenticationStateProvider` cascaded through the app.

> ⚠️ This file covers the Blazor-side patterns. For security hardening, audit, and OWASP coverage, see the `blazor-security-audit` skill — this file is about **how to use auth well**, not how to attack it.

---

## Registration

```csharp
// Program.cs
builder.Services.AddCascadingAuthenticationState();   // Blazor-side
builder.Services.AddAuthentication(IdentityConstants.ApplicationCookie)
    .AddApplicationCookie();

// Or with JwtBearer for SPAs/APIs
// .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, ...);

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
    options.AddPolicy("CanEditOrders", p =>
        p.RequireAuthenticatedUser().RequireClaim("permission", "orders:edit"));
    options.AddPolicy("MinAge18", p => p.AddRequirements(new MinAgeRequirement(18)));
});
```

For Blazor Server the cookie scheme (`IdentityConstants.ApplicationCookie`) is typical. For pure-JWT SPAs use `JwtBearer`.

---

## `<AuthorizeView>` — Conditional UI

```razor
<AuthorizeView>
    <Authorized>
        <p>Welcome, @context.User.Identity!.Name</p>
    </Authorized>
    <NotAuthorized>
        <p>You are not logged in.</p>
        <a href="/login">Sign in</a>
    </NotAuthorized>
    <Authorizing>
        <p>Loading...</p>
    </Authorizing>
</AuthorizeView>
```

`context.User` is the `ClaimsPrincipal`.

### With policy

```razor
<AuthorizeView Policy="AdminOnly">
    <Authorized>
        <AdminPanel />
    </Authorized>
    <NotAuthorized>
        <AccessDenied />
    </NotAuthorized>
</AuthorizeView>
```

### With role

```razor
<AuthorizeView Roles="Admin,Manager">
    <Authorized>...</Authorized>
</AuthorizeView>
```

---

## `[Authorize]` Attribute — Page-Level

```csharp
@page "/admin"
@attribute [Authorize(Policy = "AdminOnly")]

<h1>Admin</h1>
```

Behavior:
- **Unauthenticated user** → redirected to login
- **Authenticated but unauthorized** → 403 / `AccessDenied` page

Configure the redirects:

```csharp
builder.Services.ConfigureApplicationCookie(o =>
{
    o.LoginPath       = "/login";
    o.AccessDeniedPath = "/access-denied";
});
```

---

## Programmatic Check in Components

```csharp
@inject AuthenticationStateProvider Auth

@code {
    private ClaimsPrincipal? _user;
    private bool _isAdmin;

    protected override async Task OnInitializedAsync()
    {
        var state = await Auth.GetAuthenticationStateAsync();
        _user = state.User;
        _isAdmin = _user.IsInRole("Admin");
    }
}
```

In a service (no component):

```csharp
public sealed class OrderService(AuthenticationStateProvider auth)
{
    public async Task<Result<Order>> PlaceOrderAsync(/*...*/, CancellationToken ct = default)
    {
        var state = await auth.GetAuthenticationStateAsync();
        var user = state.User;
        if (user.Identity?.IsAuthenticated != true)
            return Result<Order>.Failure("Not authenticated");
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        // ...
    }
}
```

---

## Cascading `Task<AuthenticationState>`

For deep component trees, prefer `@inject AuthenticationStateProvider` over the cascading version to avoid extra allocations.

```razor
@* Don't do this in every component *@
@code {
    [CascadingParameter] private Task<AuthenticationState> AuthState { get; set; } = default!;
    // vs.
    [Inject] private AuthenticationStateProvider Auth { get; set; } = default!;
}
```

`AddCascadingAuthenticationState()` (called once at startup) makes the state available as a cascading parameter app-wide; inject the provider only when you need to call `GetAuthenticationStateAsync()`.

---

## Resource-Based Authorization

When the policy depends on the resource being accessed (e.g. "can edit this specific order"):

```csharp
public sealed class OrderAuthorizationHandler
    : AuthorizationHandler<CanEditOrderRequirement, Order>
{
    private readonly IDbConnectionFactory<SqlConnection> _factory;

    public OrderAuthorizationHandler(IDbConnectionFactory<SqlConnection> factory)
        => _factory = factory;

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        CanEditOrderRequirement requirement,
        Order resource)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return;

        // Owner can always edit
        if (resource.OwnerId == userId)
        {
            context.Succeed(requirement);
            return;
        }

        // Manager can edit within their tenant
        if (context.User.IsInRole("Manager"))
        {
            // (check tenant membership if needed)
            context.Succeed(requirement);
        }
    }
}

public sealed record CanEditOrderRequirement : IAuthorizationRequirement;
```

```csharp
// Registration
builder.Services.AddSingleton<IAuthorizationHandler, OrderAuthorizationHandler>();
```

```csharp
// Usage in a service
public async Task<Result<Order>> GetForEditAsync(int orderId, CancellationToken ct = default)
{
    var order = await LoadOrderAsync(orderId, ct);
    if (order is null) return Result<Order>.Failure("Not found");

    var auth = await _authService.AuthorizeAsync(_user, order, "CanEditOrder");
    return auth.Succeeded
        ? Result<Order>.Success(order)
        : Result<Order>.Failure("Forbidden");
}
```

> The `AuthorizationService` is `IAuthorizationService` — inject it into your service. Don't reach into the user's claims from the service directly for resource checks.

---

## Custom `AuthenticationStateProvider`

Use it when you need to issue a custom auth state from something other than the cookie/JWT (e.g. a token from a third-party header, an API call):

```csharp
public sealed class HeaderAuthenticationStateProvider(
    IHttpContextAccessor accessor) : AuthenticationStateProvider
{
    public override Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        var user = accessor.HttpContext?.User ?? new ClaimsPrincipal(new ClaimsIdentity());
        return Task.FromResult(new AuthenticationState(user));
    }

    public void NotifyUserChanged() => NotifyAuthenticationStateChanged();
}
```

```csharp
// Registration
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuthenticationStateProvider, HeaderAuthenticationStateProvider>();
```

---

## Circuit-Scoped State

For per-circuit data (e.g. selected tenant, current filter), don't store it in claims — use a scoped service:

```csharp
public sealed class UserContext
{
    public int? TenantId { get; set; }
    public string TimeZone { get; set; } = "UTC";
}

// Register scoped
builder.Services.AddScoped<UserContext>();

// Set on login
@inject SignInManager<ApplicationUser> SignIn
@inject UserContext Context

@code {
    private async Task LoginAsync(LoginModel model)
    {
        var result = await SignIn.PasswordSignInAsync(model.Email, model.Password, true, false);
        if (result.Succeeded)
        {
            var user = await UserManager.FindByEmailAsync(model.Email);
            Context.TenantId = user.TenantId;
        }
    }
}
```

> The user is identified by the cookie; the `UserContext` carries **non-identity** session data.

---

## Anti-Patterns

```csharp
// ❌ WRONG — auth checks in the view layer only
@if (User.IsInRole("Admin")) { <DeleteButton /> }
// No check in the service → direct API call bypasses authorization

// ❌ WRONG — claim-based tenant filtering without server-side enforcement
var orders = await ctx.Orders.Where(o => o.TenantId == user.TenantId).ToListAsync();
// Build the filter from the user's claim, not from the URL/request

// ❌ WRONG — storing sensitive data in claims
new Claim("creditCard", "4111-1111-1111-1111")  // readable in the cookie

// ❌ WRONG — using Roles for fine-grained permissions
options.AddPolicy("CanEditOrder_42", p => p.RequireRole("Order42Editor"));
// Use a resource-based policy instead

// ❌ WRONG — forgetting the [Authorize] attribute on a page
@page "/admin"
<h1>Sensitive</h1>  // accessible to anyone — UI-only check below
@if (User.IsInRole("Admin")) { ... }
```

---

## Quick Reference

| Need | Pattern |
|------|---------|
| Conditional UI | `<AuthorizeView>...</AuthorizeView>` |
| Page protection | `@attribute [Authorize(Policy = "...")]` |
| Role gate | `[Authorize(Roles = "Admin")]` or `IsInRole("Admin")` |
| Claim gate | `RequireClaim("type", "value")` |
| Resource-based | Custom `AuthorizationHandler<TReq, TResource>` + `IAuthorizationService` |
| Read user in service | `await AuthStateProvider.GetAuthenticationStateAsync()` |
| Custom state source | Implement `AuthenticationStateProvider` |
| Redirect config | `ConfigureApplicationCookie({ LoginPath, AccessDeniedPath })` |
| Per-circuit, non-identity state | Scoped service (`UserContext`) |
