# Vanilla JS Reference

Adaptación del estilo scopweb para proyectos HTML, CSS y JavaScript sin framework.

## Cuándo usarlo

- Dashboards internos
- Tools web
- Micrositios
- Apps pequeñas o medianas sin framework

## Estructura sugerida

```text
project/
├── index.html
├── assets/
├── css/
├── js/
└── pages/
```

## Capas CSS recomendadas

- `variables.css`
- `reset.css`
- `components.css`
- `layout.css`
- `utilities.css`

## Reglas prácticas

- El design system debe vivir en variables CSS.
- El toggle dark/light debe usar `data-theme`.
- El fondo a cuadros funciona bien en dashboards, home internas y layouts editoriales.
- En herramientas densas o formularios complejos, úsalo con opacidad baja.

## HTML base mínimo

```html
<html lang="es" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/components.css">
</head>
<body>
  <header>
    <img src="assets/scopweb3.png" alt="scopweb">
    <h1>scopweb</h1>
  </header>
</body>
</html>
```

## Componentes prioritarios

- Botones primarios y secundarios
- Cards
- Inputs y selects
- Badges
- Alertas
- Tabs
- Modales

## JavaScript recomendado

- `theme-switcher.js` para persistir el tema
- `main.js` para la lógica principal
- `components.js` solo si hay comportamiento compartido
