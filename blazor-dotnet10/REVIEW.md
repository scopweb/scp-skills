# Review of blazor-Server-net10 Skill (for .NET 10.0.8 / SDK 10.0.300)

**Date of review**: 2026 (current session)  
**Skill location**: `C:\MCPs\SKILLS\blazor-Server-net10`  
**Target**: Blazor Server .NET 10.0.8 (LTS), SDK 10.0.300, C# 14, EF Core + Dapper, SQL Server  
**Reviewer**: Grok (via deep file reads, cross-skill comparison, env verification with exact SDK/runtime, compilation experiments, web searches for official confirmation)

> **Addendum (Jul 2026)**: the skill has since been updated to **.NET 10.0.9 / SDK 10.0.301** (Jun 2026 servicing band) and now documents the June 2026 CVEs relevant to Blazor Server (**CVE-2026-45591** SignalR MessagePack DoS, **CVE-2026-40372** DataProtection HMAC, **CVE-2026-45490** dotnet.exe workload EoP) plus the EF Core 10 highlights (named query filters, SQL Server 2025 JSON/VECTOR). Version references below to 10.0.8 / SDK 10.0.300 reflect the state at the time of this review and are kept for traceability. The P0 fixes listed at the end were applied; the QuickGrid `RowClass` gap (P1 #7) has also been addressed.

## Executive Summary

This is a **high-quality, specialized, production-oriented skill** focused exclusively on the unique challenges of **Blazor Server** (long-lived SignalR circuits, state, concurrency, prerender handoff) on the precise .NET 10.0.8 band. It correctly differentiates itself from the sibling `razor-dotnet10` skill (HTTP request/response model).

**Strengths** (many):
- Deep, correct emphasis on Blazor Server circuit semantics (IDbContextFactory, *always* async Dapper + CommandDefinition + CT, InvokeAsync(StateHasChanged), PersistentComponentState + StreamRendering to avoid double-fetch, ErrorBoundary placement, SemaphoreSlim for concurrent clicks).
- Excellent decision tables, mandatory patterns checklist, anti-patterns catalog.
- Strong, consistent advocacy for `Result<T>` (Extct.DTO) for domain errors, primary constructors, records for DTOs, CancellationToken propagation, DateTime.UtcNow, short-lived connections/contexts.
- Accurate coverage of C# 14 (extension blocks/members, `field` keyword, null-conditional assignment `?.=`, pattern matching).
- Good integration points with `blazor-security-audit` (auth, circuits, hardening).
- Version pinning guidance (global.json + optional RuntimeFrameworkVersion) is precise and matches the environment (SDK 10.0.300 ships exactly runtime 10.0.8).

**Critical Issues Found** (must fix):
1. **Factual error: `AddDbConnectionFactory<T>` is not built-in**. Code examples will not compile. See detailed section.
2. **Misleading "built-in" language for HybridCache and resilience**. Packages are required; no `PackageReference` examples provided anywhere.
3. **Outdated Blazor Server registration example** for CircuitOptions (uses pre-.NET 8 `AddServerSideBlazor`).

**Other Issues** (medium/high priority for polish):
- Duplicated ErrorBoundary content in `blazor-server.md`.
- No alignment with modern project structure from `dotnet-project-structure` skill (.slnx, Directory.Build.props, CPM, etc.).
- Missing consolidated package reference list (unlike `razor-dotnet10`).
- Minor feature gaps (e.g., QuickGrid `RowClass` added in .NET 10).
- Some internal assumptions (Extct.DTO) not documented for external consumers of the skill.

Overall rating: **8.5/10** — excellent domain depth for its niche; a few factual/ completeness fixes will make it 9.5+.

The skill was read **completely** (SKILL.md + all 10 references). Cross-checked against:
- `blazor-security-audit` (and its refs)
- `razor-dotnet10`
- `console-dotnet10`
- `dotnet-project-structure`
- `dotnet-core-expert` (older .NET 8 focused)
- Live env: exact 10.0.300 SDK + 10.0.8 runtime present.
- Compilation tests (temp projects with global.json pinned to 10.0.300).
- Web searches for official .NET 10 / C# 14 / Blazor / HybridCache confirmation (learn.microsoft.com, release notes, blogs).

## Verified Version & Feature Alignment

| Claim in Skill | Verification | Status |
|---------------|--------------|--------|
| .NET Runtime 10.0.8, SDK 10.0.300, C# 14, `net10.0` / `LangVersion=14` | `dotnet --list-sdks/runtimes` in workspace confirms exact band present. global.json example correct. | ✅ |
| Extension blocks, `field` keyword, `order?.Notes = "..."` (null-cond assign) | Official C# 14 release notes + multiple deep-dive articles confirm exact syntax and semantics used in `csharp-14.md`. | ✅ |
| HybridCache (L1+L2, stampede, tags, `GetOrCreateAsync<T>`) | GA/stable in .NET 10 per MS docs. Package `Microsoft.Extensions.Caching.Hybrid` required. | ⚠️ (package claim loose) |
| QuickGrid (built-in, ItemsProvider, Virtualize, Pagination) | Stabilized .NET 8; .NET 10 added `RowClass` etc. | ✅ (minor gap) |
| `AddDbContextFactory` + short-lived contexts | Core, correct for Blazor Server. | ✅ |
| PersistentComponentState + `[StreamRendering]` for prerender handoff | Core .NET 8+ feature, heavily improved/emphasized in .NET 10 docs. Skill coverage excellent. | ✅ |
| Polly v8 via `AddStandardResilienceHandler` / `AddResiliencePipeline` | Integrated via `Microsoft.Extensions.Http.Resilience` + `Microsoft.Extensions.Resilience` packages (shipped with .NET 8+). | ⚠️ (phrasing) |

## Detailed Findings by File

### SKILL.md (main entry point)

**Positives**:
- Frontmatter description + triggers excellent (distinguishes circuit vs HTTP).
- "MANDATORY Patterns" table is gold — forces good architecture.
- Decision flowcharts useful.
- Quick patterns section gives copy-paste value while pointing to refs.
- Correctly calls out "Never access DbContext directly from components".

**Issues**:
- No `<PackageReference>` section at all (critical for HybridCache, Resilience, Dapper + Microsoft.Data.SqlClient, EF, etc.).
- Project Setup shows only minimal csproj + global.json. Should at minimum cross-link `dotnet-project-structure` and show a starter with `ImplicitUsings`, `TreatWarningsAsErrors`, etc.
- Quick HybridCache / Resilience examples omit the required package.
- Spanish strings in some examples ("Cargando...", "Hola") while rest English — acceptable if audience is Spanish-speaking, but note inconsistency.
- Promotes `Extct.DTO.Result<T>` heavily with `Success`/`SuccessM`/`Failure`/`FailureM` but no source or package reference.

### references/dapper-data.md (most problematic file)

**Core Error**:
```csharp
// ❌ Does not exist
builder.Services.AddDbConnectionFactory<SqlConnection>(
    builder.Configuration.GetConnectionString("Default"));
```
**Empirical proof**: Scaffolding a net10.0 web app (global.json pinned 10.0.300) + Microsoft.Data.SqlClient + injecting the call produces:
- CS0246: SqlConnection not found (missing using, but more importantly)
- CS1061: "IServiceCollection" does not contain a definition for "AddDbConnectionFactory"

The custom `SqlConnectionFactory : IDbConnectionFactory` + `AddSingleton<IDbConnectionFactory>` example later in the file is the **correct** pattern. The "Built-in factory" header and registration line are wrong/misleading.

**Recommendations**:
- Remove or clearly mark "built-in" claim.
- Always show the interface + impl + registration of the impl.
- Optionally provide a small reusable extension method example if the org wants the `AddDbConnectionFactory<T>` sugar.
- Emphasize `await using var conn = await factory.CreateConnectionAsync(ct);` + `CommandDefinition(..., cancellationToken: ct)` — this part is excellent.

Other Dapper content (CommandDefinition, multi-mapping, transactions, type handlers, bulk, EF+Dapper hybrid, anti-patterns returning lazy IEnumerable) is **very strong**.

### references/blazor-server.md

**Issue: Legacy registration** (SignalR / Circuit section):
```csharp
builder.Services.AddServerSideBlazor()
    .AddCircuitOptions(options => { ... });
```
This is the old model. Modern .NET 8/9/10 Blazor Server:
```csharp
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents(options => { ... DisconnectedCircuit* ... });
...
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();
```
(The `CircuitOptions` surface is similar but attached differently.)

Cross-reference: `blazor-security-audit/references/circuit-and-signalr.md` and main SKILL use the modern `AddRazorComponents` + `AddInteractiveServerComponents` (good).

**Duplication**:
- "Error Boundaries" heading + example (~line 261)
- Then later full "## ErrorBoundary" section with almost identical content and App-level wrapper (~line 327).
Remove one.

**Other**:
- Lifecycle, parameters, cascading, StateHasChanged rules, forms, JS interop, localization, streaming — all accurate and well explained.
- Good callout that ErrorBoundary does **not** catch event handler exceptions (must wrap in try/catch).

### references/hybrid-cache.md

**Good**:
- Excellent coverage of stampede protection, tags, `ValueTask`, caching `Result<T>`, lists, LocalCacheExpiration vs Expiration.
- Anti-patterns solid (don't cache lazy IEnumerable or DbContext).

**Issue**:
- Opening sentence: "`Microsoft.Extensions.Caching.Hybrid` is the modern, two-tier cache **built into** .NET 9 and stable in .NET 10."
  Reality (official docs): Install the package explicitly. Not "in the box" without the reference.
- No `dotnet add package` or csproj snippet in registration section.
- For L1+L2 it shows `AddStackExchangeRedisCache` + `AddHybridCache` but no package for either.

### references/resilience.md

Similar phrasing issue:
> .NET 8 ships **Polly v8** integrated into `Microsoft.Extensions.Http.Resilience`.

Accurate enough (the integration package), but examples should mention the package (or assume it's in a shared Directory.Packages.props).

Non-HTTP pipelines for Dapper (targeting specific SqlException numbers for deadlock/timeout) are pragmatic and good.

Observability notes nice.

### references/ef-core-data.md

**Excellent**:
- IDbContextFactory requirement explained perfectly for Blazor.
- AsNoTracking, projections, SplitQuery, CompiledQuery, keyset pagination, FromSqlInterpolated, views, SPs, FILESTREAM pattern (separate *_Blobs table), explicit transactions, tinyint casting gotcha, migrations (idempotent scripts, no auto-migrate prod).

Minor: The compiled query example uses a static `Func<...>` capturing `ctx` from outer scope — in practice the factory-created ctx must be passed in. Minor nit.

### references/quickgrid.md

Solid for <1k / paged / virtualized.

**Gap**: .NET 10 added `RowClass` parameter (confirmed via release notes / articles). Example:
```razor
<QuickGrid ... RowClass="@(o => o.Status == Overdue ? "row-danger" : null)">
```
Worth adding under "Row Click / Selection" or new "Styling" subsection.

`Items` expects `IQueryable<T>` at service boundary — correctly noted (materialize in service for Dapper path).

### references/auth.md

Good high-level for Blazor side (cascading, AuthorizeView, [Authorize], programmatic via AuthenticationStateProvider, resource-based with handlers, custom ASP, UserContext scoped for non-identity per-circuit state).

**Cross-check with blazor-security-audit**:
- Overlap is healthy (this one = "how to use", security one = "harden + audit").
- Minor: this uses `IdentityConstants.ApplicationCookie`; security uses `CookieAuthenticationDefaults`. Both fine.
- Good warning never to trust UI-only checks.

### references/persistent-state.md

One of the best files. Correctly explains the double-fetch problem, `RegisterOnPersisting` timing, TryTake before load, async PersistAsJsonAsync, combining with StreamRendering, what *not* to persist (connections, secrets, large blobs).

Anti-patterns section calls out the common "register after load" mistake.

Scoped service distinction is important.

### references/health-checks.md

Correct live vs ready separation (Predicate), tags, custom IHealthCheck for HybridCache, ResponseWriter for JSON, auth on endpoints.

Anti-patterns good (don't put DB in /live, don't duplicate EF+SqlServer checks, etc.).

### references/anti-patterns.md

Comprehensive and ruthless (the right tone for a "best practices" skill). Covers Blazor (DbContext in component, StateHasChanged from wrong thread, HTML forms, missing IDisposable, redundant StateHasChanged, huge .razor files), EF (N+1, tracked reads, full entities), Dapper (sync, held conn, lazy return, missing tx, raw in component, SELECT *), async (.Result, async void, no CT), DI (captive), HttpClient new(), SQL (OR in JOINs, tinyint cast, missing indexes), UI (desktop tables on mobile, else-if status icons).

All map back to advice in other files.

### references/csharp-14.md

Accurate, practical examples for the features that matter in this stack (field for validation/lazy/INPC, extension blocks for domain math, null-conditional assign, primary ctors, records, collection expr, async patterns, nullable discipline).

Good "old style vs new" comparisons.

## Cross-Skill Consistency

- **Good alignment** on `Result<T>` philosophy, `net10.0` + `LangVersion=14`, `DateTime.UtcNow`, primary constructors, CT everywhere, async-all-the-way, Dapper `CommandDefinition`.
- **Blazor vs Razor split** is respected (this skill never talks HTTP controllers; razor one avoids circuit concerns).
- **Security**: Proper handoff — this skill says "see blazor-security-audit for hardening"; security skill does not duplicate component lifecycle.
- **Project structure**: This skill is behind `dotnet-project-structure` (no .slnx, no Directory.* props, no central packages, no RELEASE_NOTES). Opportunity to modernize.
- `dotnet-core-expert` is .NET 8 / MAUI focused — not directly conflicting.

## Recommendations (Prioritized)

### P0 (Correctness — do first)
1. Fix Dapper connection factory:
   - Update `dapper-data.md` and SKILL.md quick example.
   - Show interface + concrete factory + `AddSingleton` (or AddScoped if appropriate).
   - Remove "built-in" / "AddDbConnectionFactory<>" sugar or clearly label as "optional helper you can add".
2. Add package installation guidance:
   - In SKILL.md "Project Setup" add full recommended ItemGroup (EF, Dapper, Microsoft.Data.SqlClient, HybridCache, Http.Resilience, etc.).
   - Update hybrid-cache.md + resilience.md + SKILL.md quick sections with `dotnet add package ...` or csproj.
3. Update the CircuitOptions example in `blazor-server.md` to modern `AddRazorComponents` + `AddInteractiveServerComponents`.

### P1 (Completeness / Polish)
4. Deduplicate ErrorBoundary content in `blazor-server.md`.
5. Add "Modern .NET Project Structure" subsection or explicit link + minimal example from `dotnet-project-structure` (global.json is already there; add .slnx note, Directory.Build.props for LangVersion/Nullable/TreatWarningsAsErrors).
6. Document or link the `Extct.DTO` Result<T> (at least a one-liner: "Internal/Extct.DTO package providing SuccessM/FailureM variants").
7. Add QuickGrid `RowClass` example.
8. Add a "Required NuGet Packages" table or section (can live in SKILL.md or new small ref).
9. In csharp-14.md or SKILL, note that extension blocks live inside a static class.

### P2 (Nice-to-have)
10. Add a small ".NET 10 Blazor Server delta" callout (PersistentComponentState improvements, any QuickGrid RowClass, form validation, etc.).
11. Consider a one-page "cheat sheet" summary (or strengthen the MANDATORY table).
12. Ensure all code samples consistently use `sealed`, primary constructors, `= default!` for [Inject], `IReadOnlyList<T>` returns, etc.
13. Add health check for Dapper connectivity (similar to HybridCache example).

## Suggested Next Steps for Maintainer

1. Apply P0 fixes (I can assist with search_replace or implement).
2. Run the updated skill against a real Blazor Server net10.0 project (compile + runtime circuit tests).
3. Optionally spawn a "best-of-n" or review subagent for further polish.
4. Add this `REVIEW.md` (or a CHANGELOG entry) to the skill.

## Fixes Applied During This Review (P0 Criticals)

- **dapper-data.md**: Removed false "built-in `AddDbConnectionFactory<T>`" claim and non-compiling registration. Now correctly documents that you implement `IDbConnectionFactory<T>` + `SqlConnectionFactory` (with interface shown) and register via `AddSingleton<IDbConnectionFactory<SqlConnection>>`. Updated header, registration, and implementation for consistency (generic interface + concrete return).
- **SKILL.md**:
  - Updated the Dapper "quick pattern" registration example to use the explicit `AddSingleton` of the factory (with comment pointing to dapper-data.md).
  - Added full recommended `<ItemGroup>` of packages (EF, Dapper/SqlClient, HybridCache, Http.Resilience, Resilience) in Project Setup.
  - Added note + link to `dotnet-project-structure` skill for .slnx / Directory.* / central packages.
  - Tweaked "built into" phrasing for HybridCache and Resilience sections to be accurate.
- **references/blazor-server.md**:
  - Replaced legacy `AddServerSideBlazor().AddCircuitOptions(...)` example with modern `AddRazorComponents().AddInteractiveServerComponents(...)` (cross-ref to security skill for the MapRazorComponents side).
  - Removed the short/duplicate "## Error Boundaries" section + example (the later detailed "## ErrorBoundary" + app-level + limits + "does not catch event handlers" remains and is authoritative).
- **references/hybrid-cache.md**: Clarified opening sentence: it's delivered via the `Microsoft.Extensions.Caching.Hybrid` NuGet package (stable in .NET 10) rather than purely "built into" the runtime.

These changes were verified for textual uniqueness before edit. The Dapper factory change was the highest-severity correctness fix (would have caused compile failures for anyone following the skill literally).

## Remaining Recommendations (from original analysis)

(See the P1/P2 list earlier in this document — especially adding QuickGrid RowClass example, documenting Extct.DTO source, and ensuring all samples stay in sync after the hosting model update.)

## Appendix: Compilation / Env Evidence (excerpts)

- SDK list confirmed 10.0.300 present alongside 10.0.108/204 and 11 preview.
- Runtime: Microsoft.NETCore.App 10.0.8 exactly.
- AddDbConnectionFactory test: explicit CS1061 + CS0246 on pinned 10.0.300 project.
- HybridCache: requires package (builds only after `dotnet add`).

All tool calls, searches, and file reads performed in this session for traceability.

---

**End of Review**. The skill is already one of the stronger domain-specific ones in the collection; the P0 fixes (especially the Dapper factory + packages + modern registration) significantly improve correctness and usability. Ready for use in Blazor Server .NET 10.0.8 / SDK 10.0.300 work.
