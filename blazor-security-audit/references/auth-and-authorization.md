# Authentication & Authorization — Blazor Server .NET 10

## Table of Contents

1. [Authentication Schemes](#authentication-schemes)
2. [ASP.NET Core Identity](#aspnet-core-identity)
3. [Cookie Configuration](#cookie-configuration)
4. [OAuth2 / OIDC](#oauth2--oidc)
5. [Authorization Patterns](#authorization-patterns)
6. [Passkeys / WebAuthn (.NET 10)](#passkeys--webauthn)
7. [AuthenticationStateProvider](#authenticationstateprovider)
8. [Common Vulnerabilities](#common-vulnerabilities)

---

## Authentication Schemes

Blazor Server authenticates at circuit start via the SignalR connection. The auth context persists for the circuit lifetime and is re-evaluated on reconnection.

### Cookie Authentication (most common for internal apps)

```csharp
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.AccessDeniedPath = "/Account/AccessDenied";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.Name = ".MyApp.Auth";
    });
```

**Security rules for cookies:**
- `HttpOnly = true` — Prevents JS access (XSS mitigation)
- `SecurePolicy = Always` — Only sent over HTTPS
- `SameSite = Strict` — CSRF protection (use Lax if cross-site auth needed)
- Custom cookie name — Avoids fingerprinting default names
- Reasonable expiration — 8h for work apps, shorter for sensitive

### Identity-Based (recommended for user management)

```csharp
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseSqlServer(connectionString));

builder.Services.AddDefaultIdentity<ApplicationUser>(options =>
{
    // Password policy
    options.Password.RequiredLength = 12;
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredUniqueChars = 4;

    // Lockout
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // User
    options.User.RequireUniqueEmail = true;
    options.SignIn.RequireConfirmedEmail = true;
})
.AddRoles<IdentityRole>()
.AddEntityFrameworkStores<AppDbContext>();
```

**Important**: ASP.NET Core Identity UI uses Razor Pages, not Blazor components. Identity pages (login, register, etc.) should remain as Razor Pages — do NOT convert them to Blazor components.

---

## OAuth2 / OIDC

For external identity providers (Microsoft Entra, Google, etc.):

```csharp
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
})
.AddCookie()
.AddOpenIdConnect(options =>
{
    options.Authority = "https://login.microsoftonline.com/{tenant-id}/v2.0";
    options.ClientId = builder.Configuration["AzureAd:ClientId"];
    options.ClientSecret = builder.Configuration["AzureAd:ClientSecret"];
    options.ResponseType = "code";
    options.SaveTokens = true;
    options.Scope.Add("openid");
    options.Scope.Add("profile");
    options.TokenValidationParameters.ValidateIssuer = true;
});
```

**Never store ClientSecret in appsettings.json** — Use User Secrets (dev) or Key Vault (prod).

---

## Authorization Patterns

### Page-level authorization

```razor
@page "/admin/dashboard"
@attribute [Authorize(Roles = "Admin")]

<!-- Or with policy -->
@attribute [Authorize(Policy = "RequireAdminRole")]
```

### Component-level

```razor
<AuthorizeView Roles="Admin">
    <Authorized>
        <AdminPanel />
    </Authorized>
    <NotAuthorized>
        <p>Access denied.</p>
    </NotAuthorized>
</AuthorizeView>
```

### Policy-based (recommended over roles for complex scenarios)

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireAdminRole", policy =>
        policy.RequireRole("Admin"))
    .AddPolicy("CanEditOrders", policy =>
        policy.RequireClaim("Permission", "Orders.Edit"))
    .AddPolicy("MinimumAge", policy =>
        policy.Requirements.Add(new MinimumAgeRequirement(18)));
```

### Service-level authorization

```csharp
public sealed class OrderService(
    IDbContextFactory<AppDbContext> contextFactory,
    IAuthorizationService authService,
    AuthenticationStateProvider authStateProvider)
{
    public async Task<Result<Order>> DeleteOrderAsync(int id, CancellationToken ct)
    {
        var authState = await authStateProvider.GetAuthenticationStateAsync();
        var user = authState.User;

        var authResult = await authService.AuthorizeAsync(user, "CanDeleteOrders");
        if (!authResult.Succeeded)
            return Result<Order>.Failure("Not authorized to delete orders");

        // proceed with deletion...
    }
}
```

---

## Passkeys / WebAuthn (.NET 10)

.NET 10 adds built-in support for passwordless authentication:

```csharp
// Program.cs
builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders()
    .AddPasskeys(); // .NET 10 built-in

// Note: Passkeys augment passwords, they don't fully replace them yet
// Registration still requires a password in default templates
```

Passkeys are phishing-resistant and work cross-device. Consider implementing them for high-security apps.

---

## AuthenticationStateProvider

### Security stamp revalidation (default template — keep it!)

The `IdentityRevalidatingAuthenticationStateProvider` revalidates the security stamp every 30 minutes for connected circuits. This detects if a user's security context changed (password change, role change, etc.).

**Do NOT remove or replace this** unless you understand the implications. If the revalidation interval is too long, a compromised account could stay active.

```csharp
// Default: revalidates every 30 minutes
// For high-security apps, consider reducing to 5-10 minutes
// Trade-off: more frequent DB queries vs faster invalidation
```

---

## Common Vulnerabilities

| Vulnerability | Impact | Detection |
|--------------|--------|-----------|
| Missing `[Authorize]` on pages | Unauthorized access | Search for `@page` without `[Authorize]` |
| `[AllowAnonymous]` on sensitive pages | Auth bypass | Audit all `[AllowAnonymous]` usages |
| No account lockout | Brute force attacks | Check Identity options |
| Weak password policy | Account compromise | Check `Password.RequiredLength` |
| No email confirmation | Fake account creation | Check `SignIn.RequireConfirmedEmail` |
| Token/secret in appsettings | Credential exposure | Scan for API keys, connection strings |
| Missing HTTPS on auth endpoints | Credential interception | Check `Cookie.SecurePolicy` |
| Custom AuthStateProvider bugs | Auth bypass | Review custom implementations carefully |
