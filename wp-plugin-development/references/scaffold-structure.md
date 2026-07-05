# Scaffold — Estructura Base de Plugin WordPress

Estructura de archivos y main file para cualquier tipo de plugin.

---

## Cuándo usar este scaffold (sin Composer)

Usar esta estructura **sin Composer** cuando:
- Plugin simple (< 5 archivos PHP)
- Sin dependencias de librerías externas
- Testing básico o sin tests
- Solo para uso interno/cliente

Usar estructura **con Composer/PSR-4** cuando:
- Plugin complejo con múltiples clases
- API externa con dependencias (Guzzle, etc.)
- Testing serio (PHPUnit + WP_Mock)
- PHPCS + PHPStan en CI
- Varios desarrolladores

Ver: [php-modern-patterns.md](../wp-plugin-audit/references/php-modern-patterns.md) en wp-plugin-audit para la estructura con Composer.

---

## Estructura de directorios (sin Composer)

```
plugin-slug/
├── plugin-slug.php              ← Main file (header + bootstrap)
├── uninstall.php                ← Cleanup al desinstalar
├── includes/
│   ├── class-plugin-slug.php       ← Clase principal (singleton)
│   ├── class-ps-activator.php      ← Lógica de activación
│   ├── class-ps-deactivator.php    ← Lógica de desactivación
│   └── class-ps-database.php       ← Helper DB (si hay tablas custom)
├── admin/
│   ├── class-ps-admin.php          ← Admin pages y settings
│   └── partials/
│       └── admin-display.php       ← HTML del admin panel
├── public/
│   ├── class-ps-public.php         ← Hooks frontend (shortcodes, etc.)
│   └── partials/
├── assets/
│   ├── css/
│   │   ├── admin.css
│   │   └── public.css
│   └── js/
│       ├── admin.js
│       └── public.js
├── commands/                        ← WP_CLI commands (si aplica)
│   └── class-ps-import-command.php
└── languages/
    └── plugin-slug.pot
```

Adaptar según tipo: omitir `admin/` si no hay panel, omitir `public/` si es solo backend.

---

## Main file (plugin-slug.php)

```php
<?php
/**
 * Plugin Name:       Mi Plugin Cliente
 * Plugin URI:        https://example.com/mi-plugin
 * Description:       Descripción breve del plugin.
 * Version:           1.0.0
 * Author:            Nombre Autor
 * Author URI:        https://example.com
 * License:           GPL-2.0+
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       mi-plugin-cliente
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Constantes
define( 'MPC_VERSION',  '1.0.0' );
define( 'MPC_PATH',     plugin_dir_path( __FILE__ ) );
define( 'MPC_URL',      plugin_dir_url( __FILE__ ) );
define( 'MPC_BASENAME', plugin_basename( __FILE__ ) );

// Carga de clases
require_once MPC_PATH . 'includes/class-mpc-activator.php';
require_once MPC_PATH . 'includes/class-mpc-deactivator.php';
require_once MPC_PATH . 'includes/class-mpc-plugin.php';

// Hooks de activación/desactivación
register_activation_hook( __FILE__, array( 'MPC_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'MPC_Deactivator', 'deactivate' ) );

// Bootstrap
function mpc_run() {
    $plugin = MPC_Plugin::get_instance();
    $plugin->run();
}
add_action( 'plugins_loaded', 'mpc_run' );
```

---

## Clase principal (class-mpc-plugin.php)

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class MPC_Plugin {

    private static $instance = null;
    private $hooks = array();

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    public function run() {
        $this->load_dependencies();
        $this->set_locale();
        $this->define_admin_hooks();
        $this->define_public_hooks();
    }

    private function load_dependencies() {
        // Incluir aquí las clases adicionales según tipo de plugin
        // require_once MPC_PATH . 'includes/class-mpc-cpt.php';
        // require_once MPC_PATH . 'admin/class-mpc-admin.php';
    }

    private function set_locale() {
        add_action( 'init', function() {
            load_plugin_textdomain(
                'mi-plugin-cliente',
                false,
                dirname( MPC_BASENAME ) . '/languages/'
            );
        });
    }

    private function define_admin_hooks() {
        // Registrar hooks de admin aquí
        // $admin = new MPC_Admin();
        // add_action( 'admin_menu', array( $admin, 'add_menu' ) );
        // add_action( 'admin_enqueue_scripts', array( $admin, 'enqueue_scripts' ) );
    }

    private function define_public_hooks() {
        // Registrar hooks de frontend aquí
        // add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
    }

    public function enqueue_scripts() {
        wp_enqueue_style(
            'mpc-public',
            MPC_URL . 'assets/css/public.css',
            array(),
            MPC_VERSION
        );
        wp_enqueue_script(
            'mpc-public',
            MPC_URL . 'assets/js/public.js',
            array( 'jquery' ),
            MPC_VERSION,
            true
        );
    }
}
```

---

## Activador / Desactivador

```php
<?php
// class-mpc-activator.php
if ( ! defined( 'ABSPATH' ) ) exit;

class MPC_Activator {
    public static function activate() {
        // Crear tablas personalizadas si se necesitan
        // self::create_tables();

        // Flush rewrite rules para CPTs
        flush_rewrite_rules();

        // Guardar versión instalada
        update_option( 'mpc_version', MPC_VERSION );
    }
}
```

```php
<?php
// class-mpc-deactivator.php
if ( ! defined( 'ABSPATH' ) ) exit;

class MPC_Deactivator {
    public static function deactivate() {
        flush_rewrite_rules();
    }
}
```

---

## Notas

- El prefijo `mpc_` / `MPC_` es un ejemplo — usar el prefijo del plugin real.
- `flush_rewrite_rules()` solo en activación/desactivación, **nunca** en `init` normal.
- Omitir carpetas/clases que no se usen (no generar código vacío innecesario).

---

## uninstall.php — Cleanup al desinstalar

El archivo `uninstall.php` se ejecuta automáticamente cuando el usuario elimina el plugin desde el admin de WP. Debe limpiar todas las opciones, tablas y meta fields.

```php
<?php
/**
 * uninstall.php — Cleanup del plugin
 *
 * Se ejecuta automáticamente al desinstalar el plugin.
 * NO requiere ABSPATH check (WP lo provee).
 */

// Si se desactiva (no elimina), no ejecutar cleanup
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Opciones
delete_option('mpc_options');
delete_option('mpc_version');
delete_option('mpc_db_version');

// Transients
delete_transient('mpc_access_token');
delete_transient('mpc_productos_cache');

// Post meta
global $wpdb;
$wpdb->delete($wpdb->postmeta, ['meta_key' => '_mpc_precio']);
$wpdb->delete($wpdb->postmeta, ['meta_key' => '_mpc_sku']);

// Tablas custom
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}mpc_productos");
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}mpc_pedidos");

// Posts del CPT (si se quieren eliminar con el plugin)
$posts = get_posts([
    'post_type'      => 'mpc_producto',
    'post_status'    => 'any',
    'posts_per_page' => -1,
    'fields'         => 'ids',
]);

foreach ($posts as $post_id) {
    wp_delete_post($post_id, true);
}

// Roles y capabilities (si se añadieron)
remove_role('mpc_vendedor');
remove_cap('manage_mpc_options');

// Clear any cached data
wp_cache_flush();
```

### Checklist antes de uninstall

```
□ Todas las options del plugin eliminadas
□ Transients eliminados
□ Post meta fields limpiados (_mpc_* etc.)
□ Tablas custom eliminadas con DROP TABLE
□ CPT posts eliminados o reasignados
□ Roles/capabilities removidos
□ wp_cache_flush() llamado
□ NO incluir ABSPATH check (WP lo provee)
```
