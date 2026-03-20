# MDX Page Templates — WordPress Plugin Docs

Templates para cada sección de documentación. Solo crear las páginas para features que el plugin realmente tiene.

---

## 1. Overview (`index.mdx`)

Página hero con splash template.

```mdx
---
title: Plugin Name
description: Descripción corta del plugin.
template: splash
hero:
  title: Plugin Name
  tagline: Qué hace en una frase clara.
  actions:
    - text: Instalar
      link: /installation/
      icon: right-arrow
    - text: GitHub
      link: https://github.com/org/plugin
      variant: minimal
      icon: external
---

import { Card, CardGrid } from '@astrojs/starlight/components';

<CardGrid>
  <Card title="Característica 1" icon="pencil">Descripción breve.</Card>
  <Card title="Característica 2" icon="setting">Descripción breve.</Card>
</CardGrid>

## Requisitos

| Requisito | Versión Mínima |
|-----------|----------------|
| WordPress | 5.0+ |
| PHP       | 7.0+ |
| ACF       | Requerido (si aplica) |
```

---

## 2. Instalación (`installation.mdx`)

```mdx
---
title: Instalación
description: Guía de instalación paso a paso.
---

import { Steps, Tabs, TabItem } from '@astrojs/starlight/components';

<Steps>

1. **Subir el plugin**

   <Tabs>
     <TabItem label="Manual">Sube la carpeta `plugin-name/` a `/wp-content/plugins/`</TabItem>
     <TabItem label="ZIP">Ve a **Plugins > Añadir nuevo > Subir plugin** y selecciona el ZIP</TabItem>
   </Tabs>

2. **Activar el plugin**

   Ve a **Plugins** en el panel de WordPress y activa **Plugin Name**

3. **Instalar dependencias** (si aplica)

   :::caution[Dependencia requerida]
   Este plugin necesita **Advanced Custom Fields (ACF)** activo.
   :::

4. **Verificar**

   :::tip[Comprobación rápida]
   Ve a [URL o sección de admin] para confirmar que funciona.
   :::

</Steps>
```

---

## 3. Campos ACF (`configuration/acf-fields.mdx`)

Solo si el plugin usa ACF.

```mdx
---
title: Campos ACF
description: Configuración de campos Advanced Custom Fields.
---

## Campos en Opciones

### Repeater: `nombre_repeater`

| Sub-campo | Tipo | Descripción |
|-----------|------|-------------|
| `campo_1` | `number` | Descripción |
| `campo_2` | `text` | Descripción |

```php
$items = get_field('nombre_repeater', 'option');
foreach ($items as $item) {
    echo $item['campo_1'];
}
```

## Campos en Posts

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `campo_post_1` | `select` | Selección |
| `campo_post_2` | `true_false` | Toggle |
```

---

## 4. Templates (`usage/templates.mdx`)

```mdx
---
title: Templates
description: Templates de página incluidos en el plugin.
---

## Templates Disponibles

| Template | Nombre en Admin | Descripción |
|----------|-----------------|-------------|
| `template-one.php` | Nombre Visible 1 | Qué muestra |

## Cómo Asignar

1. Edita una **Página** en WordPress
2. Panel lateral → **Atributos de página > Plantilla**
3. Selecciona el template → Publica

:::tip
Tras asignar templates por primera vez, regenera URLs en **Ajustes > Enlaces permanentes**.
:::
```

---

## 5. Shortcodes (`usage/shortcodes.mdx`)

```mdx
---
title: Shortcodes
description: Shortcodes disponibles para usar en páginas y posts.
---

### `[shortcode_name]`

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `param1`  | `int` | `10` | Descripción |

```html
[shortcode_name param1="5"]
```

:::note
Puede usarse en páginas, posts y widgets de texto.
:::
```

---

## 6. Custom Post Types (`usage/custom-post-types.mdx`)

```mdx
---
title: Custom Post Types
---

## CPT: `nombre_cpt`

| Propiedad | Valor |
|-----------|-------|
| **Slug** | `nombre-cpt` |
| **Supports** | title, editor, thumbnail |

| Campo ACF | Descripción |
|-----------|-------------|
| `campo_1` | Descripción |
```

---

## 7. Hooks (`developers/hooks.mdx`)

```mdx
---
title: Hooks (Actions & Filters)
description: Puntos de extensión para desarrolladores.
---

## Actions

### `plugin_name_before_render`

```php
add_action('plugin_name_before_render', function($args) {
    // Tu código
}, 10, 1);
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `$args` | `array` | Argumentos del render |

## Filters

### `plugin_name_query_args`

```php
add_filter('plugin_name_query_args', function($args) {
    $args['posts_per_page'] = 20;
    return $args;
});
```

---

## 8. Funciones Públicas (`developers/functions.mdx`)

```mdx
---
title: Funciones
---

### `plugin_function_name( $param )`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `$param` | `int` | Descripción |

**Retorna:** `string`

```php
$result = plugin_function_name(1);
echo $result; // → "valor esperado"
```

:::caution
Disponible solo después del hook `init`.
:::
```

---

## 9. Arquitectura (`developers/architecture.mdx`)

```mdx
---
title: Arquitectura
---

## Estructura de Archivos

```
plugin-name/
├── plugin-name.php
├── admin/
├── includes/
│   ├── class-*.php
│   └── modules/
├── templates/
└── assets/
```

## Orden de Inicialización

| Prioridad | Hook | Componente |
|-----------|------|------------|
| 10 | `init` | CPT Registration |
| 11 | `init` | Template Manager |
```

---

## 10. Changelog (`changelog.mdx`)

```mdx
---
title: Changelog
---

## [2.1.0] - 2026-01-17

### Añadido
- Feature nueva

### Corregido
- Bug fix
```
