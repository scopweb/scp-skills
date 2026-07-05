# Lifecycle & Capabilities

**Spec revision**: 2025-11-25
**Source**: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle

---

## Lifecycle Phases

1. **Initialization** — capability negotiation + version agreement
2. **Operation** — normal protocol communication
3. **Shutdown** — graceful termination

---

## Initialization Sequence

### Step 1: Client sends `initialize` request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": { "form": {}, "url": {} },
      "tasks": {
        "requests": {
          "elicitation": { "create": {} },
          "sampling": { "createMessage": {} }
        }
      }
    },
    "clientInfo": {
      "name": "MyClient",
      "title": "My Client Display Name",
      "version": "1.0.0",
      "description": "Description text",
      "icons": [{ "src": "...", "mimeType": "image/png", "sizes": ["48x48"] }],
      "websiteUrl": "https://example.com"
    }
  }
}
```

### Step 2: Server responds with its capabilities

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "logging": {},
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true },
      "tasks": {
        "list": {},
        "cancel": {},
        "requests": { "tools": { "call": {} } }
      }
    },
    "serverInfo": {
      "name": "MyServer",
      "title": "My Server Display Name",
      "version": "1.0.0"
    },
    "instructions": "Optional instructions for the client"
  }
}
```

### Step 3: Client sends `initialized` notification

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

### Initialization Rules (MUST/SHOULD)

| Rule | Level |
|------|-------|
| Initialization MUST be the first interaction | MUST |
| Client MUST send `initialize` request first | MUST |
| Server MUST respond with capabilities | MUST |
| Client MUST send `notifications/initialized` after response | MUST |
| Client SHOULD NOT send requests (except ping) before server responds | SHOULD |
| Server SHOULD NOT send requests (except ping, logging) before `initialized` | SHOULD |

---

## Version Negotiation

- Client MUST send protocol version it supports (SHOULD be latest)
- If server supports it → MUST respond with same version
- If server doesn't support it → MUST respond with another version it supports (SHOULD be latest)
- If client doesn't support server's version → SHOULD disconnect
- Version format: `YYYY-MM-DD` (e.g., `2025-11-25`)
- Current version: **2025-11-25**
- Previous versions: 2025-06-18, 2025-03-26, 2024-11-05

### HTTP version header
- Client MUST include `MCP-Protocol-Version: <version>` on all subsequent HTTP requests
- Server SHOULD assume `2025-03-26` if header missing
- Server MUST respond 400 Bad Request for invalid/unsupported version

---

## Protocol Version Auto-Detection Pattern (Recommended)

**Problem**: Servers with fixed protocol version (e.g., `2025-11-25`) fail when clients use different versions (e.g., Claude Desktop uses `2025-06-18`).

**Solution**: Echo the client's requested version in the response for universal compatibility.

### Implementation Examples

#### Go
```go
case "initialize":
    clientProtocolVersion := "2024-11-05" // Default fallback
    if version, ok := req.Params["protocolVersion"].(string); ok && version != "" {
        clientProtocolVersion = version
    }

    response.Result = map[string]interface{}{
        "protocolVersion": clientProtocolVersion,  // Echo client's version
        "capabilities": map[string]interface{}{
            "tools": map[string]interface{}{"listChanged": true},
        },
        "serverInfo": map[string]interface{}{
            "name":    "my-mcp-server",
            "version": "1.0.0",
        },
    }
```

#### TypeScript/JavaScript
```typescript
if (request.method === "initialize") {
    const clientVersion = request.params?.protocolVersion || "2024-11-05";

    return {
        protocolVersion: clientVersion,  // Echo client's version
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "my-mcp-server", version: "1.0.0" }
    };
}
```

#### Python
```python
if request.get("method") == "initialize":
    client_version = request.get("params", {}).get("protocolVersion", "2024-11-05")

    return {
        "protocolVersion": client_version,  # Echo client's version
        "capabilities": {"tools": {"listChanged": True}},
        "serverInfo": {"name": "my-mcp-server", "version": "1.0.0"}
    }
```

### Known Client Versions

| Version | Client |
|---------|--------|
| `2024-11-05` | MCP spec v1.0 (safe fallback) |
| `2025-06-18` | Claude Desktop / Claude Code (legacy — pre-2026) |
| `2025-11-25` | Claude Desktop + Claude Code (current, since early 2026) |

> ℹ️ **Verified (March 2026)**: Both Claude Desktop and Claude Code now send `protocolVersion: "2025-11-25"` in their `initialize` requests. Servers that only support older versions must negotiate down correctly or risk hanging (see Stripe MCP issue #290).

### Why This Works

Per the spec: *"If server supports it → MUST respond with same version"*. By echoing the client's version, you implicitly declare support for all versions, ensuring compatibility without recompilation.

---

## Server Instructions (`instructions` field)

The `InitializeResult` includes an optional `instructions` field (string) that the server sends to the client during the handshake. This is the **only mechanism guaranteed to inject context into the AI model at every session start**, regardless of client configuration.

### Why this matters

**Problem**: AI clients (Claude Desktop, Claude Code, etc.) receive the tool list via `tools/list`, but the model may not explore all available tools — it discovers only the ones it considers relevant at that moment. This leads to the model ignoring powerful tools (e.g., using `write_file` for edits instead of `edit_file`, or never discovering `batch_operations`).

**Solution**: Use `instructions` to tell the model what tools exist, when to use each one, and critical usage rules. The client receives this during `initialize` — before any user interaction — so the model has full context from the start.

### What to include in instructions

1. **Tool catalog** — list every tool with a one-line description
2. **Usage rules** — e.g., "use `edit_file` for modifications, never `write_file`"
3. **Workflow patterns** — e.g., "use `read_file` with `outline=true` first, then `start_line/end_line` for sections"
4. **Grouping** — organize tools by category (read, write, search, bulk)

### Go implementation (mcp-go SDK)

```go
s := server.NewMCPServer(
    "my-server",
    "1.0.0",
    server.WithInstructions(`You have access to a filesystem server with these tools:

## Editing (IMPORTANT)
- edit_file: Modify specific text (search/replace). ALWAYS prefer over write_file for existing files.
- write_file: Create new files or full rewrites only.

## Reading
- read_file: Read contents. Use outline=true to get symbol index with line numbers.
...

## Key rules
1. To modify existing files: use edit_file, NOT write_file
2. To explore large files: use read_file with outline=true first`),
)
```

### Go implementation (official Go SDK)

```go
srv, _ := server.NewMCPServer(server.ServerConfig{
    Name:    "my-server",
    Version: "1.0.0",
    Instructions: "Your instruction text here...",
})
```

### Spec compliance

| Rule | Level |
|------|-------|
| `instructions` field is optional in `InitializeResult` | MAY |
| If present, client SHOULD surface it to the AI model | SHOULD |
| Content is free-form text (no schema) | — |

### Review checklist for `instructions`

- [ ] Server sets `instructions` with tool catalog and usage guidance
- [ ] Instructions mention ALL tools, not just common ones
- [ ] Critical rules are explicit (e.g., "prefer X over Y for this case")
- [ ] Instructions are concise — models have context limits

> ⚠️ **Common gap in Go MCP servers**: Most Go servers built with `mcp-go` do NOT set `WithInstructions()`, leaving the model to discover tools on its own. This is the #1 cause of the model ignoring available tools. Always set instructions.

---

## Capability Negotiation

### Client capabilities

| Capability | Description |
|-----------|-------------|
| `roots` | Provides filesystem roots |
| `sampling` | Supports LLM sampling requests |
| `elicitation` | Supports elicitation (form and/or URL modes) |
| `tasks` | Supports task-augmented client requests |
| `experimental` | Non-standard experimental features |

### Server capabilities

| Capability | Description |
|-----------|-------------|
| `prompts` | Offers prompt templates |
| `resources` | Provides readable resources |
| `tools` | Exposes callable tools |
| `logging` | Emits structured log messages |
| `completions` | Supports argument autocompletion |
| `tasks` | Supports task-augmented server requests |
| `experimental` | Non-standard experimental features |

### Sub-capabilities

- `listChanged`: server will emit notifications when list changes (prompts, resources, tools)
- `subscribe`: supports subscribing to resource changes (resources only)

---

## Operation Phase

Both parties MUST:
- Respect negotiated protocol version
- Only use capabilities that were successfully negotiated

---

## Shutdown

### stdio transport
Client SHOULD:
1. Close stdin to server
2. Wait for server to exit
3. Send SIGTERM if no exit in reasonable time
4. Send SIGKILL as last resort

Server MAY initiate by closing stdout and exiting.

### HTTP transport
Shutdown by closing HTTP connection(s).
Client SHOULD send HTTP DELETE to MCP endpoint with `MCP-Session-Id` header to explicitly terminate session.

---

## Timeouts

- Implementations SHOULD establish timeouts for all requests
- On timeout: SHOULD send cancellation notification and stop waiting
- SDKs SHOULD allow per-request timeout configuration
- MAY reset timeout on progress notifications
- SHOULD enforce maximum timeout regardless of progress

---

## Error Handling

Implementations SHOULD handle:
- Protocol version mismatch
- Failure to negotiate required capabilities
- Request timeouts

Error response example:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Unsupported protocol version",
    "data": { "supported": ["2025-11-25"], "requested": "1.0.0" }
  }
}
```
