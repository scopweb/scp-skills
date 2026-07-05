# Protocol Overview

**Spec revision**: 2025-11-25
**Source**: https://modelcontextprotocol.io/specification/2025-11-25/basic

---

## Architecture

MCP uses **JSON-RPC 2.0** over stateful connections between three roles:

- **Host**: LLM application that initiates connections (e.g., Claude Desktop, IDE)
- **Client**: Connector within the host that maintains 1:1 connection with a server
- **Server**: Service providing context and capabilities

A host application can run multiple clients, each connected to a different server.

> ℹ️ **Governance (Dec 2025)**: MCP was donated to the **Agentic AI Foundation (AAIF)**, a directed fund under the Linux Foundation, co-founded by Anthropic, Block, and OpenAI. The project is no longer exclusively Anthropic's. The official repository remains at https://github.com/modelcontextprotocol.

---

## JSON-RPC Message Format

All messages MUST be UTF-8 encoded JSON-RPC 2.0.

### Requests
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method/name",
  "params": { ... }
}
```
- ID MUST be string or integer
- ID MUST NOT be null (differs from base JSON-RPC)
- ID MUST NOT have been previously used by the requestor within the same session

### Responses (success)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}
```

### Responses (error)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Error description",
    "data": { ... }
  }
}
```

Standard JSON-RPC error codes:
| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid Request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |

### Notifications (no response expected)
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/something",
  "params": { ... }
}
```
- No `id` field
- No response sent

---

## General Fields

### `_meta`
All requests, notifications, and results can include an optional `_meta` field for protocol-level metadata. Implementations MUST preserve and forward `_meta` where applicable.

### Icons
Servers can expose visual identifiers via the `icons` property on:
- Implementation info (serverInfo/clientInfo)
- Tools, Prompts, Resources, Resource Templates

Icon object:
```json
{
  "src": "https://example.com/icon.svg",
  "mimeType": "image/svg+xml",
  "sizes": ["any"]
}
```

- `src`: URI to icon (REQUIRED) — MUST be HTTPS or `data:` URI
- `mimeType`: MIME type hint (OPTIONAL)
- `sizes`: Array of size strings like "48x48" or "any" (OPTIONAL)
- `theme`: Optional theme preference (`light` or `dark`)

### Required MIME type support

Clients rendering icons **MUST** support: `image/png`, `image/jpeg`
Clients rendering icons **SHOULD** also support: `image/svg+xml`, `image/webp`

### Icon Security (CRITICAL)

- Clients **MUST** reject icon URIs with unsafe schemes (`javascript:`, `file:`, `ftp:`, `ws:`, local app URIs)
- Clients **MUST** disallow scheme changes and redirects to different origins
- Clients **MUST** fetch icons without credentials (no cookies, no `Authorization` headers)
- Clients **SHOULD** verify icon URIs are from the same origin as the server
- Consumers **MAY** set limits for image/content size (resource exhaustion defense)
- Consumers **MAY** disallow specific file types or sanitize before rendering
- Validate MIME types via magic bytes; reject on mismatch or unknown types
- Maintain a strict allowlist of image types

---

## JSON Schema Usage

MCP uses JSON Schema for validation throughout (tool inputs, outputs, elicitation, etc.).

### Dialect rules
- **Default**: JSON Schema 2020-12 when no `$schema` field present
- **Explicit**: schemas MAY include `$schema` to specify different dialect
- Implementations MUST support at least 2020-12
- SHOULD document additional supported dialects
- MUST handle unsupported dialects gracefully with appropriate error

### Examples

Default (2020-12):
```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" }
  },
  "required": ["name"]
}
```

Explicit draft-07:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" }
  },
  "required": ["name"]
}
```

---

## Naming Conventions

### Entity name format
Names follow a prefix + name structure. If a prefix is specified:
- MUST be labels separated by dots, followed by `/`
- Labels MUST start with letter, end with letter or digit
- Interior chars: letters, digits, hyphens
- SHOULD use reverse DNS (e.g., `com.example/`)
- Prefixes with `modelcontextprotocol` or `mcp` as second label are **reserved**

Name part:
- MUST begin and end with alphanumeric `[a-z0-9A-Z]`
- MAY contain hyphens, underscores, dots, and alphanumerics in between
