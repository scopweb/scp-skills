# Bloques de Seguridad — WordPress Theme Audit

## Bloque 1 — Output Escaping (XSS)

El vector más frecuente en temas. Busca **todo `echo` sin función de escape**.

### Reglas por contexto

| Contexto | Función correcta | Incorrecto |
|----------|-----------------|------------|
| HTML element | `esc_html()` | `echo $var` directo |
| Atributo HTML | `esc_attr()` | `sanitize_text_field()` solo |
| URL (`href`, `src`) | `esc_url()` | `esc_attr()` en URLs |
| JavaScript inline | `esc_js()` | `esc_html()` en JS |
| HTML complejo permitido | `wp_kses()` / `wp_kses_post()` | `strip_tags()` |
| Traducción + echo | `esc_html_e()` / `esc_html__()` | `_e()` sin escape |

### Patrones vulnerables

```php
// ❌ XSS
echo $atts['class'];
echo get_theme_mod('header_text');
echo $_GET['tab'];
echo get_post_meta($id, 'custom_field', true);

// ✅ Correcto
echo esc_attr( $atts['class'] );
echo esc_html( get_theme_mod('header_text') );
echo esc_attr( sanitize_key( $_GET['tab'] ) );
echo esc_html( get_post_meta($id, 'custom_field', true) );
```

> ⚠️ **Falso positivo frecuente**: `sanitize_text_field()` NO previene XSS al hacer echo —
> solo sanitiza para guardar. Siempre necesitas escape en el output aunque hayas sanitizado al guardar.

---

## Bloque 2 — Input Sanitization

Revisar **todo punto donde el tema lee datos externos** antes de guardar/procesar.

### Funciones por tipo de dato

| Tipo | Función |
|------|---------|
| Texto plano | `sanitize_text_field()` |
| Textarea | `sanitize_textarea_field()` |
| Email | `sanitize_email()` |
| URL | `esc_url_raw()` |
| Integer | `absint()` / `intval()` |
| HTML permitido | `wp_kses_post()` |
| Clave/slug | `sanitize_key()` |
| Nombre de archivo | `sanitize_file_name()` |
| CSS class | `sanitize_html_class()` |
| Color hex | `sanitize_hex_color()` |

### Puntos críticos en temas

```php
// Customizer — sanitize_callback obligatorio
$wp_customize->add_setting('my_color', [
    'sanitize_callback' => 'sanitize_hex_color', // ✅
]);

// Theme mods al guardar
update_theme_mod('key', sanitize_text_field($_POST['val'])); // ✅

// Shortcode atts en Divi child
$atts = shortcode_atts(['color' => 'blue'], $atts);
$color = sanitize_html_class($atts['color']); // ✅
```

---

## Bloque 3 — CSRF y Nonces

Obligatorio cuando el tema tiene formularios o AJAX handlers.

### Cuándo es obligatorio

- Formulario HTML que procesa acciones
- AJAX handlers registrados en `functions.php` del child
- Customizer con campos que guardan datos sensibles

### Patrón correcto

```php
// Generar nonce en el formulario
wp_nonce_field('theme_action_name', 'theme_nonce');

// Verificar en el handler
if ( ! isset($_POST['theme_nonce']) ||
     ! wp_verify_nonce($_POST['theme_nonce'], 'theme_action_name') ) {
    wp_die('Security check failed');
}

// AJAX en functions.php del child
add_action('wp_ajax_mi_accion', 'miproyecto_ajax_handler');
add_action('wp_ajax_nopriv_mi_accion', 'miproyecto_ajax_handler');

function miproyecto_ajax_handler() {
    check_ajax_referer('mi_nonce_action', 'nonce'); // ✅ obligatorio
    wp_send_json_success($data);
}
```

---

## Bloque 4 — Enqueue de Scripts y Estilos

```php
// ❌ Hardcodeado en template override
<script src="<?php echo get_stylesheet_directory_uri(); ?>/js/main.js"></script>

// ✅ Correcto en functions.php del child
function miproyecto_enqueue_scripts() {
    wp_enqueue_script(
        'miproyecto-main',
        get_stylesheet_directory_uri() . '/js/main.js',
        ['jquery'],                              // Divi ya incluye jQuery
        wp_get_theme()->get('Version'),
        ['in_footer' => true, 'strategy' => 'defer'] // WP 6.3+
    );
}
add_action( 'wp_enqueue_scripts', 'miproyecto_enqueue_scripts' );
```

---

## Bloque 5 — Permisos y Acceso

```php
// ✅ Con capability check
if ( current_user_can('edit_theme_options') ) {
    // acciones administrativas del child
}

// ❌ LFI — incluir con input del usuario sin validar
include( get_stylesheet_directory() . '/' . $_GET['page'] . '.php' );

// ✅ Whitelist
$allowed = ['about', 'contact'];
$page = in_array($_GET['page'], $allowed, true) ? $_GET['page'] : 'home';
include( get_stylesheet_directory() . '/' . sanitize_key($page) . '.php' );
```
