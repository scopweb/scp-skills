# MCP Compliance Checklist

**Spec revision**: 2025-11-25
All requirements extracted from the official specification.

Legend: 🔴 MUST | 🟡 SHOULD | 🟢 MAY

---

## Base Protocol

### JSON-RPC
- 🔴 All messages MUST be UTF-8 encoded JSON-RPC 2.0
- 🔴 Request IDs MUST be string or integer, MUST NOT be null
- 🔴 Request IDs MUST NOT have been previously used by the requestor within the same session
- 🔴 Implementations MUST support JSON Schema 2020-12 for schemas without explicit `$schema`
- 🔴 MUST handle unsupported schema dialects gracefully with appropriate error

### _meta
- 🟢 Requests, notifications, results MAY include `_meta` for protocol metadata

---

## Lifecycle

### Initialization
- 🔴 Initialization MUST be the first interaction between client and server
- 🔴 Client MUST send `initialize` request with protocolVersion, capabilities, clientInfo
- 🔴 Server MUST respond with protocolVersion, capabilities, serverInfo
- 🔴 Client MUST send `notifications/initialized` after receiving server response
- 🟡 Client SHOULD NOT send requests (except ping) before server response
- 🟡 Server SHOULD NOT send requests (except ping, logging) before `initialized`

### Version Negotiation
- 🔴 Client MUST send protocol version in initialize
- 🟡 Client SHOULD send latest supported version
- 🔴 Server MUST respond with same version if supported, or another supported version
- 🟡 Server SHOULD respond with latest supported if client's version unsupported
- 🟡 Client SHOULD disconnect if it doesn't support server's version
- 🟡 Server SHOULD implement version auto-detection (echo client's version) for universal compatibility — see [lifecycle-and-capabilities.md](./lifecycle-and-capabilities.md#protocol-version-auto-detection-pattern-recommended)

### Instructions Field
- 🟢 Server MAY include `instructions` field in initialize response to guide LLM behavior
- 🟡 Clients SHOULD surface `instructions` to the LLM as context for interacting with the server
- 🟡 **RECOMMENDED**: Servers SHOULD set `instructions` with a complete tool catalog and usage rules — without it, AI models may discover only a subset of tools and ignore the rest. In Go (`mcp-go`): `server.WithInstructions(...)`. In the official Go SDK: set `ServerConfig.Instructions`. See [lifecycle-and-capabilities.md](./lifecycle-and-capabilities.md#server-instructions-instructions-field) for details and examples.

### Capability Negotiation
- 🔴 Both parties MUST respect negotiated protocol version during operation
- 🔴 Both parties MUST only use successfully negotiated capabilities

### Shutdown
- 🟡 Client SHOULD close stdin, wait, SIGTERM, then SIGKILL (stdio)
- 🟢 Server MAY initiate shutdown by closing stdout (stdio)

### Timeouts
- 🟡 SHOULD establish timeouts for all sent requests
- 🟡 On timeout: SHOULD send cancellation notification
- 🟡 SDKs SHOULD allow per-request timeout configuration
- 🟢 MAY reset timeout on progress notifications
- 🟡 SHOULD enforce maximum timeout regardless of progress

---

## Transports

### stdio
- 🔴 Messages MUST NOT contain embedded newlines
- 🟢 Server MAY write to stderr for logging
- 🟡 Client SHOULD NOT assume stderr = error
- 🔴 Server MUST NOT write non-MCP to stdout
- 🔴 Client MUST NOT write non-MCP to server stdin

### Streamable HTTP — Security
- 🔴 Servers MUST validate Origin header on all connections
- 🔴 Invalid Origin → MUST respond 403 Forbidden
- 🟡 Local servers SHOULD bind to localhost only
- 🟡 Servers SHOULD implement proper authentication

### Streamable HTTP — POST
- 🔴 Client MUST use POST for sending messages
- 🔴 Client MUST include Accept with `application/json` and `text/event-stream`
- 🔴 POST body MUST be single JSON-RPC message
- 🔴 Notification/response accepted → MUST return 202 Accepted
- 🔴 Notification/response rejected → MUST return HTTP error
- 🔴 Request → MUST return `application/json` or `text/event-stream`
- 🔴 Client MUST support both content types

### Streamable HTTP — GET
- 🟢 Client MAY issue GET for SSE stream
- 🔴 Client MUST include Accept with `text/event-stream`
- 🔴 Server MUST return `text/event-stream` or 405
- 🔴 Server MUST NOT send response on GET stream (unless resuming)

### Streamable HTTP — SSE
- 🟡 Server SHOULD prime with event ID + empty data
- 🟢 Server MAY close connection without terminating stream
- 🟡 Server SHOULD send `retry` before closing early
- 🔴 Client MUST respect `retry` timing
- 🟡 Stream SHOULD eventually include response
- 🟡 After response: server SHOULD terminate stream
- 🟡 Disconnection SHOULD NOT be interpreted as cancellation

### Session Management
- 🟢 Server MAY assign session ID via `MCP-Session-Id` header
- 🟡 Session ID SHOULD be globally unique, cryptographically secure
- 🔴 Session ID MUST contain only visible ASCII (0x21-0x7E)
- 🔴 Client MUST handle session ID securely
- 🔴 Client MUST include session ID on all subsequent requests (if assigned)
- 🟡 Server SHOULD respond 400 to requests without session ID (when required)
- 🔴 Terminated session → MUST respond 404
- 🔴 Client receiving 404 MUST start new session
- 🟡 Client SHOULD send DELETE to end session

### Protocol Version Header
- 🔴 Client MUST include `MCP-Protocol-Version` on all HTTP requests
- 🟡 SHOULD be negotiated version
- 🟡 Missing header: server SHOULD assume 2025-03-26
- 🔴 Invalid version: MUST respond 400

### Multiple Connections
- 🔴 Server MUST send each message on only one stream (no broadcast)

### Resumability
- 🔴 SSE event IDs MUST be globally unique within session (if used)
- 🟡 Event IDs SHOULD encode stream identity
- 🔴 Server MUST NOT replay messages from different stream

---

## Tools

### Declaration
- 🔴 Servers with tools MUST declare `tools` capability

### Tool Definition
- 🟡 Names SHOULD be 1-128 chars, case-sensitive
- 🟡 Names SHOULD use only A-Z, a-z, 0-9, `_`, `-`, `.`
- 🟡 Names SHOULD NOT contain spaces/commas/special chars
- 🟡 Names SHOULD be unique within server
- 🔴 `inputSchema` MUST be valid JSON Schema (not null)
- 🔴 If `outputSchema` provided: server MUST return conformant `structuredContent`
- 🟡 Clients SHOULD validate `structuredContent` against `outputSchema`

### Tool Annotations
- 🔴 Clients MUST consider annotations untrusted (unless from trusted server)

### Tool Results
- 🟡 Structured content: SHOULD also include serialized JSON in TextContent for backwards compat

### Error Handling
- 🟡 Input validation errors → Tool Execution Error (isError: true), NOT protocol error
- 🟡 Clients SHOULD provide tool execution errors to LLMs
- 🟢 Clients MAY provide protocol errors to LLMs

### Security
- 🔴 Servers MUST validate all tool inputs
- 🔴 Servers MUST implement access controls
- 🔴 Servers MUST rate limit tool invocations
- 🔴 Servers MUST sanitize tool outputs
- 🟡 Clients SHOULD prompt user confirmation on sensitive operations
- 🟡 Clients SHOULD show inputs before calling server
- 🟡 Clients SHOULD validate results before passing to LLM
- 🟡 Clients SHOULD implement timeouts
- 🟡 Clients SHOULD log usage for audit

### List Changed
- 🟡 If `listChanged` declared: SHOULD send `notifications/tools/list_changed`

---

## Resources

### Declaration
- 🔴 Servers with resources MUST declare `resources` capability

### URI Schemes
- 🟡 `https://` SHOULD only be used when client can fetch directly
- 🟡 SHOULD prefer non-https schemes when client reads via MCP

### Subscriptions
- Supported if `subscribe: true` in capability

---

## Prompts

### Declaration
- 🔴 Servers with prompts MUST declare `prompts` capability

### Errors
- 🟡 SHOULD return standard JSON-RPC errors for failures

---

## Client Features

### Elicitation
- 🔴 Clients declaring elicitation MUST support at least one mode (form or url)
- 🔴 Servers MUST NOT send modes unsupported by client
- 🔴 URL mode: `url` parameter MUST contain valid URL

### Sampling
- 🔴 Users MUST explicitly approve sampling requests

---

## Utilities

### Ping
- 🔴 Receiver MUST respond promptly to ping

### Tasks (Experimental)
- 🔴 Task IDs MUST be strings
- 🔴 Task IDs MUST be generated by the receiver
- 🔴 Task IDs MUST be unique among all tasks controlled by the receiver
- 🔴 Tasks MUST begin in `working` status
- 🔴 Terminal statuses (`completed`, `failed`, `cancelled`) MUST NOT transition further
- 🔴 `tasks/result` for terminal task MUST return what original request would have returned
- 🔴 `tasks/result` for non-terminal task MUST block until terminal status
- 🔴 Receivers MUST reject cancel for tasks already terminal (error `-32602`)
- 🔴 Receivers MUST include `createdAt` and `lastUpdatedAt` in all task responses
- 🔴 When authorization context exists, receivers MUST bind tasks to that context
- 🔴 If context-binding unavailable, receivers MUST generate cryptographically secure task IDs
- 🔴 Related-task metadata (`io.modelcontextprotocol/related-task`) MUST be included in all task-related messages
- 🟡 Requestors SHOULD respect `pollInterval`
- 🟡 Requestors SHOULD continue polling until terminal status
- 🔴 Requestors MUST NOT rely on `notifications/tasks/status` (it is optional)
- 🟡 Receivers without requestor identification SHOULD NOT declare `tasks.list` capability

### Pagination
- 🔴 Cursors are opaque — clients MUST NOT interpret them

---

## Security & Trust

### General Principles
- 🟡 SHOULD always have human in the loop for tool invocations
- 🟡 Hosts MUST obtain explicit user consent before exposing data to servers
- 🟡 Hosts MUST NOT transmit resource data elsewhere without consent

### Content Annotations
- 🟢 All content types MAY include `annotations` object
- 🟡 `audience` SHOULD be an array of `"user"`, `"assistant"`, or both — guides who sees the content
- 🟡 `priority` SHOULD be a number from 0.0 (least) to 1.0 (most important / effectively required)
- 🟡 `lastModified` SHOULD be an ISO 8601 timestamp when applicable
- 🟡 Clients SHOULD respect `audience` to filter content visibility between user and LLM

### Icons
- 🔴 Icon `src` MUST be HTTPS or `data:` URI — MUST reject unsafe schemes (`javascript:`, `file:`, `ftp:`, `ws:`)
- 🔴 Clients MUST support at least `image/png` and `image/jpeg` MIME types
- 🔴 MUST disallow scheme changes and redirects to different origins
- 🔴 MUST fetch icons without credentials (no cookies, no Authorization headers)
- 🟡 SHOULD verify icon URIs are from same origin as the server
- 🟡 SHOULD also support `image/svg+xml` and `image/webp`
- 🟡 SHOULD validate MIME via magic bytes; reject on mismatch
- 🟡 SHOULD maintain strict allowlist of image types
- 🟢 Consumers MAY disallow specific file types or sanitize before rendering
- 🟢 Consumers MAY set limits for image/content size

---

## Authorization (Streamable HTTP only)

### Discovery
- 🔴 MCP servers MUST implement OAuth 2.0 Protected Resource Metadata ([RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728))
- 🔴 MCP clients MUST use Protected Resource Metadata for authorization server discovery
- 🔴 MCP clients MUST support both `WWW-Authenticate` header and well-known URI discovery
- 🔴 Authorization servers MUST provide OAuth 2.0 AS Metadata ([RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414)) or OpenID Connect Discovery
- 🔴 MCP clients MUST support both OAuth 2.0 and OpenID Connect discovery mechanisms

### Server
- 🔴 Authorization servers MUST implement OAuth 2.1
- 🔴 Server MUST respond 401 when authorization is required but missing/invalid
- 🔴 Server MUST validate access tokens on every request ([OAuth 2.1 Section 5.2](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13#section-5.2))
- 🔴 Server MUST validate tokens were issued specifically for them as intended audience
- 🔴 Server MUST NOT accept or transit tokens not intended for them
- 🔴 Server MUST NOT pass through received tokens to upstream APIs
- 🔴 Invalid/expired tokens MUST receive 401 response
- 🟡 Authorization servers SHOULD issue short-lived access tokens
- 🔴 For public clients, authorization servers MUST rotate refresh tokens

### Client
- 🔴 Client MUST use PKCE for all authorization code requests
- 🔴 Client MUST use S256 code challenge method when capable
- 🔴 Client MUST verify PKCE support via AS metadata before proceeding (refuse if `code_challenge_methods_supported` absent)
- 🔴 Client MUST include `Authorization: Bearer <token>` header on every HTTP request
- 🔴 Access tokens MUST NOT be in URI query string
- 🔴 Client MUST include `resource` parameter (RFC 8707) in authorization and token requests
- 🔴 Client MUST NOT send tokens to servers other than the intended resource server
- 🔴 Client MUST store tokens securely
- 🟡 Client SHOULD attempt token refresh before re-authorization
- 🟡 Clients and servers SHOULD support Client ID Metadata Documents
- 🟢 Clients and servers MAY support Dynamic Client Registration ([RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591))

### Communication Security
- 🔴 All authorization server endpoints MUST be served over HTTPS
- 🔴 All redirect URIs MUST be localhost or HTTPS
- 🔴 Authorization servers MUST validate exact redirect URIs (no wildcards)
