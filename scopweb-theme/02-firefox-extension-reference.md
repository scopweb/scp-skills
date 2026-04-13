# Firefox Extension Reference

Adaptación del estilo scopweb para extensiones Firefox.

## Cuándo usarlo

- Popup
- Options page
- Sidebar
- Content scripts con UI inyectada

## Criterios de diseño

- Prioriza interfaces compactas.
- Usa el fondo a cuadros solo si no ensucia visualmente un popup pequeño.
- Mantén Space Mono para cabeceras y labels técnicas, no para bloques largos de texto.

## Estructura sugerida

```text
extension/
├── manifest.json
├── popup/
├── options/
├── content/
├── styles/
└── assets/
```

## CSS base mínimo

```css
:root {
  --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Space Mono', 'SF Mono', Monaco, monospace;
  --color-accent: #7ec832;
  --color-bg: #080c05;
  --color-bg-nav: #0d1209;
  --color-text: #d4e8b8;
  --color-border: rgba(85, 163, 0, 0.12);
}

html,
body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
}

h1,
h2 {
  font-family: var(--font-mono);
}
```

## Popup

- Ancho recomendado: 340px a 380px.
- Header con isotipo `scopweb3.png`.
- Footer con enlace a `https://scopweb.com`.

## Options page

- Usa cards, secciones y formularios con espaciado generoso.
- Aquí sí encaja mejor el fondo a cuadros en dark mode.

## Content script

- Evita invadir el estilo del sitio anfitrión.
- Namespaces recomendados: `.scopweb-*`.
- Usa z-index alto solo en tooltips o overlays necesarios.
