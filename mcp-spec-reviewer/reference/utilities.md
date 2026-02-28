# Utilities

**Spec revision**: 2025-11-25
**Source**: https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/

---

## Tasks (Experimental — 2025-11-25)

Tasks are durable state machines for tracking long-running work.

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

### Task Status Lifecycle

```
created → working → completed
                  → failed
                  → cancelled
         → input_required → working (after user input)
```

### Protocol Messages

- Request with `_meta.task.create: true` — create task-augmented request
- `tasks/get` — poll task status
- `tasks/result` — retrieve completed task result
- `tasks/list` — list known tasks
- `tasks/cancel` — cancel a running task
- `notifications/tasks/status_changed` — server notifies status change

### Key Fields

```json
{
  "taskId": "uuid-here",
  "status": "working",
  "statusMessage": "Processing...",
  "ttl": 60000,
  "pollInterval": 5000
}
```

### Task Rules

| Rule | Level |
|------|-------|
| Task IDs MUST be unique within session | MUST |
| Receivers MUST generate task IDs | MUST |
| MUST NOT create tasks unless requestor includes `_meta.task.create` | MUST |
| Task access MUST be restricted to creating session | MUST |
| `tasks/result` returns what the original request would have returned | MUST |
| Requestors SHOULD respect `pollInterval` | SHOULD |

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
- `total` is optional

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

- Receiver SHOULD stop work and return an error response
- Receiver MAY still complete if work is already done
- `reason` is optional

---

## Ping

Keep-alive / connectivity check.

```json
{ "jsonrpc": "2.0", "id": 1, "method": "ping" }
```

Response:
```json
{ "jsonrpc": "2.0", "id": 1, "result": {} }
```

Receiver MUST respond promptly. Can be sent by either party.

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
    "data": "Connection established"
  }
}
```

Servers SHOULD respect the minimum log level set by client.
Servers using stdio MAY also write to stderr for logging.

---

## Completion (Autocompletion)

### Capability
```json
{ "capabilities": { "completions": {} } }
```

### Request
```json
{
  "method": "completion/complete",
  "params": {
    "ref": { "type": "ref/prompt", "name": "prompt_name" },
    "argument": { "name": "arg_name", "value": "partial_val" }
  }
}
```

Reference types: `ref/prompt`, `ref/resource`

---

## Pagination

List operations support cursor-based pagination.

- Request includes optional `cursor` parameter
- Response includes `nextCursor` if more results exist
- Cursors are opaque strings — clients MUST NOT interpret them
