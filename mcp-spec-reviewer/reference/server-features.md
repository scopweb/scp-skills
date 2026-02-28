# Server Features

**Spec revision**: 2025-11-25
**Sources**:
- https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- https://modelcontextprotocol.io/specification/2025-11-25/server/resources
- https://modelcontextprotocol.io/specification/2025-11-25/server/prompts

---

## Tools

Tools enable LLMs to interact with external systems. They are **model-controlled**.

### Capability declaration

```json
{ "capabilities": { "tools": { "listChanged": true } } }
```

### Protocol Messages

- `tools/list` — discover tools (supports pagination via `cursor`)
- `tools/call` — invoke a tool
- `notifications/tools/list_changed` — when tool list changes

### Tool Definition Schema

```json
{
  "name": "service_action_resource",
  "title": "Human-readable Display Name",
  "description": "Concise description of functionality",
  "inputSchema": { "type": "object", "properties": { ... }, "required": [...] },
  "outputSchema": { "type": "object", "properties": { ... } },
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
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

### inputSchema Rules

| Rule | Level |
|------|-------|
| MUST be valid JSON Schema object (not null) | MUST |
| Defaults to 2020-12 if no `$schema` | — |
| No params: `{ "type": "object", "additionalProperties": false }` | recommended |

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

### Tool Result

Content types in `content` array:
- `text` — `{ "type": "text", "text": "..." }`
- `image` — `{ "type": "image", "data": "base64...", "mimeType": "image/png" }`
- `audio` — `{ "type": "audio", "data": "base64...", "mimeType": "audio/wav" }`
- `resource_link` — `{ "type": "resource_link", "uri": "...", "name": "..." }`
- `resource` — embedded resource

Structured content: SHOULD also include serialized JSON in TextContent for backwards compat.

### Error Handling

- **Protocol Errors** — JSON-RPC errors (unknown tool, malformed request)
- **Tool Execution Errors** — `isError: true` in result (API failures, validation)

Input validation errors → Tool Execution Error (not Protocol Error), to enable model self-correction.
Clients SHOULD provide tool execution errors to LLMs.

### Security

Servers MUST: validate inputs, implement access controls, rate limit, sanitize outputs.
Clients SHOULD: prompt user confirmation, show inputs before calling, validate results, implement timeouts, log usage.

---

## Resources

Resources share data providing context to LLMs. **Application-driven**.

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
  "mimeType": "text/markdown",
  "annotations": {
    "audience": ["user"],
    "priority": 0.8,
    "lastModified": "2025-01-12T15:00:58Z"
  }
}
```

### Standard URI Schemes

- `https://` — web resource (use only when client can fetch directly)
- `file://` — local filesystem
- `git://` — Git resources

Servers SHOULD prefer non-https schemes when client reads via MCP server.

### Resource Content Types

- **Text**: `{ "uri": "...", "mimeType": "...", "text": "content" }`
- **Binary**: `{ "uri": "...", "mimeType": "...", "blob": "base64..." }`

---

## Prompts

Server-defined prompt templates. **User-controlled**.

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
  "arguments": [
    {
      "name": "code",
      "description": "The code to review",
      "required": true
    }
  ]
}
```

Servers SHOULD return standard JSON-RPC errors for failures.
