---
name: wp-plugin-docs-generator
description: >
  Genera sitios de documentación profesionales para plugins WordPress con Astro Starlight.
  Usar cuando el usuario quiera crear documentación o un sitio de docs para un plugin WordPress.
  Triggers: "documenta mi plugin", "crea docs del plugin", "genera documentación para mi plugin WordPress",
  "quiero un site de docs para mi plugin", "documentación Starlight WordPress".
  Cubre instalación, configuración, campos ACF, templates, shortcodes, CPTs, hooks y referencia de desarrollador.
  Produce un proyecto Astro Starlight listo para desplegar con fuentes Typekit y tema light.
license: MIT
---

# WordPress Plugin Documentation Generator (Astro Starlight)

Genera sitios de documentación profesionales para plugins WordPress con **Astro Starlight** — búsqueda, sidebar, i18n y accesibilidad out of the box.

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
npm create astro@latest -- --template starlight plugin-docs
```

### Estructura del Proyecto

```
plugin-docs/
├── astro.config.mjs
├── src/
│   ├── content/docs/
│   │   ├── index.mdx               # Overview + hero
│   │   ├── installation.mdx
│   │   ├── configuration/
│   │   │   ├── acf-fields.mdx      # Solo si usa ACF
│   │   │   └── options.mdx
│   │   ├── usage/
│   │   │   ├── templates.mdx       # Solo si tiene templates
│   │   │   ├── shortcodes.mdx      # Solo si tiene shortcodes
│   │   │   └── custom-post-types.mdx # Solo si registra CPTs
│   │   ├── developers/
│   │   │   ├── hooks.mdx
│   │   │   ├── functions.mdx
│   │   │   └── architecture.mdx
│   │   └── changelog.mdx
│   ├── components/
│   │   └── Head.astro              # Typekit + light mode
│   └── styles/
│       └── custom.css              # Solo fuentes
└── content.config.ts
```

### `astro.config.mjs`

Ver template en `./templates/astro.config.mjs`

### `Head.astro` — Typekit + Light Mode

Ver template en `./templates/Head.astro`

### `custom.css` — Solo Fuentes

Ver template en `./templates/custom.css`

## Workflow

1. **Leer el plugin**: cabecera del archivo principal, `README.md`, `CLAUDE.md` si existe
2. **Identificar features**: ACF, CPTs, templates, shortcodes, hooks, clases públicas
3. **Detectar dependencias**: ACF, Divi, WooCommerce u otros requeridos
4. **Leer `CHANGELOG.md`** si existe — extraer versiones directamente
5. **Decidir secciones**: Solo crear páginas para features reales del plugin
6. **Scaffold Starlight**: `astro.config.mjs` con sidebar adaptada a las secciones reales
7. **Escribir MDX**: Datos extraídos del código — nunca placeholders
8. **Verificar**: Sidebar coincide con archivos, imports correctos, sin TODOs

## Secciones de Documentación

Leer `./references/mdx-templates.md` para los templates MDX de cada sección.
Leer `./references/content-guidelines.md` para la tabla de secciones por feature, componentes Starlight y checklist de calidad.

### Secciones fijas (siempre)
- `index.mdx` — Overview + hero
- `installation.mdx` — Instalación paso a paso
- `changelog.mdx` — Historial de versiones

### Secciones opcionales (solo si el plugin las tiene)
- `configuration/acf-fields.mdx` — Si usa ACF
- `configuration/options.mdx` — Si tiene página de opciones
- `usage/templates.mdx` — Si registra page templates
- `usage/shortcodes.mdx` — Si tiene shortcodes
- `usage/custom-post-types.mdx` — Si registra CPTs
- `developers/hooks.mdx` — Si expone actions/filters
- `developers/functions.mdx` — Si tiene API pública
- `developers/architecture.mdx` — Siempre útil para plugins complejos
