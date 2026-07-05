# Program.cs — Razor Pages + API + Auth Pipeline

> Targeted at **.NET 10.0.9** (SDK 10.0.301, C# 14). Pair with [`global.json`](../SKILL.md#pin-sdk-with-globaljson) and `RuntimeFrameworkVersion=10.0.9` in `Directory.Build.props`.
>
> **Security (Jun 2026):** runtime 10.0.9+ is required — **CVE-2026-40372** (Data Protection HMAC bug in 10.0.0–10.0.6; undermines the integrity guarantees behind auth cookies, antiforgery and TempData) plus the ASP.NET Core DoS fixes **CVE-2026-42899 / CVE-2026-45591**. SDK 10.0.301+ fixes **CVE-2026-45490** (Windows EoP).

## Program.cs completo

```csharp
var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────
builder.Services.AddRazorPages();
builder.Services.AddControllersWithViews(); // opcional si es pure Razor Pages
builder.Services.AddControllers();          // API controllers

// Data — Dapper para business data
builder.Services.AddScoped<IDbConnection>(_ =>
    new SqlConnection(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<IProductRepository, ProductRepository>();

// Caching (HybridCache L1, opcional L2 con Redis/SQL)
builder.Services.AddHybridCache();

// Output cache (.NET 10 nativo)
builder.Services.AddOutputCache(o =>
{
    o.AddPolicy("ProductDetail", b => b.SetVaryByQuery("id").Expire(TimeSpan.FromMinutes(1)));
    o.AddPolicy("PublicList",   b => b.Expire(TimeSpan.FromMinutes(5)));
});

// Rate limiting (.NET 10 nativo — shared framework, sin paquete NuGet)
builder.Services.AddRateLimiter(o =>
{
    o.AddFixedWindowLimiter("api", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 100;
        opt.QueueLimit = 0;
    });
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// ProblemDetails centralizado (validación + errores)
builder.Services.AddProblemDetails();

// Identity — EF Core SOLO para user store, Dapper para todo lo demás
builder.Services.AddDbContext<AppIdentityDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddIdentity<AppUser, IdentityRole>(o =>
{
    o.Password.RequiredLength = 8;
    o.Lockout.MaxFailedAccessAttempts = 5;
    o.User.RequireUniqueEmail = true;
    o.SignIn.RequireConfirmedEmail = false; // true para producción
})
.AddEntityFrameworkStores<AppIdentityDbContext>()
.AddDefaultTokenProviders();

// Cookie auth (Razor Pages / MVC)
builder.Services.ConfigureApplicationCookie(o =>
{
    o.LoginPath = "/Account/Login";
    o.AccessDeniedPath = "/Account/AccessDenied";
    o.SlidingExpiration = true;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    // No redirigir llamadas API — devolver 401 JSON
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
});

// JWT Bearer (API)
builder.Services.AddAuthentication()
    .AddJwtBearer(o =>
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
            ClockSkew = TimeSpan.FromMinutes(1) // reduce default de 5 min
        };
    });

// Authorization policies
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
    o.AddPolicy("ApiAccess", p => p.RequireAuthenticatedUser()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme));
});

// OpenAPI — nativo en .NET 10 (sin Swashbuckle)
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Middleware pipeline ───────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.MapOpenApi();
    app.MapScalarApiReference(); // /scalar/v1
}
else
{
    app.UseExceptionHandler(); // usa AddProblemDetails() para el cuerpo
    app.UseHsts();
}

app.UseHttpsRedirection();
app.MapStaticAssets();           // .NET 10 — fingerprint + Brotli/Gzip (sustituye a UseStaticFiles)
app.UseRouting();
app.UseRateLimiter();            // ← antes de auth para no procesar req bloqueadas
app.UseAuthentication();         // ← SIEMPRE antes de UseAuthorization
app.UseAuthorization();
app.UseOutputCache();            // ← tras auth (la caché puede variar por usuario)

app.MapRazorPages();
app.MapControllers();

app.Run();
```

> **Orden importa.** Pipeline arriba-orden-abajo:
> 1. Static assets (`MapStaticAssets()` — fingerprint + precompression; no añadir `UseStaticFiles()` salvo contenido fuera del build, p.ej. uploads)
> 2. Routing
> 3. Rate limiting (rechazo temprano)
> 4. AuthN → AuthZ
> 5. Output cache (para no re-correr el pipeline entero si hay hit)
> 6. Endpoints

## appsettings.json

```json
{
  "Jwt": {
    "Key": "your-secret-key-min-32-chars-long!!",
    "Issuer": "https://yourdomain.com",
    "Audience": "https://yourdomain.com"
  },
  "ConnectionStrings": {
    "Default": "Server=.;Database=MyDb;Trusted_Connection=True;TrustServerCertificate=True"
  }
}
```

> ⚠️ En producción usa **Azure Key Vault** o equivalente — nunca commitear el secreto. En dev, `dotnet user-secrets set "Jwt:Key" "..."`.

## Global error handling — `IExceptionHandler` (.NET 8+ idiomático)

En lugar de un lambda gigante en `UseExceptionHandler(...)`, implementa `IExceptionHandler` y registrá varios. El primero que devuelva `true` corta la cadena:

```csharp
// Infrastructure/ExceptionHandlers/GlobalExceptionHandler.cs
public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception on {Path}", httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Title = "An unexpected error occurred.",
                Status = StatusCodes.Status500InternalServerError,
                Detail = httpContext.RequestServices
                    .GetRequiredService<IHostEnvironment>().IsDevelopment()
                    ? exception.Message : null
            }
        });
    }
}

// Program.cs
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
app.UseExceptionHandler();
```

> Manejar errores de forma consistente (sin filtrar detalles internos y sin dejar excepciones sin gestionar) es exactamente lo que **OWASP Top 10:2025 A10 — Mishandling of Exceptional Conditions** pide auditar.

## .NET 11 Preview — Upcoming

> GA previsto noviembre 2026 (STS). No usar en producción.
> .NET 10 LTS → soporte hasta noviembre 2028.

| Feature | Impacto en este stack |
|---------|----------------------|
| `Runtime Async V2` | Elimina deadlocks al mezclar async con primitivas síncronas legacy |
| `Identity TimeProvider` | Identity usa `TimeProvider` — mejor testabilidad para expiración de tokens |
| `Passkeys AAGUID inference` | Nombres automáticos para passkeys hardware (Windows Hello, iCloud, etc.) |
| `OpenAPI 3.2 support` | `AddOpenApi()` puede apuntar a spec OpenAPI 3.2 |
| `Native OpenTelemetry en ASP.NET Core` | Tracing integrado sin paquetes adicionales |
| `IOutputCachePolicyProvider` | Políticas de output cache personalizadas por request |
| `C# 15 collection expression args` | `List<T> items = [with(capacity: n), ..source]` |
| `Microsoft.AspNetCore.Grpc.AspNetCore 3.x` | Solo si se añade gRPC |
| `CoreCLR for WebAssembly` | Solo relevante si se añade Blazor WASM más adelante |

Ruta de migración: .NET 10 → .NET 11 sin breaking changes significativos en este stack.
