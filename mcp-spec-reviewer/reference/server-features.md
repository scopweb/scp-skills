# Server Features

**Spec revision**: 2025-11-25
**Sources**:
- https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- https://modelcontextprotocol.io/specification/2025-11-25/server/resources
- https://modelcontextprotocol.io/specification/2025-11-25/server/prompts

---

## Tools

Tools enable LLMs to interact with external systems. They are **model-controlled** (the LLM discovers and invokes them).

### Capability declaration

Servers with tools MUST declare:
```json
{ "capabilities": { "tools": { "listChanged": true } } }
```

### Protocol Messages

- `tools/list` — discover tools (supports pagination via `cursor`)
- `tools/call` — invoke a tool
- `notifications/tools/list_changed` — when tool list changes (if `listChanged: true`)

### Tool Definition Schema

```json
{
  "name": "service_action_resource",
  "title": "Human-readable Display Name",
  "description": "Concise description of functionality",
  "icons": [{ "src": "...", "mimeType": "image/png", "sizes": ["48x48"] }],
  "inputSchema": { "type": "object", "properties": { ... }, "required": [...] },
  "outputSchema": { "type": "object", "properties": { ... } },
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
  },
  "execution": {
    "taskSupport": "optional"
  }
}
```

### Tool Name Rules

| Rule | Level |
|------|-------|
| 1-128 characters | SHOULD |
| Case-sensitive | SHOULD |
| Allowed chars: A-Z, a-z, 0-9, `_`, `-`, `.` | SHOULD |
| No spaces, commas, or special characters | SHOULD |
| Unique within a server | SHOULD |

Valid examples: `getUser`, `DATA_EXPORT_v2`, `admin.tools.list`

### inputSchema Rules

| Rule | Level |
|------|-------|
| MUST be valid JSON Schema object (not null) | MUST |
| Defaults to 2020-12 if no `$schema` | — |
| No params: `{ "type": "object", "additionalProperties": false }` (recommended) | — |
| Or: `{ "type": "object" }` (accepts any object) | — |

### outputSchema Rules

| Rule | Level |
|------|-------|
| Optional JSON Schema for structured output | — |
| If provided: server MUST return conformant `structuredContent` | MUST |
| Clients SHOULD validate against schema | SHOULD |

### Tool Annotations

Clients MUST consider annotations **untrusted** unless from a trusted server.

| Annotation | Type | Description |
|-----------|------|-------------|
| `readOnlyHint` | bool | Tool doesn't modify state |
| `destructiveHint` | bool | Tool may cause irreversible changes |
| `idempotentHint` | bool | Safe to call multiple times with same args |
| `openWorldHint` | bool | Tool interacts with external entities |

### Tool Execution Properties

Tools may include an `execution` field:

| Field | Type | Description |
|-------|------|-------------|
| `taskSupport` | string | `"forbidden"` (default), `"optional"`, or `"required"` — controls task-augmented invocation |

See [utilities.md](./utilities.md#tool-level-task-negotiation) for task negotiation details.

### Tool Result

Two types of content:
1. **Unstructured**: `content` array with text, image, audio, resource links, embedded resources
2. **Structured**: `structuredContent` JSON object (for backwards compat, SHOULD also include serialized JSON in TextContent)

Content types in `content` array:
- `text` — `{ "type": "text", "text": "..." }`
- `image` — `{ "type": "image", "data": "base64...", "mimeType": "image/png" }`
- `audio` — `{ "type": "audio", "data": "base64...", "mimeType": "audio/wav" }`
- `resource_link` — `{ "type": "resource_link", "uri": "...", "name": "...", "mimeType": "..." }`
- `resource` — embedded resource with URI, mimeType, text/blob content

All content types support optional annotations (audience, priority, lastModified).

### Error Handling

Two mechanisms:
1. **Protocol Errors** — JSON-RPC errors (unknown tool, malformed request, server error)
2. **Tool Execution Errors** — `isError: true` in result (API failures, validation, business logic)

Tool execution errors contain actionable feedback for LLM self-correction.
Input validation errors → Tool Execution Error (not Protocol Error), to enable model self-correction.

Clients SHOULD provide tool execution errors to LLMs.
Clients MAY provide protocol errors to LLMs.

### Security

Servers MUST: validate inputs, implement access controls, rate limit, sanitize outputs.
Clients SHOULD: prompt user confirmation, show inputs before calling, validate results, implement timeouts, log usage.

---

## Resources

Resources share data providing context to LLMs (files, schemas, app data). **Application-driven** (host decides how to use them).

### Capability declaration
```json
{ "capabilities": { "resources": { "subscribe": true, "listChanged": true } } }
```

### Protocol Messages

- `resources/list` — list available resources (paginated)
- `resources/read` — read resource content by URI
- `resources/templates/list` — list URI templates
- `resources/subscribe` / `resources/unsubscribe` — subscribe to changes
- `notifications/resources/list_changed` — resource list changed
- `notifications/resources/updated` — specific resource updated

### Resource Definition
```json
{
  "uri": "file:///project/README.md",
  "name": "README.md",
  "title": "Project Documentation",
  "mimeType": "text/markdown",
  "annotations": {
    "audience": ["user"],
    "priority": 0.8,
    "lastModified": "2025-01-12T15:00:58Z"
  }
}
```

### Annotations

| Field | Description |
|-------|-------------|
| `audience` | Array: `"user"`, `"assistant"`, or both |
| `priority` | 0.0 (least important) to 1.0 (most important / effectively required) |
| `lastModified` | ISO 8601 timestamp |

### Standard URI Schemes

- `https://` — web resource (use only when client can fetch directly)
- `file://` — local filesystem
- `git://` — Git resources
- Custom schemes are allowed

Servers SHOULD prefer non-https schemes when client needs to read via MCP server.

### Resource Content Types

- **Text**: `{ "uri": "...", "mimeType": "...", "text": "content" }`
- **Binary**: `{ "uri": "...", "mimeType": "...", "blob": "base64..." }`

### Resource Definition Fields

In addition to `uri`, `name`, `title`, `mimeType`, and `annotations`, resources may include:

- `description`: Optional description
- `size`: Optional size in bytes

---

## Prompts

Server-defined prompt templates with optional arguments. **User-controlled** (users select/discover prompts).

### Capability declaration
```json
{ "capabilities": { "prompts": { "listChanged": true } } }
```

### Protocol Messages

- `prompts/list` — list available prompts (paginated)
- `prompts/get` — get a prompt with arguments
- `notifications/prompts/list_changed` — prompt list changed

### Prompt Definition
```json
{
  "name": "code_review",
  "title": "Code Review Assistant",
  "description": "Review code for bugs and improvements",
  "icons": [{ "src": "...", "mimeType": "image/svg+xml" }],
  "arguments": [
    {
      "name": "code",
      "description": "The code to review",
      "required": true
    }
  ]
}
```

### Prompt Messages

`prompts/get` returns an array of `PromptMessage` objects with:
- `role`: "user" or "assistant"
- `content`: text, image, audio, or embedded resource

Embedded resources in prompts can include documentation, code samples, etc.

Servers SHOULD return standard JSON-RPC errors for failures.
