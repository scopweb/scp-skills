# Transports

**Spec revision**: 2025-11-25
**Source**: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

---

## Overview

Two standard transports:
1. **stdio** — client launches server as subprocess
2. **Streamable HTTP** — server as independent HTTP process (replaces deprecated HTTP+SSE from 2024-11-05)

Clients SHOULD support stdio whenever possible. Custom transports are also allowed.

> ⚠️ **Roadmap 2026**: No se añadirán nuevos transports oficiales en este ciclo. El trabajo se centra en evolucionar Streamable HTTP para soportar escalado horizontal sin estado de sesión en servidor. Ver [nota de producción](#streamable-http-production-notes) abajo.

---

## stdio Transport

Client launches MCP server as a subprocess.

### Rules

| Rule | Level |
|------|-------|
| Server reads JSON-RPC from stdin, writes to stdout | — |
| Messages delimited by newlines | — |
| Messages MUST NOT contain embedded newlines | MUST |
| Server MAY write UTF-8 to stderr for logging | MAY |
| Client MAY capture, forward, or ignore stderr | MAY |
| Client SHOULD NOT assume stderr = error conditions | SHOULD |
| Server MUST NOT write non-MCP content to stdout | MUST |
| Client MUST NOT write non-MCP content to server stdin | MUST |

---

## Streamable HTTP Transport

Server provides a **single MCP endpoint** supporting POST and GET (e.g., `https://example.com/mcp`).

### Security Requirements (CRITICAL)

| Rule | Level |
|------|-------|
| Server MUST validate Origin header on all incoming connections | MUST |
| Invalid Origin → MUST respond 403 Forbidden | MUST |
| Local servers SHOULD bind to localhost (127.0.0.1) only | SHOULD |
| Servers SHOULD implement proper authentication | SHOULD |

### Sending Messages (Client → Server via POST)

| Rule | Level |
|------|-------|
| Client MUST use POST to send JSON-RPC messages | MUST |
| Client MUST include Accept header with `application/json` and `text/event-stream` | MUST |
| POST body MUST be single JSON-RPC request, notification, or response | MUST |
| For notification/response input: server MUST return 202 Accepted (no body) if accepted | MUST |
| For notification/response input: server MUST return HTTP error if rejected | MUST |
| For request input: server MUST return `application/json` OR `text/event-stream` | MUST |
| Client MUST support both content types | MUST |

### SSE Stream Behavior

When server initiates SSE stream in response to POST:
- SHOULD immediately send event with ID + empty data (priming)
- MAY close connection without terminating stream (polling pattern)
- SHOULD send `retry` field before closing if connection closing early
- Client MUST respect `retry` field timing
- Stream SHOULD eventually include JSON-RPC response to original request
- Server MAY send requests/notifications before the response
- After response sent, server SHOULD terminate stream
- Disconnection SHOULD NOT be interpreted as cancellation
- Client SHOULD send explicit `CancelledNotification` to cancel

### Listening (Server → Client via GET)

| Rule | Level |
|------|-------|
| Client MAY issue GET to open SSE stream | MAY |
| Client MUST include Accept with `text/event-stream` | MUST |
| Server MUST return `text/event-stream` or 405 Method Not Allowed | MUST |
| Server MAY send requests/notifications on GET stream | MAY |
| Server MUST NOT send response on GET stream (unless resuming) | MUST |
| Server MAY close SSE stream at any time | MAY |
| Client MAY close SSE stream at any time | MAY |

### Multiple Connections

- Client MAY connect to multiple SSE streams simultaneously
- Server MUST send each message on only one stream (no broadcasting)

---

## Resumability & Redelivery

- Servers MAY attach `id` to SSE events
- If present: ID MUST be globally unique within session
- Event IDs SHOULD encode stream identity
- On reconnect: client SHOULD send GET with `Last-Event-ID` header
- Server MAY replay missed messages from disconnected stream
- Server MUST NOT replay messages from different stream
- Resumption is always via GET with `Last-Event-ID` regardless of original stream origin

---

## Session Management

| Rule | Level |
|------|-------|
| Server MAY assign session ID via `MCP-Session-Id` header in InitializeResult response | MAY |
| Session ID SHOULD be globally unique and cryptographically secure | SHOULD |
| Session ID MUST only contain visible ASCII (0x21-0x7E) | MUST |
| Client MUST handle session ID securely | MUST |
| Client MUST include `MCP-Session-Id` on all subsequent requests (if assigned) | MUST |
| Server SHOULD respond 400 to requests without session ID (when required) | SHOULD |
| Server MAY terminate session at any time | MAY |
| Terminated session: server MUST respond 404 to requests with that session ID | MUST |
| Client receiving 404 MUST start new session | MUST |
| Client SHOULD send DELETE with session ID when no longer needed | SHOULD |
| Server MAY respond 405 to DELETE (doesn't support client-initiated termination) | MAY |

---

## Protocol Version Header

| Rule | Level |
|------|-------|
| Client MUST include `MCP-Protocol-Version: <version>` on all HTTP requests | MUST |
| Version SHOULD be the negotiated one | SHOULD |
| Missing header: server SHOULD assume 2025-03-26 | SHOULD |
| Invalid/unsupported version: server MUST respond 400 Bad Request | MUST |

---

## Backwards Compatibility (HTTP+SSE → Streamable HTTP)

**Servers** supporting old clients:
- Host both old SSE+POST endpoints and new MCP endpoint

**Clients** supporting old servers:
1. POST InitializeRequest to server URL
2. If success → Streamable HTTP
3. If 400/404/405 → try GET expecting SSE stream with `endpoint` event → old transport

---

## Custom Transports

- MAY implement additional transports
- MUST preserve JSON-RPC message format and lifecycle requirements
- SHOULD document connection and exchange patterns

---

## Streamable HTTP — Production Notes

> ℹ️ **Estado (marzo 2026)**: En producción a escala se han detectado problemas conocidos. La spec 2025-11-25 es válida, pero tener en cuenta al diseñar:

| Problema | Impacto | Mitigación actual |
|----------|---------|-------------------|
| Sesiones stateful pelean con load balancers | El `MCP-Session-Id` vincula cliente a instancia de servidor | Sticky sessions / session affinity en LB |
| Sin escalado horizontal nativo | Cada sesión requiere estado en servidor | Workarounds: Redis para estado compartido |
| Sin mecanismo de discovery sin conectar | Registries/crawlers no pueden listar capacidades sin inicializar | Usar MCP Registry cuando disponible |

**Roadmap**: El grupo de trabajo está diseñando un modelo de sesión stateless y un mecanismo de discovery de capacidades. Próximas versiones de spec abordarán estos gaps.

**Recomendación para servidores de producción**: Si el servidor va a desplegarse detrás de un LB, diseñar con sticky sessions habilitadas o implementar estado de sesión en capa compartida (Redis/DB) desde el principio.
