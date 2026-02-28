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
      "version": "1.0.0"
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
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "MyServer",
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
| `2025-06-18` | Claude Desktop (current) |
| `2025-11-25` | Latest MCP spec |

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

- `listChanged`: server will emit notifications when list changes
- `subscribe`: supports subscribing to resource changes (resources only)

---

## Shutdown

### stdio transport
Client SHOULD:
1. Close stdin to server
2. Wait for server to exit
3. Send SIGTERM if no exit in reasonable time
4. Send SIGKILL as last resort

### HTTP transport
Client SHOULD send HTTP DELETE to MCP endpoint with `MCP-Session-Id` header.

---

## Timeouts

- Implementations SHOULD establish timeouts for all requests
- On timeout: SHOULD send cancellation notification and stop waiting
- SDKs SHOULD allow per-request timeout configuration
- MAY reset timeout on progress notifications
- SHOULD enforce maximum timeout regardless of progress
