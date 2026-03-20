# Divi Child Theme — Auditoría Específica

> Ejecutar **antes** de los bloques generales cuando el tema padre es Divi.

## Estructura esperada

```
divi-child/
├── style.css          (con Template: Divi en la cabecera)
├── functions.php      (enqueue del padre + customizaciones)
└── [opcionales]
    ├── header.php     (override de template Divi)
    ├── footer.php
    └── custom-*.php   (módulos o funciones extra)
```

---

## D1 — Cabecera de style.css

```css
/* ✅ Mínimo obligatorio */
/*
Theme Name:  Mi Divi Child
Template:    Divi
Version:     1.0.0
*/

/* ❌ Template mal escrito = child theme no funciona */
/* Template: divi   ← minúscula — ROTO */
/* Template: Divi/  ← trailing slash — ROTO */
```

---

## D2 — Enqueue del padre en functions.php

Divi usa el handle `divi-style`. El child theme debe cargarlo correctamente:

```php
// ✅ Patrón recomendado para Divi child theme
function divi_child_enqueue_styles() {
    $parent_style = 'divi-style';
    $theme        = wp_get_theme();

    wp_enqueue_style(
        $parent_style,
        get_template_directory_uri() . '/style.css',
        [],
        $theme->parent()->get('Version') // versión real del padre
    );
    wp_enqueue_style(
        'child-style',
        get_stylesheet_uri(),
        [ $parent_style ],
        $theme->get('Version')
    );
}
add_action( 'wp_enqueue_scripts', 'divi_child_enqueue_styles' );

// ❌ Problemas frecuentes:
// 1. Usar get_template_directory_uri() para el child → apunta al PADRE
// 2. Sin versioning → cache stale en producción
// 3. Dequeue de 'divi-style' sin re-enqueue → estilos Divi desaparecen
// 4. Hook incorrecto: wp_head en lugar de wp_enqueue_scripts
```

---

## D3 — Hooks y filtros seguros de Divi

```php
// ✅ Usar hooks ET documentados, nunca modificar archivos del padre
add_action( 'et_builder_ready', 'mi_modulo_custom' );
add_filter( 'et_pb_module_shortcode_attributes', 'fn' );
add_action( 'et_after_main_content', 'mi_contenido' );

// ❌ NUNCA modificar archivos del padre directamente
// /wp-content/themes/Divi/includes/builder/functions.php ← se borrará en update

// ✅ Override de templates: copiar al child con misma ruta relativa
// /wp-content/themes/divi-child/header.php  (override de Divi/header.php)
```

---

## D4 — Funciones prefijadas (evitar colisiones con Divi)

Divi define cientos de funciones `et_*`. El child debe usar prefijo propio:

```php
// ❌ Colisión potencial con funciones internas de Divi
function get_custom_sidebar() { ... }
function setup_theme() { ... }

// ✅ Prefijo único del proyecto
function miproyecto_get_custom_sidebar() { ... }
function miproyecto_setup_theme() { ... }

// ✅ Protección contra re-declaración
if ( ! function_exists( 'miproyecto_setup_theme' ) ) {
    function miproyecto_setup_theme() { ... }
}
```

---

## D5 — Rutas: get_stylesheet_directory() vs get_template_directory()

Error muy frecuente en Divi child themes:

```php
// get_template_directory()    → /wp-content/themes/Divi/       (PADRE)
// get_stylesheet_directory()  → /wp-content/themes/divi-child/  (CHILD)

// ❌ Busca archivos en el PADRE cuando quieres el CHILD
include( get_template_directory() . '/mi-archivo.php' );

// ✅ Busca en el CHILD
include( get_stylesheet_directory() . '/mi-archivo.php' );

// ✅ get_theme_file_path() busca primero en child, luego en padre
require_once get_theme_file_path( 'inc/helpers.php' );
```

---

## D6 — CVEs de Divi a verificar en el child

Si el child hace override de funcionalidades del padre, verificar:

| Vulnerabilidad | Versión afectada | Revisar en child si... |
|---|---|---|
| Arbitrary file upload | Divi ≤ 4.5.2 | El child añade upload de archivos |
| DOM XSS stored | Divi ≤ 4.25.0 | El child renderiza atributos de módulos sin escape |
| Code injection (contributor+) | Divi 3.23–4.0.9 | El child tiene roles contribuidor activos |
| CSRF en AJAX ET | Divi antiguo | El child añade AJAX handlers propios |

> El child no controla la versión del padre — recordar al usuario que Divi debe estar actualizado.

---

## D7 — Checklist Divi child

- [ ] `Template: Divi` en `style.css` (mayúscula exacta, sin slash)
- [ ] Enqueue usa handle `divi-style` para el padre
- [ ] `get_stylesheet_directory()` para rutas del child
- [ ] `get_template_directory()` para rutas del padre
- [ ] Funciones con prefijo propio, nunca `et_` ni nombres genéricos
- [ ] Overrides de templates: mismo nombre y ruta relativa que en Divi padre
- [ ] Módulos custom via `et_builder_ready`, nunca editando `/Divi/includes/`
- [ ] Divi padre actualizado (el child no hereda correcciones si el padre está desactualizado)
- [ ] Sin `require_once` de archivos del padre que podrían cambiar en updates
