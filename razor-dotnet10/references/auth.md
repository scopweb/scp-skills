# Authentication & Authorization — Reference

> **Security note (Jun 2026):** cookie auth, antiforgery and TempData are all protected by ASP.NET Core **Data Protection**. **CVE-2026-40372** (Microsoft.AspNetCore.DataProtection 10.0.0–10.0.6 computed the HMAC over the wrong bytes) undermines those guarantees — **require runtime 10.0.9+** everywhere this reference is applied. The 10.0.9 patch also fixes the ASP.NET Core DoS issues CVE-2026-42899 / CVE-2026-45591.

## Two-Scheme Setup (Cookie + JWT)

The most common pattern: Cookie auth for Razor Pages UI, JWT Bearer for API endpoints.

```csharp
// Program.cs — dual auth setup
builder.Services.AddAuthentication(o =>
{
    // Default scheme for Razor Pages (redirects to login page)
    o.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    o.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
})
.AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, o =>
{
    o.LoginPath = "/Account/Login";
    o.LogoutPath = "/Account/Logout";
    o.AccessDeniedPath = "/Account/AccessDenied";
    o.SlidingExpiration = true;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    // Don't redirect API calls — return 401 JSON instead
    o.Events.OnRedirectToLogin = ctx =>
    {
        if (ctx.Request.Path.StartsWithSegments("/api"))
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        }
        ctx.Response.Redirect(ctx.RedirectUri);
        return Task.CompletedTask;
    };
})
.AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, o =>
{
    o.TokenValidationParameters = new()
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ClockSkew = TimeSpan.FromMinutes(1) // Reduce from default 5min
    };
});
```

## Authorization Policies

```csharp
builder.Services.AddAuthorization(o =>
{
    // Role-based
    o.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
    o.AddPolicy("ManagerOrAdmin", p => p.RequireRole("Admin", "Manager"));

    // Claim-based
    o.AddPolicy("CanEditProducts", p => p.RequireClaim("permission", "products.edit"));

    // API-specific (JWT only)
    o.AddPolicy("ApiAccess", p => p
        .RequireAuthenticatedUser()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme));

    // Combined: JWT + role
    o.AddPolicy("ApiAdmin", p => p
        .RequireRole("Admin")
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme));
});
```

## Identity Setup (EF Core — only for user tables)

```csharp
// Models/AppUser.cs — extend with custom properties
public sealed class AppUser : IdentityUser
{
    public string? FullName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Data/AppIdentityDbContext.cs — separate from business DbContext
public sealed class AppIdentityDbContext(DbContextOptions<AppIdentityDbContext> options)
    : IdentityDbContext<AppUser>(options)
{
    // Only Identity tables here — business data goes through Dapper
}
```

```csharp
// Program.cs
builder.Services.AddDbContext<AppIdentityDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddIdentity<AppUser, IdentityRole>(o =>
{
    // Password
    o.Password.RequiredLength = 8;
    o.Password.RequireNonAlphanumeric = false;
    // Lockout
    o.Lockout.MaxFailedAccessAttempts = 5;
    o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    // User
    o.User.RequireUniqueEmail = true;
    o.SignIn.RequireConfirmedEmail = false; // true for production
})
.AddEntityFrameworkStores<AppIdentityDbContext>()
.AddDefaultTokenProviders();
```

## Login / Logout Pages

```csharp
// Pages/Account/Login.cshtml.cs
public class LoginModel(SignInManager<AppUser> signInManager) : PageModel
{
    [BindProperty] public LoginInputModel Input { get; set; } = new();
    public string? ReturnUrl { get; private set; }

    public void OnGet(string? returnUrl) => ReturnUrl = returnUrl ?? Url.Content("~/");

    public async Task<IActionResult> OnPostAsync(string? returnUrl)
    {
        ReturnUrl = returnUrl ?? Url.Content("~/");
        if (!ModelState.IsValid) return Page();

        var result = await signInManager.PasswordSignInAsync(
            Input.Email, Input.Password, Input.RememberMe, lockoutOnFailure: true);

        return result switch
        {
            { Succeeded: true } => LocalRedirect(ReturnUrl),
            { IsLockedOut: true } => RedirectToPage("./Lockout"),
            _ => InvalidCredentials()
        };
    }

    private IActionResult InvalidCredentials()
    {
        ModelState.AddModelError(string.Empty, "Invalid email or password.");
        return Page();
    }
}

// Pages/Account/Logout.cshtml.cs
public class LogoutModel(SignInManager<AppUser> signInManager) : PageModel
{
    public async Task<IActionResult> OnPostAsync()
    {
        await signInManager.SignOutAsync();
        return RedirectToPage("/Index");
    }
}
```

## JWT Token Generation & Refresh

> Use **`JsonWebTokenHandler`** (`Microsoft.IdentityModel.JsonWebTokens`) — it's what JwtBearer uses for validation since .NET 8 and is faster and allocation-friendlier than the legacy `JwtSecurityTokenHandler`. Avoid `JwtSecurityToken`/`JwtSecurityTokenHandler` in new code.

```csharp
public sealed class TokenService(IConfiguration config, TimeProvider clock)
{
    private static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromHours(2);
    private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(7);

    public string GenerateAccessToken(AppUser user, IList<string> roles)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = config["Jwt:Issuer"],
            Audience = config["Jwt:Audience"],
            Subject = new ClaimsIdentity(BuildClaims(user, roles)),
            IssuedAt = now,
            Expires = now.Add(AccessTokenLifetime),
            SigningCredentials = new SigningCredentials(
                GetSigningKey(), SecurityAlgorithms.HmacSha256)
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    public string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    private List<Claim> BuildClaims(AppUser user, IList<string> roles)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new(ClaimTypes.Name, user.FullName ?? user.Email!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        return claims;
    }

    private SymmetricSecurityKey GetSigningKey() =>
        new(Encoding.UTF8.GetBytes(config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key not configured")));
}
```

> Store refresh tokens **hashed** server-side (like passwords) and rotate them on every use. HS256 keys must be ≥ 32 bytes (256 bits).

## Reading Claims in Controllers & Pages

```csharp
// In any Controller or PageModel
var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
var email  = User.FindFirstValue(ClaimTypes.Email);
var isAdmin = User.IsInRole("Admin");
var hasPolicy = await _authService.AuthorizeAsync(User, "AdminOnly");

// Extension method for convenience
public static class ClaimsPrincipalExtensions
{
    public static string GetUserId(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID claim missing.");
}
```

## Protecting API Endpoints

```csharp
// Controller-level: all actions require JWT
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class ProductsController : ControllerBase { }

// Action-level: override for specific action
[AllowAnonymous]
public IActionResult GetPublic() { }

[Authorize(Policy = "ApiAdmin")]
public async Task<IActionResult> AdminAction() { }
```

## Seeding Roles & Admin User

```csharp
// Program.cs — after app.Build()
await SeedRolesAsync(app.Services);

static async Task SeedRolesAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

    string[] roles = ["Admin", "Manager", "User"];
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
    }

    // Seed admin in Development only
    var env = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();
    if (env.IsDevelopment())
    {
        const string adminEmail = "admin@localhost";
        if (await userManager.FindByEmailAsync(adminEmail) is null)
        {
            var admin = new AppUser { UserName = adminEmail, Email = adminEmail, FullName = "Admin" };
            await userManager.CreateAsync(admin, "Admin1234!");
            await userManager.AddToRoleAsync(admin, "Admin");
        }
    }
}
```

## Passkeys / WebAuthn (Identity en .NET 10)

Identity expone `IdentityPasskey<TUser>` desde .NET 10 — login passwordless con Windows Hello, iCloud Keychain, YubiKey, etc.

```csharp
// Program.cs — habilitar passkeys
builder.Services.AddIdentity<AppUser, IdentityRole>()
    .AddEntityFrameworkStores<AppIdentityDbContext>()
    .AddDefaultTokenProviders()
    .AddPasskeyStore<AppUser>(); // .NET 10+

// Opcional: AAGUID inference para nombres amigables (Windows Hello, etc.)
// .NET 11 añadirá inferencia automática — en 10 hay que mapear manualmente.
```

> El scaffolding de UI para passkeys requiere el template **Blazor Web App** o el **Individual Accounts** actualizado. Para auditoria profunda (origen, replay, attestation), usa **`blazor-security-audit`** — aplica también a Razor/MVC.
