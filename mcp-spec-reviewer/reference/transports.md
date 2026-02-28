# Transports

**Spec revision**: 2025-11-25
**Source**: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

---

## Overview

Two standard transports:
1. **stdio** — client launches server as subprocess
2. **Streamable HTTP** — server as independent HTTP process (replaces deprecated HTTP+SSE from 2024-11-05)

Clients SHOULD support stdio whenever possible. Custom transports are also allowed.

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

Server provides a **single MCP endpoint** supporting POST and GET.

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
| For notification/response: server MUST return 202 Accepted if accepted | MUST |
| For notification/response: server MUST return HTTP error if rejected | MUST |
| For request: server MUST return `application/json` OR `text/event-stream` | MUST |
| Client MUST support both content types | MUST |

### SSE Stream Behavior

- SHOULD immediately send event with ID + empty data (priming)
- MAY close connection without terminating stream (polling pattern)
- SHOULD send `retry` field before closing early
- Client MUST respect `retry` field timing
- Stream SHOULD eventually include JSON-RPC response
- After response sent, server SHOULD terminate stream
- Disconnection SHOULD NOT be interpreted as cancellation

### Listening (Server → Client via GET)

| Rule | Level |
|------|-------|
| Client MAY issue GET to open SSE stream | MAY |
| Client MUST include Accept with `text/event-stream` | MUST |
| Server MUST return `text/event-stream` or 405 | MUST |
| Server MUST NOT send response on GET stream (unless resuming) | MUST |

### Multiple Connections

- Server MUST send each message on only one stream (no broadcasting)

---

## Resumability & Redelivery

- If event IDs present: MUST be globally unique within session
- Event IDs SHOULD encode stream identity
- On reconnect: client SHOULD send GET with `Last-Event-ID` header
- Server MAY replay missed messages from disconnected stream
- Server MUST NOT replay messages from different stream

---

## Session Management

| Rule | Level |
|------|-------|
| Server MAY assign session ID via `MCP-Session-Id` header | MAY |
| Session ID SHOULD be globally unique and cryptographically secure | SHOULD |
| Session ID MUST only contain visible ASCII (0x21-0x7E) | MUST |
| Client MUST include `MCP-Session-Id` on all subsequent requests | MUST |
| Server SHOULD respond 400 to requests without session ID (when required) | SHOULD |
| Terminated session: server MUST respond 404 | MUST |
| Client receiving 404 MUST start new session | MUST |
| Client SHOULD send DELETE with session ID when done | SHOULD |

---

## Protocol Version Header

| Rule | Level |
|------|-------|
| Client MUST include `MCP-Protocol-Version: <version>` on all HTTP requests | MUST |
| Missing header: server SHOULD assume 2025-03-26 | SHOULD |
| Invalid/unsupported version: server MUST respond 400 | MUST |

---

## Backwards Compatibility (HTTP+SSE → Streamable HTTP)

**Clients** supporting old servers:
1. POST InitializeRequest to server URL
2. If success → Streamable HTTP
3. If 400/404/405 → try GET expecting SSE stream with `endpoint` event → old transport

---

## Custom Transports

- MAY implement additional transports
- MUST preserve JSON-RPC message format and lifecycle requirements
- SHOULD document connection and exchange patterns
