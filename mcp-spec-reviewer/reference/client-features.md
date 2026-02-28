# Client Features

**Spec revision**: 2025-11-25
**Sources**:
- https://modelcontextprotocol.io/specification/2025-11-25/client/roots
- https://modelcontextprotocol.io/specification/2025-11-25/client/sampling
- https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation

---

## Roots

Roots let servers know which filesystem boundaries they should operate within.

### Capability
```json
{ "capabilities": { "roots": { "listChanged": true } } }
```

### Protocol Messages

- `roots/list` — server requests list of roots from client
- `notifications/roots/list_changed` — client notifies server roots changed

### Root Definition
```json
{
  "uri": "file:///home/user/projects/myproject",
  "name": "My Project"
}
```

- Roots are informational — servers SHOULD respect but aren't strictly confined
- Root URIs typically use `file://` scheme but can use any scheme

---

## Sampling

Sampling allows servers to request LLM completions through the client.

### Capability
```json
{ "capabilities": { "sampling": {} } }
```

### Protocol Messages

- `sampling/createMessage` — server requests LLM completion from client

### Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "sampling/createMessage",
  "params": {
    "messages": [
      {
        "role": "user",
        "content": { "type": "text", "text": "Analyze this code..." }
      }
    ],
    "maxTokens": 1000,
    "systemPrompt": "You are a code reviewer.",
    "includeContext": "thisServer",
    "modelPreferences": {
      "hints": [{ "name": "claude-sonnet-4-20250514" }],
      "intelligencePriority": 0.8,
      "speedPriority": 0.5,
      "costPriority": 0.3
    }
  }
}
```

### Security Controls

Users MUST explicitly approve sampling requests. Users should control:
- Whether sampling occurs at all
- The actual prompt sent
- What results the server can see

---

## Elicitation

Elicitation allows servers to request additional information from users. Two modes:

### Capability
```json
{
  "capabilities": {
    "elicitation": {
      "form": {},
      "url": {}
    }
  }
}
```

- Clients MUST support at least one mode (form or url)
- Servers MUST NOT send elicitation with modes not supported by client

### Protocol Messages

- `elicitation/create` — server requests info from user

### Form Mode

Collect structured data directly through the MCP client.

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "message": "Please provide your preferences",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "title": "Your Name", "minLength": 1, "maxLength": 100 },
        "age": { "type": "integer", "title": "Age", "minimum": 0, "maximum": 150 },
        "subscribe": { "type": "boolean", "title": "Subscribe to newsletter", "default": false }
      },
      "required": ["name"]
    }
  }
}
```

Schema restrictions (form mode):
- Flat objects only (no nested objects)
- Primitive properties only: string, number, integer, boolean, enum

### URL Mode (New in 2025-11-25)

Direct users to external URLs for sensitive interactions. Data does NOT pass through MCP client.

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "message": "Please complete the authentication flow",
    "url": "https://auth.example.com/oauth/authorize?..."
  }
}
```

Use cases: secure credential collection, OAuth flows, payment processing.

### Elicitation Result

```json
{
  "action": "accept",
  "content": { "name": "John", "age": 30 }
}
```

Possible `action` values: `"accept"`, `"decline"`, `"cancel"`
