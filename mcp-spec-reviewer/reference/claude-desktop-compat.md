# Claude Desktop Compatibility

**Last verified**: 2026-03 (Claude Desktop + Claude Code)
**Scope**: Claude Desktop and Claude Code specifics as MCP hosts — useful for validating server compatibility.

---

## Transport: stdio only

Claude Desktop **only supports stdio**. It does not support Streamable HTTP or HTTP+SSE.

| Implication | Detail |
|-------------|--------|
| Server must launch as subprocess | Claude Desktop starts it with the configured command |
| Exposing an HTTP port is useless | Claude Desktop will not connect |
| Remote/cloud servers are not directly compatible | They require a local stdio wrapper |

**Validation**: If a server only implements Streamable HTTP → **Not compatible with Claude Desktop**.

---

## Protocol Version

Both Claude Desktop and Claude Code now negotiate with `protocolVersion: "2025-11-25"` (verified March 2026). Older versions used `2025-06-18`.

**Recommended pattern**: the server should accept the `protocolVersion` the client sends in `initialize` or respond with the highest version it supports in common:

```json
// Client sends:
{ "protocolVersion": "2025-11-25" }

// Server responds with the same version (or the highest it supports):
{ "protocolVersion": "2025-11-25" }
```

**Validation**: If the server hardcodes a version without accepting negotiation → **Risk of failure with different Claude Desktop versions**.

---

## Configuration: claude_desktop_config.json

Configuration file location:

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### Structure

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server/index.js"],
      "env": {
        "API_KEY": "value"
      }
    }
  }
}
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `command` | Yes | Executable (node, python, go binary, npx...) |
| `args` | — | Array of arguments |
| `env` | — | Additional environment variables |

**Note**: Claude Desktop inherits the system PATH, but it may differ from the interactive shell. Using absolute paths in `command`/`args` is more reliable.

---

## Capabilities enabled in Claude Desktop

Claude Desktop as a host generally declares support for:

- **Roots** (`roots.listChanged`) — can send root lists to the server
- **Sampling** — may or may not be available depending on version

**Validation**: Do not assume the host supports sampling if the server requires it; verify negotiated capabilities in `initialize`.

---

## Known Restrictions

| Restriction | Impact |
|-------------|--------|
| stdio only | HTTP servers cannot connect |
| No hot-reload of config | Must restart Claude Desktop after changing `claude_desktop_config.json` |
| stderr visible in Claude Desktop logs | Useful for debugging; do not use stdout for logs |
| Timeout on initialize | Slow-starting servers may fail the connection |

---

## Quick checklist: Is my server compatible with Claude Desktop?

- [ ] Implements **stdio** transport
- [ ] Accepts `protocolVersion` negotiation (client echo or graceful fallback)
- [ ] Does not write non-MCP content to **stdout**
- [ ] Uses **stderr** for logging
- [ ] Starts quickly (initialize does not make slow synchronous calls)
- [ ] Does not require host capabilities that Claude Desktop may not support (e.g., sampling)
