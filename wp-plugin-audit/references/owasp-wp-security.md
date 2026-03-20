# OWASP WP Security — Referencia para plugins

Vectores específicos de plugins WordPress. Basado en OWASP Top 10 adaptado a WP y WPScan Vulnerability DB.

---

## 1. Broken Access Control (A01)

El error más común en plugins. Operaciones que no verifican quién ejecuta la acción.

### Patrón incorrecto
```php
// Sin capability check — cualquiera puede ejecutarlo
add_action('wp_ajax_delete_item', 'my_plugin_delete_item');
function my_plugin_delete_item() {
    $id = $_POST['id'];
    wp_delete_post($id);
    wp_send_json_success();
}
```

### Patrón correcto
```php
add_action('wp_ajax_delete_item', 'my_plugin_delete_item');
// Notar: NO registrar wp_ajax_nopriv_ si requiere login
function my_plugin_delete_item() {
    // 1. Verificar nonce
    check_ajax_referer('my_plugin_delete_nonce', 'nonce');
    // 2. Verificar capability
    if (!current_user_can('delete_posts')) {
        wp_send_json_error('Forbidden', 403);
    }
    // 3. Sanitizar input
    $id = absint($_POST['id']);
    if (!$id) {
        wp_send_json_error('Invalid ID', 400);
    }
    wp_delete_post($id, true);
    wp_send_json_success();
}
```

### Capabilities más usadas

| Contexto | Capability |
|----------|-----------|
| Admin general | `manage_options` |
| Gestionar posts | `edit_posts`, `delete_posts` |
| Subir archivos | `upload_files` |
| Editar otros usuarios | `edit_users` |
| CPT custom | `edit_{post_type}s` |

---

## 2. Injection (A03) — SQL

### Regla absoluta: siempre `$wpdb->prepare()`

```php
// MAL — SQL injection directa
$results = $wpdb->get_results(
    "SELECT * FROM {$wpdb->posts} WHERE post_title = '" . $_GET['title'] . "'"
);

// BIEN
$title = sanitize_text_field(wp_unslash($_GET['title'] ?? ''));
$results = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT * FROM {$wpdb->posts} WHERE post_title = %s AND post_status = %s",
        $title,
        'publish'
    )
);
```

### Placeholders de prepare()

| Tipo | Placeholder |
|------|------------|
| String | `%s` |
| Integer | `%d` |
| Float | `%f` |
| Like (con wildcards) | `%` + `$wpdb->esc_like($val)` + `%` |

```php
// LIKE correcto
$like = '%' . $wpdb->esc_like($search_term) . '%';
$wpdb->prepare("SELECT * FROM {$wpdb->posts} WHERE post_title LIKE %s", $like);
```

---

## 3. XSS (A03) — Cross-Site Scripting

### Regla: sanitizar al entrar, escapar al salir

```php
// Al guardar (sanitizar)
$value = sanitize_text_field(wp_unslash($_POST['field'] ?? ''));
update_option('my_plugin_field', $value);

// Al mostrar (escapar) — SIEMPRE, aunque venga de la BD
echo esc_html(get_option('my_plugin_field'));
```

### Funciones de escape por contexto

| Contexto | Función |
|----------|---------|
| HTML text | `esc_html()` |
| Atributo HTML | `esc_attr()` |
| URL (href, src) | `esc_url()` |
| JavaScript inline | `esc_js()` |
| CSS inline | `esc_attr()` (no hay esc_css) |
| HTML complejo permitido | `wp_kses($val, $allowed_tags)` |
| Traducciones | `esc_html__()`, `esc_attr__()` |

```php
// Traducción escapada (un solo paso)
echo esc_html__('Save settings', 'my-plugin');

// URL en atributo
echo '<a href="' . esc_url(get_permalink($post_id)) . '">';

// wp_kses para HTML con etiquetas permitidas
$allowed = ['a' => ['href' => [], 'title' => []], 'strong' => [], 'em' => []];
echo wp_kses($user_content, $allowed);
```

---

## 4. CSRF — Cross-Site Request Forgery

WordPress usa nonces (no son nonces criptográficos puros, sino tokens con TTL de 24h).

### Formularios HTML
```php
// Al generar el form
wp_nonce_field('my_plugin_save_settings', 'my_plugin_nonce');

// Al procesar (en el handler)
if (!isset($_POST['my_plugin_nonce']) ||
    !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['my_plugin_nonce'])), 'my_plugin_save_settings')) {
    wp_die('Security check failed');
}
```

### AJAX
```php
// En el JS (localize_script)
wp_localize_script('my-plugin', 'myPlugin', [
    'nonce' => wp_create_nonce('my_plugin_ajax')
]);

// En el handler PHP
check_ajax_referer('my_plugin_ajax', 'nonce');
```

### Acciones admin (GET links)
```php
// Generar URL con nonce
$url = wp_nonce_url(
    admin_url('admin.php?action=my_plugin_action&id=' . $post_id),
    'my_plugin_action_' . $post_id
);

// Verificar
check_admin_referer('my_plugin_action_' . $post_id);
```

---

## 5. Protección de archivos PHP directos

Todo archivo PHP del plugin que no sea el main file debe bloquearse si se accede directamente:

```php
<?php
// Al inicio de cada archivo PHP (excepto el main plugin file)
if (!defined('ABSPATH')) {
    exit;
}
```

---

## 6. Subida de archivos

```php
function my_plugin_handle_upload() {
    check_ajax_referer('my_plugin_upload', 'nonce');

    if (!current_user_can('upload_files')) {
        wp_send_json_error('Forbidden', 403);
    }

    $file = $_FILES['my_file'] ?? null;
    if (!$file) {
        wp_send_json_error('No file');
    }

    // Validar tipo MIME real (no solo extensión)
    $allowed_types = ['image/jpeg', 'image/png', 'image/gif'];
    $file_type = wp_check_filetype_and_ext($file['tmp_name'], $file['name']);

    if (!in_array($file_type['type'], $allowed_types, true)) {
        wp_send_json_error('Tipo de archivo no permitido');
    }

    // Usar wp_handle_upload (gestiona moverlo, sanitiza nombre)
    $upload = wp_handle_upload($file, ['test_form' => false]);

    if (isset($upload['error'])) {
        wp_send_json_error($upload['error']);
    }

    wp_send_json_success(['url' => $upload['url']]);
}
```

---

## 7. REST API endpoints

```php
register_rest_route('my-plugin/v1', '/items/(?P<id>\d+)', [
    'methods'             => WP_REST_Server::READABLE,
    'callback'            => 'my_plugin_get_item',
    // NUNCA: 'permission_callback' => '__return_true' para datos privados
    'permission_callback' => function () {
        return current_user_can('edit_posts');
    },
    'args' => [
        'id' => [
            'validate_callback' => function ($param) {
                return is_numeric($param) && $param > 0;
            },
            'sanitize_callback' => 'absint',
        ],
    ],
]);
```

---

## 8. Opciones y datos sensibles

```php
// Registrar opción con sanitización
register_setting('my_plugin_options', 'my_plugin_api_key', [
    'type'              => 'string',
    'sanitize_callback' => 'sanitize_text_field',
    'default'           => '',
]);

// API keys: no mostrar en texto plano en el admin
// Usar input type="password" o mostrar solo últimos 4 chars
$api_key = get_option('my_plugin_api_key');
$masked = str_repeat('*', max(0, strlen($api_key) - 4)) . substr($api_key, -4);
echo '<input type="password" value="' . esc_attr($api_key) . '" name="my_plugin_api_key">';
```
