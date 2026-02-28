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
- [ ] Tasks (experimental, 2025-11-25)

### Step 8: Run full compliance checklist
Read [compliance-checklist.md](./reference/compliance-checklist.md) for exhaustive MUST/SHOULD/MAY requirements.

---

## Reference Files

| File | Content |
|------|---------|
| [protocol-overview.md](./reference/protocol-overview.md) | Architecture, JSON-RPC, roles, message types, _meta, icons, JSON Schema usage |
| [lifecycle-and-capabilities.md](./reference/lifecycle-and-capabilities.md) | Init sequence, version negotiation, capabilities, shutdown, timeouts |
| [transports.md](./reference/transports.md) | stdio, Streamable HTTP, SSE, sessions, resumability, security |
| [server-features.md](./reference/server-features.md) | Tools, Resources, Prompts — schemas, naming, annotations, errors |
| [client-features.md](./reference/client-features.md) | Roots, Sampling, Elicitation (form + URL modes) |
| [utilities.md](./reference/utilities.md) | Tasks, Progress, Cancellation, Ping, Logging, Completion, Pagination |
| [compliance-checklist.md](./reference/compliance-checklist.md) | All MUST/SHOULD/MAY extracted from spec |
| [claude-desktop-compat.md](./reference/claude-desktop-compat.md) | Claude Desktop compatibility: stdio-only, version negotiation, config, known restrictions |

---

## When reviewing code

1. Read the relevant reference files BEFORE analyzing code
2. Check each MUST requirement — violations are spec-breaking
3. Flag missing SHOULD requirements as recommendations
4. Note MAY features that could improve the implementation
5. Provide specific spec references for each finding
