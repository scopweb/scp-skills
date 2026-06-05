# @scopweb/scp-skills

> Curated collection of [Claude Code](https://claude.com/claude-code) skills
> by [Scopweb](https://github.com/scopweb) — best practices, audit checklists,
> scaffolding templates, and reference material for production work.

[![version](https://img.shields.io/badge/version-1.6.0-blue.svg)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![skills](https://img.shields.io/badge/skills-15-orange.svg)](#-skill-index)

---

## What is this?

A **skill** is a Markdown bundle (`SKILL.md` + optional `references/`) that
gives Claude Code domain-specific knowledge: conventions, patterns, checklists,
anti-patterns, and reference material. Skills are loaded on demand when a
task matches their triggers.

This repository hosts the full Scopweb skill catalog. Each subdirectory is
an independent skill; the [`package.json`](package.json) is the index.

---

## Quick start

```bash
# Clone the catalog
git clone https://github.com/scopweb/scp-skills.git

# Skills are plain Markdown — no install step.
# Each skill's SKILL.md is self-contained.

# Claude Code will auto-discover skills from any subdirectory
# containing a SKILL.md with valid frontmatter.
```

### Using a specific skill

Skills activate automatically when a task matches their `description` triggers.
To force a skill, ask Claude explicitly:

> *"Apply the `blazor-dotnet10` skill to this new project."*

---

## 📚 Skill index

### .NET & Microsoft stack

| Skill | Stack | Purpose |
|-------|-------|---------|
| [`blazor-dotnet10`](./blazor-Server-net10/SKILL.md) | Blazor Server .NET 10.0.8 | Components, EF Core, Dapper, QuickGrid, SignalR, HybridCache, auth, resilience, health checks |
| [`blazor-security-audit`](./blazor-security-audit/SKILL.md) | Blazor Server .NET 10 | Security audit: auth, authorization, SignalR circuit protection, CSP, OWASP |
| [`razor-dotnet10`](./razor-dotnet10/SKILL.md) | Razor Pages .NET 10 | Pages, Dapper data access, dual Cookie/JWT auth, `Respuesta<T>` response wrapper |
| [`console-dotnet10`](./console-dotnet10/SKILL.md) | .NET 10 CLI | IHost setup, DI, appsettings, Serilog, secrets, `Result<T>`, testing |

### Go

| Skill | Purpose |
|-------|---------|
| [`go-secure`](./go-secure/SKILL.md) | Go secure development: best practices, security patterns, dependency auditing |
| [`go-supply-chain`](./go-supply-chain/SKILL.md) | Security hardening for Go module dependencies: detects malicious code, telemetry, obfuscation, XOR encoding, `go:linkname` abuse, suspicious network calls |

### MCP & AI

| Skill | Purpose |
|-------|---------|
| [`mcp-spec-reviewer`](./mcp-spec-reviewer/SKILL.md) | Review MCP servers against the official MCP spec (2025-11-25): lifecycle, transports, tools, resources, prompts, security, Claude Desktop compat |
| [`mcp-docs-generator`](./mcp-docs-generator/SKILL.md) | Generate professional Astro Starlight documentation sites for MCP servers |

### WordPress

| Skill | Purpose |
|-------|---------|
| [`wp-plugin-development`](./wp-plugin-development/SKILL.md) | Scaffold WordPress plugins from scratch: CPTs, taxonomies, ACF Pro, admin panel, Settings API, external API integration |
| [`wp-plugin-audit`](./wp-plugin-audit/SKILL.md) | Audit existing WordPress plugins: OWASP security, modern PHP 8.x, PHPUnit, PHPCS |
| [`wp-theme-auditor`](./wp-theme-auditor/SKILL.md) | Audit WordPress themes with focus on Divi child themes: enqueue patterns, ET hook safety, ACF Pro, PHP 8.x |
| [`wp-plugin-docs-generator`](./wp-plugin-docs-generator/SKILL.md) | Generate professional Astro Starlight documentation sites for WordPress plugins |

### Documentation & theming

| Skill | Purpose |
|-------|---------|
| [`scopweb-theme`](./scopweb-theme/SKILL.md) | Apply the Scopweb visual theme to Astro Starlight docs: design tokens, typography, social links, CSS customization |

### General / cross-cutting

| Skill | Purpose |
|-------|---------|
| [`naming-i18n`](./Consells-sobre-nomenclatura/SKILL.md) | Conveni de nomenclatura per a equips catalans: anglès al codi, català a comentaris i UI. Inclou glossari ~120 termes i guia per llenguatge (C#, TypeScript, SQL, Python, Go) |

> **Note**: Some additional directories exist in the repository that are **not** in the catalog (`copy-skill/`, `github-profesional/`, `goland/`, `sql-to-model/`, `subagent-driven-development/`, `vue3-scp/`, `address-repair/`, plus a few experimental drafts). They are personal work-in-progress, backups, or pending review. The [`package.json`](package.json) is the source of truth for the official catalog.

---

## 📦 Catalog metadata

The [`package.json`](package.json) is the canonical index:

```json
{
  "name": "@scopweb/scp-skills",
  "version": "1.6.0",
  "skills": [ /* 15 entries */ ]
}
```

| Field | Purpose |
|-------|---------|
| `name` | Skill identifier (kebab-case, English, matches the `name:` field in each SKILL.md) |
| `path` | Relative path to the skill directory (relative to this package.json) |
| `description` | Short summary used for discovery and tooltips |

---

## 🔖 Versioning

This catalog follows [Semantic Versioning](https://semver.org/):

- **MAJOR** bump for breaking changes (skill removed, renamed, behavior changed incompatibly)
- **MINOR** bump for new skills or non-breaking additions
- **PATCH** bump for documentation, typos, internal cleanups

See [CHANGELOG.md](CHANGELOG.md) for the full history.

| Version | Date | Highlights |
|---------|------|------------|
| **1.6.0** | 2026-06-05 | New `naming-i18n` skill + `blazor-dotnet10` expansion to 11 reference files |
| 1.5.0 | 2026 | Added `scopweb-theme`, `console-dotnet10` |
| 1.3.1 | 2026 | Initial public library |

---

## 🤝 Contributing

To add a new skill:

1. Create a new directory at the repo root: `my-new-skill/`
2. Add a `SKILL.md` with proper frontmatter:

   ```markdown
   ---
   name: my-new-skill
   description: >
     One-paragraph description that includes the WHEN and the TRIGGERS.
     Claude uses this to decide when to load the skill.
   license: MIT
   ---

   # My new skill

   ...
   ```

3. (Optional) Add `references/` for deep-dive material
4. Register it in [`package.json`](package.json) under `skills[]`
5. Add an entry in [CHANGELOG.md](CHANGELOG.md) under a new version section
6. Bump the version in `package.json`
7. Commit, tag (`vX.Y.Z`), and push

### Naming conventions

This catalog follows the [`naming-i18n`](./Consells-sobre-nomenclatura/SKILL.md)
skill for **internal documentation** (Catalan for the team). Public-facing
descriptions in `package.json` and `SKILL.md` frontmatter are in **English**
for international discoverability.

---

## 📄 License

[MIT](LICENSE) © Scopweb
