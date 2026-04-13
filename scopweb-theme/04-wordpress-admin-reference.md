# WordPress Admin Reference

Adaptación del estilo scopweb para paneles de administración y plugins de WordPress.

## Cuándo usarlo

- Plugins con páginas propias en `wp-admin`
- Dashboards internos
- Paneles de configuración personalizados
- Widgets y metaboxes con branding propio

## Criterios de integración

- No rompas la usabilidad nativa de WordPress.
- Aplica branding con moderación en tablas, forms y notices.
- Usa el fondo a cuadros solo en páginas propias del plugin, no en todo `wp-admin` salvo que sea un producto cerrado.

## Estructura sugerida

```text
plugin/
├── plugin.php
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
├── templates/
└── includes/
```

## Recomendaciones técnicas

- Carga Google Fonts al entrar en páginas del plugin.
- Usa clases prefijadas con `scopweb-`.
- Separa variables, colores, componentes y overrides.
- Encola assets solo en las pantallas del plugin.

## Base visual

```css
body.scopweb-admin-page {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #080c05;
  color: #d4e8b8;
}

body.scopweb-admin-page .wrap h1 {
  font-family: 'Space Mono', monospace;
  color: #7ec832;
}
```

## Componentes prioritarios

- Botones administrativos
- Cards de dashboard
- Formularios de settings
- Notices y alerts
- Tablas con overrides suaves

## Branding

- Usa `scopweb3.png` en iconos de menú si la legibilidad lo permite.
- Usa `scopweb.jpg` en cabeceras o pantallas de presentación.
