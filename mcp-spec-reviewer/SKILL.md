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
Changelog from 2025-06-18: https://modelcontextprotocol.io/specification/2025-11-25/changelog

> ℹ️ **Ecosystem status (March 2026)**: The current spec remains **2025-11-25**. No new version published yet. The 2026 roadmap has active priorities (see notes in reference files).

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
- [ ] **`instructions` field set** in initialize response — lists ALL tools with usage guidance (see "Server Instructions" section in reference). Without this, AI models may ignore available tools.
- [ ] Shutdown handled properly per transport

### Step 4: Check transport compliance
Read [transports.md](./reference/transports.md) and verify:
- [ ] **stdio**: newline-delimited, no embedded newlines, nothing non-MCP on stdout
- [ ] **Streamable HTTP**: Origin validation, session management, `MCP-Protocol-Version` header
- [ ] Security requirements met (DNS rebinding protection, localhost binding)
- [ ] If server uses Streamable HTTP in production: review scaling notes
- [ ] If server requires authorization: check OAuth 2.1/PKCE compliance

### Step 5: Check feature compliance
Read [server-features.md](./reference/server-features.md) and verify:
- [ ] Tool names follow naming rules (1-128 chars, allowed chars only)
- [ ] `inputSchema` is valid JSON Schema (MUST NOT be null)
- [ ] `outputSchema` conformance if provided
- [ ] Error handling: protocol errors vs tool execution errors
- [ ] `title` field provided for human-readable display names (tools, resources, prompts)
- [ ] Content annotations (`audience`, `priority`, `lastModified`) used where applicable
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
- [ ] Tasks (experimental) — if used, review known lifecycle gaps

### Step 8: Check authorization (if Streamable HTTP)
Read [authorization.md](./reference/authorization.md) and verify:
- [ ] Protected Resource Metadata ([RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728)) implemented
- [ ] Authorization server discovery (OAuth 2.0 AS Metadata or OpenID Connect)
- [ ] OAuth 2.1 + PKCE (S256) flow implemented correctly
- [ ] `resource` parameter (RFC 8707) included in auth/token requests
- [ ] Token audience validation on every request
- [ ] Server does NOT pass through tokens to upstream APIs
- [ ] Client ID Metadata Documents or Dynamic Client Registration supported

### Step 9: Run full compliance checklist
Read [compliance-checklist.md](./reference/compliance-checklist.md) for exhaustive MUST/SHOULD/MAY requirements.

---

## Ecosystem Context (2026)

| Topic | Status |
|-------|--------|
| **Current spec** | 2025-11-25 — no new version published |
| **Governance** | MCP under Linux Foundation (AAIF) — co-maintained by Anthropic, Block, OpenAI |
| **MCP Registry** | Official server catalog: https://modelcontextprotocol.io/registry/about |
| **MCP Apps** | First official extension — tools can return interactive UI components (dashboards, forms). See https://modelcontextprotocol.io/extensions/overview |
| **Tasks** | In production (experimental). Pending gaps: retry semantics, expiry policies |
| **Streamable HTTP** | Known issues at scale: stateful sessions vs load balancers |
| **SEPs** | Formal proposal process: https://modelcontextprotocol.io/seps |
| **Next release** | Tentatively **June 2026** — focused on transport scalability and agent communication |

---

## Tracking Spec Changes

MCP is maintained by the **Agentic AI Foundation** (Linux Foundation). Changes flow through SEPs, Working Groups, and community governance. Monitor these sources periodically to keep this skill and your MCP servers up to date.

### Official Sources (check monthly)

| Source | URL | What to watch |
|--------|-----|---------------|
| **Spec (current)** | https://modelcontextprotocol.io/specification/2025-11-25 | Current stable spec |
| **Spec (draft)** | https://modelcontextprotocol.io/specification/draft | Next version in progress — changes here land in the next dated release |
| **Draft changelog** | https://modelcontextprotocol.io/specification/draft/changelog | Delta from 2025-11-25 → next version. **Primary trigger for updating this skill** |
| **Blog** | https://blog.modelcontextprotocol.io/ | Release announcements, roadmap updates, transport/extension news |
| **Roadmap 2026** | https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/ | 4 priorities: transport scalability, agent communication, governance maturation, enterprise readiness |

### GitHub (check weekly if actively developing)

| Source | URL | What to watch |
|--------|-----|---------------|
| **Repo (spec + docs)** | https://github.com/modelcontextprotocol/modelcontextprotocol | Commits to `main`, new releases |
| **Releases** | https://github.com/modelcontextprotocol/modelcontextprotocol/releases | RC and final spec releases |
| **SEPs (PRs)** | https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/seps | New proposals — SEPs are now submitted as PRs, not issues |
| **SEP index** | https://modelcontextprotocol.io/seps | Browsable list of all SEPs with status |
| **SEP guidelines** | https://modelcontextprotocol.io/community/sep-guidelines | How proposals are submitted and reviewed |
| **GitHub Discussions** | https://github.com/modelcontextprotocol/modelcontextprotocol/discussions | Long-form design discussions, feature requests |
| **TypeScript schema** | https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/draft/schema.ts | Single source of truth for protocol types |

### Community & Governance

| Source | URL | What to watch |
|--------|-----|---------------|
| **Governance** | https://modelcontextprotocol.io/community/governance | Maintainer structure, decision-making, contributor ladder |
| **Working Groups** | https://modelcontextprotocol-community.github.io/working-groups/ | Active WGs: Transport, Auth, Agents, Security, etc. |
| **Discord (contributors)** | https://discord.gg/model-context-protocol-1312302100125843476 | Real-time discussion, WG channels (#auth-wg, #security-ig, etc.) |
| **Communication guide** | https://modelcontextprotocol.io/community/communication | Where discussions happen and how decisions are made |

### Official SDKs (reference implementations)

| SDK | URL | Notes |
|-----|-----|-------|
| **Go SDK (official)** | https://github.com/modelcontextprotocol/go-sdk | v1.4.1, maintained with Google. Module: `github.com/modelcontextprotocol/go-sdk`. Generics-based, built-in OAuth. Good reference for how spec features map to Go. |
| **TypeScript SDK** | https://github.com/modelcontextprotocol/typescript-sdk | Reference implementation, most mature |
| **Python SDK** | https://github.com/modelcontextprotocol/python-sdk | Official Python implementation |
| **SDK tiers** | https://modelcontextprotocol.io/community/sdk-tiers | SDK compliance levels — useful to know what clients actually implement |

> **This project** uses `github.com/mark3labs/mcp-go v0.45.0` — a third-party Go SDK recognized as a "viable alternative" by the official SDK. When reviewing spec compliance, check both the spec and the official Go SDK for Go-idiomatic patterns.

### Extensions & Ecosystem

| Source | URL | What to watch |
|--------|-----|---------------|
| **Extensions overview** | https://modelcontextprotocol.io/extensions/overview | Official extensions (MCP Apps, auth extensions) |
| **Auth extensions** | https://github.com/modelcontextprotocol/ext-auth | OAuth client-credentials (SEP-1046), enterprise IdP (SEP-990) |
| **MCP Apps** | https://github.com/modelcontextprotocol/ext-apps | Interactive UI from MCP servers (spec 2026-01-26) |
| **MCP Registry** | https://modelcontextprotocol.io/registry/about | Server catalog and discovery API |

### Update Process for This Skill

When the draft changelog shows significant changes:
1. Read the draft changelog and identify new/changed MUST/SHOULD/MAY requirements
2. Update affected reference files (transports.md, server-features.md, etc.)
3. Update compliance-checklist.md with new rules
4. Update CHANGELOG.md with a new version entry
5. Bump the spec revision header in all reference files

---

## Reference Files

| File | Content |
|------|---------|
| [protocol-overview.md](./reference/protocol-overview.md) | Architecture, JSON-RPC, roles, message types, _meta, icons, JSON Schema usage, governance |
| [lifecycle-and-capabilities.md](./reference/lifecycle-and-capabilities.md) | Init sequence, version negotiation, capabilities, shutdown, timeouts |
| [transports.md](./reference/transports.md) | stdio, Streamable HTTP, SSE, sessions, resumability, security, **production scaling notes** |
| [server-features.md](./reference/server-features.md) | Tools, Resources, Prompts — schemas, naming, annotations, errors |
| [client-features.md](./reference/client-features.md) | Roots, Sampling, Elicitation (form + URL modes) |
| [utilities.md](./reference/utilities.md) | Tasks (+ lifecycle gaps), Progress, Cancellation, Ping, Logging, Completion, Pagination |
| [authorization.md](./reference/authorization.md) | OAuth 2.1 + PKCE for Streamable HTTP, token management, security |
| [compliance-checklist.md](./reference/compliance-checklist.md) | All MUST/SHOULD/MAY extracted from spec |
| [claude-desktop-compat.md](./reference/claude-desktop-compat.md) | Claude Desktop compatibility: stdio-only, version negotiation, config, known restrictions |

---

## When reviewing code

1. Read the relevant reference files BEFORE analyzing code
2. Check each MUST requirement — violations are spec-breaking
3. Flag missing SHOULD requirements as recommendations
4. Note MAY features that could improve the implementation
5. Provide specific spec references for each finding
