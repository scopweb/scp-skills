# Utilities

**Spec revision**: 2025-11-25
**Source**: https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/

---

## Tasks (Experimental — 2025-11-25)

Tasks are durable state machines for tracking long-running work. Any request can be augmented with a task for polling and deferred result retrieval.

> ℹ️ **Estado (marzo 2026)**: Tasks está en uso en producción. El feedback real ha identificado lifecycle gaps pendientes de cierre en próxima versión de spec:
> - **Retry semantics**: no hay semántica estándar para reintentar tareas con fallo transitorio
> - **Expiry policies**: no hay política estándar de cuánto tiempo retiene el servidor resultados tras completar
>
> Tenerlo en cuenta: implementaciones actuales deben definir estas políticas a nivel de aplicación.

### Capability

Server:
```json
{
  "capabilities": {
    "tasks": {
      "list": {},
      "cancel": {},
      "requests": { "tools": { "call": {} } }
    }
  }
}
```

Client:
```json
{
  "capabilities": {
    "tasks": {
      "requests": {
        "elicitation": { "create": {} },
        "sampling": { "createMessage": {} }
      }
    }
  }
}
```

### Task Status Lifecycle

```
created → working → completed
                  → failed
                  → cancelled
         → input_required → working (after user input)
```

> ⚠️ **Gap conocido**: no hay estado `retrying` ni semántica de reintento en spec 2025-11-25. Implementar a nivel de aplicación si se necesita.

### Protocol Messages

- Request con `_meta.task.create: true` — crear tarea asociada al request
- `tasks/get` — polling de estado
- `tasks/result` — recuperar resultado completado
- `tasks/list` — listar tareas conocidas
- `tasks/cancel` — cancelar tarea en curso
- `notifications/tasks/status_changed` — servidor notifica cambio de estado

### Key Fields

```json
{
  "taskId": "uuid-here",
  "status": "working",
  "statusMessage": "Processing...",
  "createdAt": "2025-11-25T10:30:00Z",
  "lastUpdatedAt": "2025-11-25T10:40:00Z",
  "ttl": 60000,
  "pollInterval": 5000
}
```

- `ttl`: time-to-live en ms (cuánto retiene el servidor los datos de la tarea)
- `pollInterval`: intervalo de polling sugerido en ms
- Requestors SHOULD respetar `pollInterval`
- Requestors SHOULD continuar polling hasta estado terminal

> ⚠️ **Gap conocido**: el `ttl` es un hint del servidor pero no hay política de expiración normalizada. Implementar garbage collection explícito si el servidor acumula tareas completadas.

### Task Rules

| Rule | Level |
|------|-------|
| Task IDs MUST be unique within session | MUST |
| Receivers MUST generate task IDs | MUST |
| Receivers MUST NOT create tasks unless requestor includes `_meta.task.create` | MUST |
| Task access MUST be restricted to creating session | MUST |
| `tasks/result` returns what the original request would have returned | MUST |

---

## Progress

Servers can report progress on long-running operations.

### Notification
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "token-from-request",
    "progress": 50,
    "total": 100,
    "message": "Processing item 50 of 100"
  }
}
```

- Client includes `progressToken` in `_meta` of request
- Server sends progress notifications referencing that token
- `progress` and `total` are numbers (total is optional)

---

## Cancellation

Either party can cancel an in-flight request.

### Notification
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 1,
    "reason": "User cancelled the operation"
  }
}
```

- Sender sends cancellation notification with original request ID
- Receiver SHOULD stop work and return an error response
- Receiver MAY still complete if work is already done
- `reason` is optional

---

## Ping

Keep-alive / connectivity check.

### Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "ping"
}
```

### Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

Can be sent by either client or server. Receiver MUST respond promptly.

---

## Logging

Servers can emit structured log messages to clients.

### Capability
```json
{ "capabilities": { "logging": {} } }
```

### Protocol Messages

- `logging/setLevel` — client sets minimum log level
- `notifications/message` — server emits log message

### Log Levels (RFC 5424)
`emergency` > `alert` > `critical` > `error` > `warning` > `notice` > `info` > `debug`

### Log Message
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "database",
    "data": "Connection established to primary database"
  }
}
```

- `data` can be any JSON value (string, object, etc.)
- Servers SHOULD respect the minimum log level set by client
- Servers using stdio MAY also write to stderr for logging

---

## Completion (Autocompletion)

Servers can provide argument autocompletion suggestions.

### Capability
```json
{ "capabilities": { "completions": {} } }
```

### Request
```json
{
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/prompt",
      "name": "prompt_name"
    },
    "argument": {
      "name": "arg_name",
      "value": "partial_val"
    }
  }
}
```

Reference types: `ref/prompt`, `ref/resource`

---

## Pagination

List operations (tools/list, resources/list, prompts/list) support cursor-based pagination.

- Request includes optional `cursor` parameter
- Response includes `nextCursor` if more results exist
- Client sends next request with returned cursor
- Cursors are opaque strings — clients MUST NOT interpret them
