---
name: razor-dotnet10
description: >
  Best practices for ASP.NET Core Razor Pages + MVC + API Controllers with .NET 10.0.9
  (SDK 10.0.301, Jun 2026 LTS), C# 14, SQL Server, and Dapper. Use this skill for
  Razor Pages (.cshtml), MVC Controllers, API Controllers, authentication
  (Cookie/Identity + JWT Bearer), minimal middleware pipelines, and Dapper data access.
  Triggers on: Razor Pages, PageModel, @page, MVC controller, IActionResult,
  ActionResult of T, API endpoint, JWT, cookie auth, Identity, AddAuthentication,
  AddAuthorization, MapControllers, RouteAttribute, ViewData, TempData, ModelState,
  anti-forgery, Dapper query, SqlConnection, Program.cs middleware, or any
  ASP.NET Core MVC/API pattern.
  Different from blazor-dotnet10 — this skill covers HTTP request/response model,
  not Blazor circuits.
license: MIT
---

# ASP.NET Core Razor Pages + MVC + API — .NET 10 & C# 14

**.NET 10.0.9** (LTS — .NET 10 GA Nov 2025; current patch Jun 2026) with **SDK 10.0.301** and **C# 14**.
Focused on the **HTTP request/response** model (Razor Pages, MVC, API Controllers).

## Versions

| Component | Version |
|-----------|---------|
| .NET Runtime | 10.0.9 |
| .NET SDK | 10.0.301 |
| C# | 14 |
| TargetFramework | `net10.0` |
| LangVersion | `14` |

> SDK 10.0.301 is the banded SDK that ships 10.0.9 — pin your `global.json` to it for reproducible builds.
>
> **10.0.9 is a security patch (Jun 9 2026)** — stay on the latest 10.0.x. June 2026 fixes relevant here:
>
> - **CVE-2026-40372** — `Microsoft.AspNetCore.DataProtection` 10.0.0–10.0.6 computed the HMAC over the wrong bytes. Data Protection backs auth cookies, antiforgery tokens and TempData, so **require runtime 10.0.9+** (and 10.0.9+ of the standalone DataProtection packages if referenced directly).
> - **CVE-2026-42899 / CVE-2026-45591** — ASP.NET Core denial-of-service; patched in 10.0.9.
> - **CVE-2026-45490** — elevation of privilege in the .NET SDK on Windows; require **SDK 10.0.301+** (pinned below).
> - **CVE-2026-45491** — `TarFile.ExtractToDirectory` symlink traversal; relevant if you extract user-supplied archives.
>
> Align security reviews with **OWASP Top 10:2025** (new: A03 Software Supply Chain Failures, A10 Mishandling of Exceptional Conditions; SSRF now folds into A01). For a full audit (cookies, antiforgery, JWT validation, redirect handling), use the **`blazor-security-audit`** skill — its checklist applies to Razor/MVC/API too.

## What's New in .NET 10 (Razor/MVC/API)

The deltas most relevant to a request/response app:

- **`MapStaticAssets()`** — fingerprinted static web assets with Brotli/Gzip precompression (~76% smaller JS/CSS). Use it instead of `UseStaticFiles()` so framework and tag-helper CSS/JS bundles pick up fingerprinting and long-lived caching.
- **Native OpenAPI source generator** — `AddOpenApi()` ships the OpenAPI 3.x spec out of the box; pair with `Scalar.AspNetCore` for the UI in dev. No more Swashbuckle dependency.
- **`OutputCache` middleware** — first-class response caching with policies, tags, and `IOutputCacheStore` (Redis/SQL) for distributed scenarios.
- **HybridCache (`Microsoft.Extensions.Caching.Hybrid`)** — L1 + optional L2 cache with stampede protection. Great fit for reference data and hot Dapper reads.
- **`ProblemDetails` enhancements** — `IProblemDetailsService` + `AddProblemDetails()` for central validation/error responses. `IExceptionHandler` (introduced in .NET 8) is now the idiomatic replacement for `UseExceptionHandler` lambdas.
- **`TimeProvider` injection** — `services.AddSingleton(TimeProvider.System)` so services can be unit-tested without `DateTime.UtcNow`.
- **Rate limiting middleware** (`AddRateLimiter` / `UseRateLimiter`) — built-in token-bucket/fixed-window/sliding-window/concurrency limiters, part of the shared framework (namespace `Microsoft.AspNetCore.RateLimiting`). No NuGet package needed for basic throttling.
- **Passkeys / WebAuthn** first-class in Identity (`IdentityPasskey<TUser>`) — passwordless login with hardware keys.
- **C# 14** — `field` keyword, extension blocks, null-conditional assignment, more pattern-matching ergonomics — see the highlights block below.

> See **`blazor-dotnet10`** for the **Blazor Server** circuit-specific changes (`ReconnectModal`, `[PersistentState]`, `NotFound()`, etc.) — they don't apply here.

## Reference Files

| File | Read when... |
|------|--------------|
| [program-cs.md](references/program-cs.md) | Configuring `Program.cs`, pipeline, services, Identity, JWT, Scalar/OpenAPI |
| [razor-pages.md](references/razor-pages.md) | PageModel, routing, handlers, model binding, validation, TempData, tag helpers |
| [api-controllers.md](references/api-controllers.md) | `[ApiController]`, routing, `ActionResult<T>`, filters, versioning, ProblemDetails, OpenAPI |
| [auth.md](references/auth.md) | Identity setup, Cookie + JWT Bearer dual auth, policies, claims, antiforgery |
| [dapper.md](references/dapper.md) | `SqlConnection`, `CommandDefinition`, transactions, TVP, multi-mapping, repository pattern |
| [anti-patterns.md](references/anti-patterns.md) | Common mistakes in Razor Pages, MVC, auth, Dapper, async, DI |

Read the relevant reference file **before** implementing.

---

## Project Setup

### Pin SDK with `global.json`

Place at repo root to lock the SDK to **10.0.301** for reproducible builds:

```json
{
  "sdk": {
    "version": "10.0.301",
    "rollForward": "latestFeature"
  }
}
```

### Shared MSBuild properties (`Directory.Build.props`)

Place at repo root to apply consistent settings across every project in the solution. Each `.csproj` inherits these automatically:

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <WarningsNotAsErrors>CS1591</WarningsNotAsErrors> <!-- missing XML doc; noisy -->
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
    <!-- Pin runtime to 10.0.9 for self-contained/published apps -->
    <RuntimeFrameworkVersion>10.0.9</RuntimeFrameworkVersion>
    <ServerGarbageCollection>true</ServerGarbageCollection>
  </PropertyGroup>

  <ItemGroup>
    <!-- Data access -->
    <PackageReference Include="Dapper" Version="2.*" />
    <PackageReference Include="Microsoft.Data.SqlClient" Version="6.*" />

    <!-- Identity (EF Core only for Identity tables) -->
    <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="10.*" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.*" />

    <!-- Auth — JWT Bearer for API endpoints -->
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.*" />

    <!-- OpenAPI + Scalar UI (replaces Swashbuckle in .NET 10) -->
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.*" />
    <PackageReference Include="Scalar.AspNetCore" Version="2.*" />

    <!-- Caching -->
    <PackageReference Include="Microsoft.Extensions.Caching.Hybrid" Version="10.*" />
    <!-- Rate limiting + output cache middleware ship in the shared framework — no package needed -->
  </ItemGroup>
</Project>
```

> `TargetFramework` stays `net10.0` (a floating major). `RuntimeFrameworkVersion` is what pins the **runtime** patch to `10.0.9`; `global.json` pins the **SDK** band to `10.0.301`. Use both when reproducibility matters.
>
> For full modern structure (`.slnx`, `Directory.Build.props`, central package management via `Directory.Packages.props`, SourceLink, `RELEASE_NOTES.md`), see the `dotnet-project-structure` skill.

---

## MANDATORY Patterns

| Task | ✅ SIEMPRE | ❌ NUNCA |
|------|-----------|---------|
| DB queries | Dapper + `CommandDefinition` + CT | `string.Format` / interpolated SQL |
| Identity DB | EF Core (solo Identity tables) | Dapper para Identity |
| Business data | Dapper | EF Core para queries de negocio |
| Service returns | `Result<T>` / `Respuesta<T>` de `Extct.DTO` | Lanzar excepciones para errores de dominio |
| API errors | `ProblemDetails` / respuestas tipadas | `throw` desde controller |
| Timestamps | `DateTime.UtcNow` / `SYSUTCDATETIME()` | `DateTime.Now` |
| Async | `await` + CT en toda la cadena | `.Result` / `.Wait()` |
| Input models | Record `InputModel` separado | Bindear directamente la entidad de dominio |
| Auth routes | `[Authorize]` en PageModel o action | Comprobar `User.Identity` manualmente |
| Redirect tras POST | `RedirectToPage` / `RedirectToAction` | Devolver `Page()` tras éxito |
| JWT secret | `appsettings.json` + user secrets | Hardcodeado en código fuente |
| Static assets | `app.MapStaticAssets()` | `app.UseStaticFiles()` en .NET 10 |
| Validation errors | `AddProblemDetails()` + `IProblemDetailsService` | Custom JSON error shape per controller |
| Throttling | `AddRateLimiter` built-in middleware (shared framework) | Homegrown token bucket / IP checks |

---

## Quick Patterns

### Dual auth (Cookie + JWT) in one pipeline

```csharp
builder.Services.AddAuthentication(o =>
{
    o.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    o.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
})
.AddCookie(o =>
{
    o.LoginPath = "/Account/Login";
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
        ClockSkew = TimeSpan.FromMinutes(1) // reduce from 5 min default
    };
});
```

See [auth.md](references/auth.md) for policies, claim helpers, and Identity seeding.

### Output cache (`.NET 10` native)

```csharp
builder.Services.AddOutputCache(o =>
{
    o.AddPolicy("ProductDetail", b => b.SetVaryByQuery("id").Expire(TimeSpan.FromMinutes(1)));
    o.AddPolicy("PublicList",   b => b.Expire(TimeSpan.FromMinutes(5)));
});

app.UseOutputCache();
app.MapGet("/api/products/{id:int}", ...).CacheOutput("ProductDetail");
app.MapGet("/api/public/catalog", ...).CacheOutput("PublicList");
```

### Rate limiting (built-in)

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.AddFixedWindowLimiter("api", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 100;
        opt.QueueLimit = 0; // reject immediately, don't queue
    });
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

app.UseRateLimiter();
app.MapControllers().RequireRateLimiting("api");
```

### C# 14 Highlights

```csharp
// field keyword — no manual backing field
public string Name
{
    get => field;
    set => field = value?.Trim() ?? string.Empty;
}

// Extension blocks (must live inside a static class)
public static class StringExtensions
{
    extension(string s)
    {
        public bool IsBlank() => string.IsNullOrWhiteSpace(s);
        public string Truncate(int max) => s.Length <= max ? s : s[..max] + "…";
    }
}

// Null-conditional assignment
user?.LastSeenAt = DateTime.UtcNow;

// Pattern matching with switch expressions
var status = order.State switch
{
    { IsPaid: true, IsShipped: false } => "ready_to_ship",
    { IsShipped: true }                => "completed",
    _                                  => "pending"
};
```

### Static assets (`MapStaticAssets`)

In .NET 10, replace `UseStaticFiles()` with `MapStaticAssets()` so CSS/JS bundles get fingerprinted URLs + Brotli/Gzip precompression:

```csharp
// ❌ Old .NET 8 style
app.UseStaticFiles();

// ✅ .NET 10 — fingerprinting + precompression
app.MapStaticAssets();
```

`<link>` and `<script>` tag helpers output the fingerprinted URLs automatically once `MapStaticAssets()` is in the pipeline.

---

## .NET 11 — Upcoming

> GA previsto noviembre 2026 (STS). **No usar en producción aún.**
> Ver tabla completa en [references/program-cs.md](references/program-cs.md) sección ".NET 11 Preview".

Cambios relevantes: Runtime Async V2, Identity TimeProvider, OpenAPI 3.2, OpenTelemetry nativo, C# 15.
