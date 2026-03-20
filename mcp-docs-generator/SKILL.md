---
name: mcp-docs-generator
description: >
  Genera sitios de documentación profesionales para servidores MCP con Astro Starlight.
  Usar cuando el usuario quiera crear docs o un site de documentación para un MCP server.
  Triggers: "documenta mi MCP", "crea MCP docs", "genera documentación para mi servidor MCP",
  "quiero un site de docs para mi MCP", "documentación Starlight MCP".
  Produce un proyecto Astro Starlight listo para desplegar con fuentes Typekit y tema light.
license: MIT
---

# MCP Documentation Generator (Astro Starlight)

Genera documentación profesional para MCP servers con **Astro Starlight** — búsqueda, sidebar, i18n y accesibilidad out of the box.

## Design System

### Fuentes — Adobe Typekit

```
https://use.typekit.net/mwu3psf.css
```

- **`--sl-font`** (body): `"tondo", sans-serif`
- **`--sl-font-system`** (nav/UI): `"tondo-signage", sans-serif`
- **`--sl-font-mono`** (código): `"aesthet-nova", monospace`

### Regla crítica de CSS

**NO sobreescribir `--sl-color-*`** en `custom.css`. Starlight gestiona colores, fondos y contraste automáticamente. El `custom.css` solo contiene fuentes y oculta el toggle de tema.

## Project Setup

```bash
npm create astro@latest -- --template starlight mcp-docs-name
```

### Estructura del proyecto

```
mcp-docs/
├── astro.config.mjs
├── src/
│   ├── content/docs/
│   │   ├── index.mdx          # Hero / Overview
│   │   ├── installation.mdx   # Setup guide
│   │   ├── usage.mdx          # Tools & examples
│   │   └── security.mdx       # Security docs
│   ├── components/
│   │   └── Head.astro          # Typekit + light mode
│   └── styles/
│       └── custom.css          # Solo fuentes
└── content.config.ts
```

### Templates de configuración

Ver archivos en `./templates/`:
- `astro.config.mjs` — config completa con sidebar, customCss, Head override
- `Head.astro` — Typekit stylesheet + force light mode
- `custom.css` — solo variables de fuente, sin `--sl-color-*`

## Workflow

1. **Gather info**: Leer código fuente del MCP server, `package.json`, README existente
2. **Extract tools**: Parsear definiciones de tools (nombres, parámetros, tipos, schemas)
3. **Extract config**: Variables de entorno, permisos, opciones de configuración
4. **Scaffold Starlight**: `astro.config.mjs` con sidebar adaptada a los tools reales
5. **Write MDX**: Datos reales del servidor — nunca placeholders
6. **Verify**: Todos los tools documentados, sidebar coincide con archivos, sin TODOs

## Secciones de documentación

Leer `./references/mdx-templates.md` para los templates MDX de cada sección.  
Leer `./references/content-guidelines.md` para workflow detallado, componentes Starlight y checklist.

### Secciones estándar (siempre)

| Archivo | Contenido |
|---------|-----------|
| `index.mdx` | Hero, descripción, feature cards por tool |
| `installation.mdx` | Prerequisitos, instalación, config del cliente MCP, verificación |
| `usage.mdx` | Todos los tools con parámetros, ejemplos de input/output, opciones de config |
| `security.mdx` | Modelo de permisos, variables de entorno, checklist de seguridad |

### Secciones opcionales (si el servidor las tiene)

| Archivo | Cuándo añadir |
|---------|---------------|
| `changelog.mdx` | Si tiene historial de versiones |
| `api-reference.mdx` | Si expone recursos además de tools |
| `troubleshooting.mdx` | Si hay casos de error complejos |
| `contributing.mdx` | Si es open source y acepta contribuciones |
