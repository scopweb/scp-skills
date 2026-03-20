# MDX Page Templates — MCP Server Docs

Templates para cada sección. Adaptar con datos reales del servidor MCP — nunca placeholders.

---

## 1. Overview (`index.mdx`)

```mdx
---
title: MCP Server Name
description: One-line description of what this server does.
template: splash
hero:
  title: MCP Server Name
  tagline: What it does in plain language — no jargon.
  actions:
    - text: Get Started
      link: /installation/
      icon: right-arrow
    - text: View on GitHub
      link: https://github.com/your-org/mcp-server-name
      variant: minimal
      icon: external
---

import { Card, CardGrid } from '@astrojs/starlight/components';

## What does this server do?

Brief explanation in 2-3 sentences. Focus on the **problem it solves**, not the technology.

<CardGrid>
  <Card title="Tool Name 1" icon="pencil">Brief description.</Card>
  <Card title="Tool Name 2" icon="setting">Brief description.</Card>
</CardGrid>
```

---

## 2. Installation (`installation.mdx`)

```mdx
---
title: Installation
description: Get up and running in under 2 minutes.
---

import { Tabs, TabItem, Steps } from '@astrojs/starlight/components';

## Prerequisites

| Requirement | Minimum Version | Check Command |
|-------------|-----------------|---------------|
| Node.js     | 18.0+           | `node --version` |

<Steps>

1. **Install the server**

   <Tabs>
     <TabItem label="npm">
     ```bash
     npm install -g @your-org/mcp-server-name
     ```
     </TabItem>
     <TabItem label="npx (no install)">
     ```bash
     npx @your-org/mcp-server-name
     ```
     </TabItem>
   </Tabs>

2. **Add to your MCP client config**

   ```json title="claude_desktop_config.json"
   {
     "mcpServers": {
       "server-name": {
         "command": "npx",
         "args": ["-y", "@your-org/mcp-server-name"],
         "env": { "API_KEY": "your-api-key-here" }
       }
     }
   }
   ```

   :::caution[Keep your keys safe]
   Never commit API keys to version control.
   :::

3. **Verify it works**

   ```bash
   mcp-server-name --health-check
   # Expected: ✅ Server healthy — 3 tools available
   ```

</Steps>

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `EACCES permission denied` | npm permissions | Fix npm permissions or use `sudo` |
| `Connection refused` | Server not running | Check config path, restart MCP client |
```

---

## 3. Usage (`usage.mdx`)

```mdx
---
title: Usage & Tools
description: All available tools with examples.
---

import { Aside } from '@astrojs/starlight/components';

## Available Tools

### `tool_name`

Brief description of what it does.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path`    | `string` | ✅ | Path to the file |
| `encoding`| `string` | —  | File encoding (default: utf-8) |

**Example input:**
```json
{ "path": "/home/user/document.txt" }
```

**Example output:**
```json
{ "content": "Hello, world!", "size": 13 }
```

:::tip
Relative paths are resolved from the configured working directory.
:::

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `WORKING_DIR` | `string` | `.` | Base directory for operations |
| `MAX_FILE_SIZE` | `number` | `10485760` | Max file size in bytes (10MB) |
| `LOG_LEVEL` | `string` | `info` | Logging verbosity |
```

---

## 4. Security (`security.mdx`)

```mdx
---
title: Security
description: Understand permissions and keep your data safe.
---

import { Steps } from '@astrojs/starlight/components';

## Permission Model

| Access Type | Scope | Details |
|-------------|-------|---------|
| **Filesystem** | Read/Write | Limited to configured `WORKING_DIR` |
| **Network** | None | No outbound connections |
| **System** | None | No system-level operations |

:::danger[Important]
Review the access scope before granting permissions.
:::

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | ✅ | Authentication token |
| `WORKING_DIR` | — | Restricts filesystem access |

:::caution
Store secrets in environment variables — never in your config JSON.
:::

## Security Checklist

<Steps>
1. ✅ Keep the server updated
2. ✅ Restrict `WORKING_DIR` to only necessary directories
3. ✅ Use environment variables for all secrets
4. ✅ Review tool permissions before first use
5. ✅ Monitor server logs for unexpected access
</Steps>

## Reporting Vulnerabilities

Email security@your-org.com — do **not** open a public issue.
```
