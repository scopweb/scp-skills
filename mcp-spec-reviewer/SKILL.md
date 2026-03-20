---
name: mcp-spec-reviewer
description: Review and validate MCP servers against the official Model Context Protocol specification (2025-11-25). Use when building new MCP servers, auditing existing ones, or verifying compliance with protocol requirements. Covers lifecycle, transports, tools, resources, prompts, client features, security, and all MUST/SHOULD/MAY requirements.
license: MIT
---

# MCP Specification Reviewer

## Purpose

Validate MCP server implementations against the **official MCP specification (revision 2025-11-25)**.
Use this skill to:
- **Review** an existing MCP server for spec compliance
- **Guide** creation of a new MCP server with correct protocol adherence
- **Audit** MUST/SHOULD/MAY requirement coverage

Source of truth: https://modelcontextprotocol.io/specification/2025-11-25
TypeScript schema: https://github.com/modelcontextprotocol/specification/blob/main/schema/2025-11-25/schema.ts

> ℹ️ **Estado del ecosistema (marzo 2026)**: La spec vigente sigue siendo **2025-11-25**. No hay versión nueva publicada todavía. El roadmap 2026 tiene prioridades activas (ver notas en archivos de referencia).

---

## Quick Review Process

### Step 1: Identify what the MCP implements
Determine which features the server exposes:
- [ ] Tools
- [ ] Resources
- [ ] Prompts
- [ ] Logging
- [ ] Completions
- [ ] Tasks (experimental)

### Step 2: Check base protocol compliance
Read [protocol-overview.md](./reference/protocol-overview.md) and verify:
- [ ] JSON-RPC 2.0 message format (UTF-8 encoded)
- [ ] Request IDs are string or integer, never null
- [ ] Proper error codes used
- [ ] `_meta` field handled correctly

### Step 3: Check lifecycle compliance
Read [lifecycle-and-capabilities.md](./reference/lifecycle-and-capabilities.md) and verify:
- [ ] Initialization sequence: `initialize` → response → `notifications/initialized`
- [ ] Version negotiation correct (YYYY-MM-DD format)
- [ ] Capabilities declared match actual features
- [ ] Shutdown handled properly per transport

### Step 4: Check transport compliance
Read [transports.md](./reference/transports.md) and verify:
- [ ] **stdio**: newline-delimited, no embedded newlines, nothing non-MCP on stdout
- [ ] **Streamable HTTP**: Origin validation, session management, `MCP-Protocol-Version` header
- [ ] Security requirements met (DNS rebinding protection, localhost binding)
- [ ] Si el servidor usa Streamable HTTP en producción: revisar notas de escalado

### Step 5: Check feature compliance
Read [server-features.md](./reference/server-features.md) and verify:
- [ ] Tool names follow naming rules (1-128 chars, allowed chars only)
- [ ] `inputSchema` is valid JSON Schema (MUST NOT be null)
- [ ] `outputSchema` conformance if provided
- [ ] Error handling: protocol errors vs tool execution errors
- [ ] Resource URIs follow scheme conventions
- [ ] Prompt templates well-formed

### Step 6: Check client features (if applicable)
Read [client-features.md](./reference/client-features.md) for:
- [ ] Roots capability
- [ ] Sampling capability
- [ ] Elicitation (form + URL modes)

### Step 7: Check utilities
Read [utilities.md](./reference/utilities.md) for:
- [ ] Progress reporting
- [ ] Cancellation support
- [ ] Ping/keepalive
- [ ] Logging
- [ ] Tasks (experimental) — si se usan, revisar gaps de lifecycle conocidos

### Step 8: Run full compliance checklist
Read [compliance-checklist.md](./reference/compliance-checklist.md) for exhaustive MUST/SHOULD/MAY requirements.

---

## Ecosystem Context (2026)

| Tema | Estado |
|------|--------|
| **Spec vigente** | 2025-11-25 — no hay nueva versión publicada |
| **Gobernanza** | MCP bajo Linux Foundation (AAIF) — co-mantenido por Anthropic, Block, OpenAI |
| **MCP Registry** | Catálogo oficial de servidores: https://modelcontextprotocol.io/registry/about |
| **MCP Apps** | Primera extensión oficial — herramientas pueden retornar UI components interactivos (dashboards, formularios). Ver https://modelcontextprotocol.io/extensions/overview |
| **Tasks** | En producción (experimental). Gaps pendientes: retry semantics, expiry policies |
| **Streamable HTTP** | Problemas conocidos en escala: sesiones stateful vs load balancers |
| **SEPs** | Proceso formal de propuestas: https://modelcontextprotocol.io/seps |

---

## Reference Files

| File | Content |
|------|---------|
| [protocol-overview.md](./reference/protocol-overview.md) | Architecture, JSON-RPC, roles, message types, _meta, icons, JSON Schema usage, gobernanza |
| [lifecycle-and-capabilities.md](./reference/lifecycle-and-capabilities.md) | Init sequence, version negotiation, capabilities, shutdown, timeouts |
| [transports.md](./reference/transports.md) | stdio, Streamable HTTP, SSE, sessions, resumability, security, **production scaling notes** |
| [server-features.md](./reference/server-features.md) | Tools, Resources, Prompts — schemas, naming, annotations, errors |
| [client-features.md](./reference/client-features.md) | Roots, Sampling, Elicitation (form + URL modes) |
| [utilities.md](./reference/utilities.md) | Tasks (+ lifecycle gaps), Progress, Cancellation, Ping, Logging, Completion, Pagination |
| [compliance-checklist.md](./reference/compliance-checklist.md) | All MUST/SHOULD/MAY extracted from spec |
| [claude-desktop-compat.md](./reference/claude-desktop-compat.md) | Claude Desktop compatibility: stdio-only, version negotiation, config, known restrictions |

---

## When reviewing code

1. Read the relevant reference files BEFORE analyzing code
2. Check each MUST requirement — violations are spec-breaking
3. Flag missing SHOULD requirements as recommendations
4. Note MAY features that could improve the implementation
5. Provide specific spec references for each finding
