---
name: razor-dotnet10
description: >
  Best practices for ASP.NET Core Razor Pages + MVC + API Controllers with .NET 10 (LTS),
  C# 14, SQL Server, and Dapper. Use this skill for Razor Pages (.cshtml), MVC Controllers,
  API Controllers, authentication (Cookie/Identity + JWT Bearer), minimal middleware pipelines,
  and Dapper data access. Triggers on: Razor Pages, PageModel, @page, MVC controller, IActionResult,
  ActionResult<T>, API endpoint, JWT, cookie auth, Identity, AddAuthentication, AddAuthorization,
  MapControllers, RouteAttribute, ViewData, TempData, ModelState, anti-forgery, Dapper query,
  SqlConnection, Program.cs middleware, or any ASP.NET Core MVC/API pattern.
  Different from blazor-dotnet10 — this skill covers HTTP request/response model, not Blazor circuits.
license: MIT
---

# ASP.NET Core Razor Pages + MVC + API — .NET 10 & C# 14

.NET 10 (LTS, Nov 2025), C# 14. Stack: **Razor Pages** para UI, **API Controllers** para API,
**ASP.NET Core Identity** para auth, **Dapper** para datos, **SQL Server**.

> Stack propio Scopweb/JJP: `Result<T>` / `Respuesta<T>` de `Extct.DTO`, dual auth Cookie+JWT,
> Dapper para business data, EF Core solo para Identity tables.

## Reference Files

| File | Leer cuando... |
|------|----------------|
| [program-cs.md](references/program-cs.md) | Configurar `Program.cs`, pipeline, servicios, Identity, JWT |
| [razor-pages.md](references/razor-pages.md) | PageModel, routing, handlers, model binding, validación, TempData |
| [api-controllers.md](references/api-controllers.md) | ApiController, routing, ActionResult, filtros, versioning, OpenAPI |
| [auth.md](references/auth.md) | Identity setup, Cookie auth, JWT Bearer, policies, claims, anti-forgery |
| [dapper.md](references/dapper.md) | SqlConnection, queries, transactions, patrones Dapper |
| [anti-patterns.md](references/anti-patterns.md) | Errores comunes en Razor Pages, MVC, auth, Dapper |

Leer el reference relevante **antes** de implementar.

---

## Project Setup

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Dapper" Version="2.*" />
    <PackageReference Include="Microsoft.Data.SqlClient" Version="5.*" />
    <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="10.*" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.*" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.*" />
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.*" />
    <PackageReference Include="Scalar.AspNetCore" Version="2.*" />
  </ItemGroup>
</Project>
```

---

## MANDATORY Patterns

| Task | ✅ SIEMPRE | ❌ NUNCA |
|------|-----------|---------|
| DB queries | Dapper + `CommandDefinition` + CT | `string.Format` SQL |
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

---

## .NET 11 — Upcoming

> GA previsto noviembre 2026 (STS). **No usar en producción aún.**
> Ver tabla completa en `references/program-cs.md` sección `.NET 11 Preview`.

Cambios relevantes: Runtime Async V2, Identity TimeProvider, OpenAPI 3.2, OpenTelemetry nativo, C# 15.
