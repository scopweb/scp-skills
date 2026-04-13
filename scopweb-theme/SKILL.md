---
name: scopweb-theme
description: Apply the scopweb.com visual theme to Astro Starlight documentation projects. Use when customizing Starlight docs branding, typography, color system, social links, and custom CSS to match Scopweb style.
---

# Scopweb Theme for Starlight

Use this skill to apply the Scopweb visual identity to an existing Astro Starlight documentation project.

## What this skill covers

- Starlight configuration updates in `astro.config.mjs`
- Typography and font loading
- Theme colors and design tokens
- `customCss` integration
- Scopweb social link in header icons

## References in this folder

- `scopweb-theme.md`
- `00-scopweb-unified-reference.md`
- `01-scopweb-design-system-reference.md`
- `02-firefox-extension-reference.md`
- `03-vanilla-js-reference.md`
- `04-wordpress-admin-reference.md`

## Execution notes

1. Detect the Starlight project root and locate `astro.config.mjs`.
2. Ensure `customCss` and font links are configured.
3. Add Scopweb social link without replacing existing social entries.
4. Apply the provided CSS theme in the configured stylesheet.
5. Keep existing project structure and content intact.
