# Program.cs — Razor Pages + API + Auth Pipeline

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

// Identity — EF Core SOLO para user store, Dapper para todo lo demás
builder.Services.AddDbContext<AppIdentityDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddIdentity<AppUser, IdentityRole>(o =>
{
    o.Password.RequiredLength = 8;
    o.Lockout.MaxFailedAccessAttempts = 5;
    o.User.RequireUniqueEmail = true;
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
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

// Authorization policies
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
    o.AddPolicy("ApiAccess", p => p.RequireAuthenticatedUser()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme));
});

// OpenAPI — Scalar UI reemplaza Swagger en .NET 10
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
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication(); // ← SIEMPRE antes de UseAuthorization
app.UseAuthorization();

app.MapRazorPages();
app.MapControllers();

app.Run();
```

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

---

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
| `CoreCLR for WebAssembly` | Solo relevante si se añade Blazor WASM más adelante |

Ruta de migración: .NET 10 → .NET 11 sin breaking changes significativos en este stack.
