# scopweb Design System Reference

Referencia visual común para todos los proyectos scopweb.

## Tipografía

- Texto, UI, formularios y navegación: `DM Sans`.
- Títulos principales y secundarios: `Space Mono`.
- Código inline y bloques técnicos: `Space Mono`.
- Pesos recomendados:
  - Body: 300 o 400
  - H1: 700
  - H2: 400
  - H3-H6: 600

## Import de fuentes

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```

## Paleta scopweb

### Dark

- Accent: `#7ec832`
- Accent high: `#d4e8b8`
- Accent low: `#0f1e08`
- Background: `#080c05`
- Surface/nav: `#0d1209`
- Surface hover: `#111a0a`
- Text: `#d4e8b8`
- Muted text: `#7a9960`

### Light

- Accent: `#3d7100`
- Accent high: `#1a3500`
- Accent low: `#e2f0c8`
- Background: `#f9fdf4`
- Surface/nav: `#f0f8e8`
- Surface hover: `#e8f5d0`
- Text: `#1a2f10`
- Muted text: `#557a20`

## Variables base

```css
:root {
  --font-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;

  --color-accent: #7ec832;
  --color-accent-high: #d4e8b8;
  --color-accent-low: #0f1e08;
  --color-bg: #080c05;
  --color-bg-nav: #0d1209;
  --color-bg-hover: #111a0a;
  --color-text: #d4e8b8;
  --color-text-muted: #7a9960;
  --color-hairline: rgba(85, 163, 0, 0.12);
  --color-hairline-light: rgba(85, 163, 0, 0.20);
}
```

## Fondo a cuadros

Aplicar preferentemente en dark mode y en superficies editoriales o dashboards donde aporte identidad sin molestar la lectura.

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(85, 163, 0, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(85, 163, 0, 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
  z-index: 0;
}

body::after {
  content: '';
  position: fixed;
  top: -200px;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 500px;
  background: radial-gradient(ellipse, rgba(61, 113, 0, 0.18) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
```

## Componentes base

### Botón primario

```css
.btn-primary {
  background: var(--color-accent);
  color: var(--color-bg);
  border: 1px solid var(--color-accent);
  border-radius: 0.375rem;
  padding: 0.75rem 1.5rem;
}
```

### Botón secundario

```css
.btn-secondary {
  background: transparent;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 0.375rem;
  padding: 0.75rem 1.5rem;
}
```

### Card

```css
.card {
  background: var(--color-bg-nav);
  border: 1px solid var(--color-hairline);
  border-radius: 0.5rem;
  padding: 1.5rem;
}
```

### Input

```css
input,
textarea,
select {
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-hairline);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
}
```

## Branding

- Logo principal: `scopweb.jpg`
- Logo alternativo o isotipo: `scopweb3.png`
- Espaciado mínimo alrededor del logo: 16px
