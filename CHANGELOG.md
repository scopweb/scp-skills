# Changelog

All notable changes to the `@scopweb/scp-skills` package (the catalog of agent skills) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.6.0] — 2026-06-05

### Added
- **New skill**: `naming-i18n` — Conveni de nomenclatura per a equips catalans.
  Anglès al codi (identificadors, BD, API, Git), català a comentaris i textos UI.
  Inclou glossari català→anglès (~120 termes) i guia per llenguatge
  (C#, TypeScript, SQL, Python, Go, Git, JSON, HTML, env vars).
  Path: `./Consells-sobre-nomenclatura/`

- **New keywords** in `package.json`: `naming`, `nomenclature`, `i18n`,
  `localization`, `catalan`, `conventions`

### Changed
- **`blazor-dotnet10` (path `./blazor-Server-net10/`)** — Major expansion
  - **Updated to .NET 10.0.8 / SDK 10.0.300 / C# 14**
  - **7 new reference files**: `dapper-data.md`, `quickgrid.md`, `auth.md`,
    `persistent-state.md`, `hybrid-cache.md`, `resilience.md`, `health-checks.md`
  - `SKILL.md` updated with Versions table, `Directory.Build.props` sample,
    full `<ItemGroup>` of packages, 7 new quick-patterns subsections,
    expanded `MANDATORY Patterns` table, `Data Access (EF vs Dapper)` flowchart
  - `anti-patterns.md` — new Dapper anti-patterns section
  - `blazor-server.md` — modern `AddRazorComponents().AddInteractiveServerComponents(...)`
    registration, dedup of `ErrorBoundary` content
  - P0 fixes from `REVIEW.md` (custom `IDbConnectionFactory<T>` for Dapper,
    accurate "via NuGet package" wording for HybridCache / Resilience)

### Documentation
- `REVIEW.md` added inside `blazor-Server-net10/` documenting the deep
  audit and P0/P1/P2 findings (kept for traceability)

### Stats
- 12 new files
- 1 directory renamed / promoted (sketched inside blazor-Server-net10, then
  moved to top-level as a general skill)
- ~3000 lines added
- Skill count: 14 → **15**

---

## [1.5.0] — 2026

### Added
- Skill: `scopweb-theme` (Astro Starlight visual theme for Scopweb docs)
- Skill: `console-dotnet10` (Best practices for .NET 10 CLI tools)

### Changed
- `blazor-dotnet10`: Pinned to .NET 10 LTS baseline, C# 14
- `blazor-dotnet10`: `SKILL.md` rewritten for circuit-aware patterns

---

## [1.3.1] — 2026

### Added
- Initial public skills library

---

[Unreleased]: https://github.com/scopweb/scp-skills/compare/v1.6.0...HEAD
[1.6.0]: https://github.com/scopweb/scp-skills/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/scopweb/scp-skills/compare/v1.3.1...v1.5.0
[1.3.1]: https://github.com/scopweb/scp-skills/releases/tag/v1.3.1
