# PHP Moderno en Plugins WordPress

Patrones PHP 8.x con namespaces, PSR-4 y Composer para plugins privados/cliente.
Compatible con WordPress 6.4+ (PHP 8.1+ mínimo, 8.2+ recomendado para 2026).

---

## 1. Estructura de directorios moderna

```
my-plugin/
├── my-plugin.php           # Main plugin file (header WP aquí)
├── composer.json
├── composer.lock
├── uninstall.php
├── src/
│   ├── Plugin.php          # Clase principal, registra hooks
│   ├── Admin/
│   │   ├── SettingsPage.php
│   │   └── MetaBox.php
│   ├── Frontend/
│   │   └── Shortcodes.php
│   ├── PostTypes/
│   │   ├── ProductCPT.php
│   │   └── CategoryTaxonomy.php
│   └── Api/
│       └── RestController.php
├── tests/
│   ├── bootstrap.php
│   ├── Unit/
│   └── Integration/
├── assets/
│   ├── js/
│   └── css/
└── vendor/                 # Composer, no commitear si es grande
```

---

## 2. composer.json

```json
{
    "name": "client/plugin-name",
    "description": "Plugin privado para ClientName",
    "type": "wordpress-plugin",
    "require": {
        "php": ">=8.2"
    },
    "require-dev": {
        "phpunit/phpunit": "^10.5",
        "10up/wp_mock": "^1.0",
        "squizlabs/php_codesniffer": "^3.8",
        "wp-coding-standards/wpcs": "^3.1",
        "dealerdirect/phpcodesniffer-composer-installer": "^1.0",
        "phpstan/phpstan": "^1.10",
        "phpstan/extension-installer": "^1.3"
    },
    "autoload": {
        "psr-4": {
            "MyPlugin\\": "src/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "MyPlugin\\Tests\\": "tests/"
        }
    },
    "scripts": {
        "test": "phpunit",
        "lint": "phpcs",
        "lint-fix": "phpcbf",
        "phpstan": "phpstan analyse"
    }
}
```

---

## 3. Main plugin file

```php
<?php
/**
 * Plugin Name: My Plugin
 * Plugin URI:  https://example.com
 * Description: Descripción del plugin.
 * Version:     1.0.0
 * Author:      Author Name
 * License:     Proprietary
 * Text Domain: my-plugin
 * Domain Path: /languages
 * Requires at least: 6.4
 * Requires PHP: 8.2
 */

if (!defined('ABSPATH')) {
    exit;
}

// Autoloader — Composer o fallback manual
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
} else {
    // Fallback PSR-4 manual (si no se usa Composer en producción)
    spl_autoload_register(function (string $class): void {
        $prefix = 'MyPlugin\\';
        $base_dir = __DIR__ . '/src/';

        if (!str_starts_with($class, $prefix)) {
            return;
        }

        $relative = substr($class, strlen($prefix));
        $file = $base_dir . str_replace('\\', '/', $relative) . '.php';

        if (file_exists($file)) {
            require $file;
        }
    });
}

// Constantes del plugin
define('MY_PLUGIN_VERSION', '1.0.0');
define('MY_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('MY_PLUGIN_URL', plugin_dir_url(__FILE__));

// Arrancar el plugin en el hook correcto, no en tiempo de carga
add_action('plugins_loaded', function (): void {
    \MyPlugin\Plugin::instance()->init();
});

// Hooks de ciclo de vida (deben estar en el main file)
register_activation_hook(__FILE__, [\MyPlugin\Plugin::class, 'activate']);
register_deactivation_hook(__FILE__, [\MyPlugin\Plugin::class, 'deactivate']);
```

---

## 4. Clase principal Plugin.php

```php
<?php
declare(strict_types=1);

namespace MyPlugin;

if (!defined('ABSPATH')) {
    exit;
}

final class Plugin {
    private static ?self $instance = null;

    // Singleton — un único punto de entrada
    public static function instance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    public function init(): void {
        $this->load_textdomain();
        $this->register_hooks();
    }

    private function load_textdomain(): void {
        load_plugin_textdomain(
            'my-plugin',
            false,
            dirname(plugin_basename(MY_PLUGIN_DIR . 'my-plugin.php')) . '/languages'
        );
    }

    private function register_hooks(): void {
        // CPTs
        (new PostTypes\ProductCPT())->register();

        // Admin
        if (is_admin()) {
            (new Admin\SettingsPage())->register();
        }

        // REST API
        add_action('rest_api_init', [new Api\RestController(), 'register_routes']);
    }

    public static function activate(): void {
        // Crear tablas, opciones defaults
        self::instance()->maybe_create_tables();
        // Flush rewrite rules DESPUÉS de registrar CPTs
        flush_rewrite_rules();
    }

    public static function deactivate(): void {
        flush_rewrite_rules();
    }

    private function maybe_create_tables(): void {
        $version = get_option('my_plugin_db_version', '0');
        if (version_compare($version, MY_PLUGIN_VERSION, '<')) {
            // Migraciones aquí
            update_option('my_plugin_db_version', MY_PLUGIN_VERSION);
        }
    }
}
```

---

## 5. CPT con PHP moderno

```php
<?php
declare(strict_types=1);

namespace MyPlugin\PostTypes;

if (!defined('ABSPATH')) {
    exit;
}

final class ProductCPT {
    public const POST_TYPE = 'my_product';

    public function register(): void {
        add_action('init', [$this, 'register_post_type']);
        add_action('init', [$this, 'register_taxonomy']);
        add_action('save_post_' . self::POST_TYPE, [$this, 'save_meta'], 10, 2);
        add_action('add_meta_boxes_' . self::POST_TYPE, [$this, 'add_meta_boxes']);
    }

    public function register_post_type(): void {
        register_post_type(self::POST_TYPE, [
            'labels'        => $this->get_labels(),
            'public'        => true,
            'show_in_rest'  => true,
            'supports'      => ['title', 'editor', 'thumbnail', 'custom-fields'],
            'menu_icon'     => 'dashicons-products',
            'has_archive'   => true,
            'rewrite'       => ['slug' => 'products', 'with_front' => false],
            // No capability_type custom salvo que sea necesario
        ]);
    }

    private function get_labels(): array {
        return [
            'name'               => __('Products', 'my-plugin'),
            'singular_name'      => __('Product', 'my-plugin'),
            'add_new_item'       => __('Add New Product', 'my-plugin'),
            'edit_item'          => __('Edit Product', 'my-plugin'),
            'not_found'          => __('No products found.', 'my-plugin'),
        ];
    }

    public function register_taxonomy(): void {
        register_taxonomy('my_product_cat', self::POST_TYPE, [
            'labels'        => [
                'name'          => __('Product Categories', 'my-plugin'),
                'singular_name' => __('Product Category', 'my-plugin'),
            ],
            'hierarchical'  => true,
            'show_in_rest'  => true,
            'rewrite'       => ['slug' => 'product-cat'],
        ]);
    }

    public function add_meta_boxes(): void {
        add_meta_box(
            'my_product_details',
            __('Product Details', 'my-plugin'),
            [$this, 'render_meta_box'],
            self::POST_TYPE,
            'normal',
            'high'
        );
    }

    public function render_meta_box(\WP_Post $post): void {
        wp_nonce_field('my_product_meta_' . $post->ID, 'my_product_meta_nonce');
        $price = get_post_meta($post->ID, '_my_product_price', true);
        ?>
        <label for="my_product_price"><?php esc_html_e('Price', 'my-plugin'); ?></label>
        <input
            type="number"
            id="my_product_price"
            name="my_product_price"
            value="<?php echo esc_attr($price); ?>"
            step="0.01"
            min="0"
        >
        <?php
    }

    public function save_meta(int $post_id, \WP_Post $post): void {
        // Verificaciones estándar
        if (wp_is_post_autosave($post_id) || wp_is_post_revision($post_id)) {
            return;
        }

        if (!isset($_POST['my_product_meta_nonce']) ||
            !wp_verify_nonce(
                sanitize_text_field(wp_unslash($_POST['my_product_meta_nonce'])),
                'my_product_meta_' . $post_id
            )) {
            return;
        }

        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        // Sanitizar y guardar
        if (isset($_POST['my_product_price'])) {
            $price = filter_var(
                wp_unslash($_POST['my_product_price']),
                FILTER_VALIDATE_FLOAT
            );
            if ($price !== false && $price >= 0) {
                update_post_meta($post_id, '_my_product_price', $price);
            }
        }
    }
}
```

---

## 6. PHP 8.x features útiles en plugins

```php
// Match expression (vs switch)
$status_label = match($post->post_status) {
    'publish' => __('Published', 'my-plugin'),
    'draft'   => __('Draft', 'my-plugin'),
    'pending' => __('Pending', 'my-plugin'),
    default   => __('Unknown', 'my-plugin'),
};

// Nullsafe operator
$author_name = get_post($post_id)?->post_author
    ? get_userdata(get_post($post_id)->post_author)?->display_name
    : '';

// Named arguments (más legible en register_post_type, etc.)
$price = filter_var(
    value: $raw_price,
    filter: FILTER_VALIDATE_FLOAT,
    options: ['min_range' => 0]
);

// Readonly properties (PHP 8.1)
class PluginConfig {
    public function __construct(
        public readonly string $version,
        public readonly string $plugin_dir,
        public readonly string $plugin_url,
    ) {}
}

// Enums para tipos de CPT o estados (PHP 8.1)
enum ProductStatus: string {
    case Draft    = 'draft';
    case Active   = 'publish';
    case Archived = 'my_archived';
}
```
