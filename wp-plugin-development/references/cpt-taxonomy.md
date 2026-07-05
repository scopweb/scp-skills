# CPTs y Taxonomías — Patrones WordPress

Registro de Custom Post Types y taxonomías personalizadas sin Composer.

---

## CPT básico

```php
<?php
// class-mpc-cpt.php
if ( ! defined( 'ABSPATH' ) ) exit;

class MPC_CPT {

    public function register() {
        add_action( 'init', array( $this, 'register_post_types' ) );
        add_action( 'init', array( $this, 'register_taxonomies' ) );
    }

    public function register_post_types() {
        $labels = array(
            'name'               => _x( 'Productos', 'post type general name', 'mi-plugin-cliente' ),
            'singular_name'      => _x( 'Producto', 'post type singular name', 'mi-plugin-cliente' ),
            'menu_name'          => __( 'Productos', 'mi-plugin-cliente' ),
            'add_new'            => __( 'Añadir nuevo', 'mi-plugin-cliente' ),
            'add_new_item'       => __( 'Añadir nuevo producto', 'mi-plugin-cliente' ),
            'edit_item'          => __( 'Editar producto', 'mi-plugin-cliente' ),
            'new_item'           => __( 'Nuevo producto', 'mi-plugin-cliente' ),
            'view_item'          => __( 'Ver producto', 'mi-plugin-cliente' ),
            'search_items'       => __( 'Buscar productos', 'mi-plugin-cliente' ),
            'not_found'          => __( 'No se encontraron productos', 'mi-plugin-cliente' ),
            'not_found_in_trash' => __( 'No hay productos en la papelera', 'mi-plugin-cliente' ),
        );

        $args = array(
            'labels'             => $labels,
            'public'             => true,
            'publicly_queryable' => true,
            'show_ui'            => true,
            'show_in_menu'       => true,
            'show_in_rest'       => true,   // Necesario para Gutenberg
            'query_var'          => true,
            'rewrite'            => array( 'slug' => 'productos' ),
            'capability_type'    => 'post',
            'has_archive'        => true,
            'hierarchical'       => false,
            'menu_position'      => 5,
            'menu_icon'          => 'dashicons-products',
            'supports'           => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
        );

        register_post_type( 'mpc_producto', $args );
    }

    public function register_taxonomies() {
        // Ver patrón de taxonomía abajo
    }
}
```

---

## Taxonomía jerárquica (tipo categoría)

```php
public function register_taxonomies() {
    $labels = array(
        'name'              => _x( 'Categorías de producto', 'taxonomy general name', 'mi-plugin-cliente' ),
        'singular_name'     => _x( 'Categoría', 'taxonomy singular name', 'mi-plugin-cliente' ),
        'search_items'      => __( 'Buscar categorías', 'mi-plugin-cliente' ),
        'all_items'         => __( 'Todas las categorías', 'mi-plugin-cliente' ),
        'parent_item'       => __( 'Categoría padre', 'mi-plugin-cliente' ),
        'parent_item_colon' => __( 'Categoría padre:', 'mi-plugin-cliente' ),
        'edit_item'         => __( 'Editar categoría', 'mi-plugin-cliente' ),
        'update_item'       => __( 'Actualizar categoría', 'mi-plugin-cliente' ),
        'add_new_item'      => __( 'Añadir nueva categoría', 'mi-plugin-cliente' ),
        'new_item_name'     => __( 'Nombre nueva categoría', 'mi-plugin-cliente' ),
        'menu_name'         => __( 'Categorías', 'mi-plugin-cliente' ),
    );

    $args = array(
        'hierarchical'      => true,   // false para tipo etiqueta
        'labels'            => $labels,
        'show_ui'           => true,
        'show_in_rest'      => true,   // Gutenberg
        'show_admin_column' => true,
        'query_var'         => true,
        'rewrite'           => array( 'slug' => 'categoria-producto' ),
    );

    register_taxonomy( 'mpc_categoria', array( 'mpc_producto' ), $args );
}
```

---

## Meta box personalizada (sin ACF)

```php
<?php
// class-mpc-metabox.php
if ( ! defined( 'ABSPATH' ) ) exit;

class MPC_Metabox {

    public function register() {
        add_action( 'add_meta_boxes', array( $this, 'add_meta_boxes' ) );
        add_action( 'save_post',      array( $this, 'save_meta' ) );
    }

    public function add_meta_boxes() {
        add_meta_box(
            'mpc_producto_datos',
            __( 'Datos del producto', 'mi-plugin-cliente' ),
            array( $this, 'render_metabox' ),
            'mpc_producto',
            'normal',
            'high'
        );
    }

    public function render_metabox( $post ) {
        wp_nonce_field( 'mpc_save_producto', 'mpc_producto_nonce' );

        $precio = get_post_meta( $post->ID, '_mpc_precio', true );
        $sku    = get_post_meta( $post->ID, '_mpc_sku', true );
        ?>
        <p>
            <label for="mpc_precio"><?php esc_html_e( 'Precio (€)', 'mi-plugin-cliente' ); ?></label>
            <input type="number" step="0.01" id="mpc_precio" name="mpc_precio"
                   value="<?php echo esc_attr( $precio ); ?>" />
        </p>
        <p>
            <label for="mpc_sku"><?php esc_html_e( 'SKU', 'mi-plugin-cliente' ); ?></label>
            <input type="text" id="mpc_sku" name="mpc_sku"
                   value="<?php echo esc_attr( $sku ); ?>" />
        </p>
        <?php
    }

    public function save_meta( $post_id ) {
        // Verificaciones de seguridad
        if ( ! isset( $_POST['mpc_producto_nonce'] ) ) return;
        if ( ! wp_verify_nonce( $_POST['mpc_producto_nonce'], 'mpc_save_producto' ) ) return;
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) ) return;

        // Guardar campos
        if ( isset( $_POST['mpc_precio'] ) ) {
            update_post_meta( $post_id, '_mpc_precio', floatval( $_POST['mpc_precio'] ) );
        }
        if ( isset( $_POST['mpc_sku'] ) ) {
            update_post_meta( $post_id, '_mpc_sku', sanitize_text_field( wp_unslash( $_POST['mpc_sku'] ) ) );
        }
    }
}
```

---

## Registrar todo en la clase principal

```php
// En MPC_Plugin::load_dependencies()
require_once MPC_PATH . 'includes/class-mpc-cpt.php';
require_once MPC_PATH . 'includes/class-mpc-metabox.php';

// En MPC_Plugin::define_admin_hooks() o run()
$cpt = new MPC_CPT();
$cpt->register();

$metabox = new MPC_Metabox();
$metabox->register();
```

---

## Notas

- El slug del CPT `mpc_producto` incluye el prefijo para evitar conflictos.
- `show_in_rest => true` es obligatorio para compatibilidad con Gutenberg.
- `flush_rewrite_rules()` solo en `register_activation_hook`, nunca en `init`.
- Si el CPT necesita capabilities propias: `'capability_type' => array('producto','productos')` + `'map_meta_cap' => true`.

---

## Block Templates para CPT (Gutenberg)

WP 6.4+ permite definir templates de bloques para CPT, bloqueando o guiando el contenido.

### Definir template en register_post_type

```php
$args = array(
    // ... otros args
    'template' => array(
        array('core/heading', array(
            'placeholder' => 'Nombre del producto',
            'level'       => 2,
        )),
        array('core/image', array(
            'placeholder' => 'Añadir imagen del producto',
        )),
        array('core/paragraph', array(
            'placeholder' => 'Descripción del producto...',
        )),
    ),
    'template_lock' => 'insert', // 'insert' = permite agregar, 'all' = bloqueado
);
```

### Bloques de ACF PRO en template

```php
// Si usas ACF PRO con blocks
'template' => array(
    array('acf/mpc-producto-datos', array(
        'data' => array(
            'mpc_precio' => '',
        ),
    )),
),
```

### Block bindings con meta fields (WP 6.5+)

Para bindear un meta field a un bloque de forma declarativa, registrar el meta con `show_in_rest`:

```php
register_post_meta('mpc_producto', '_mpc_precio', [
    'type'         => 'number',
    'single'       => true,
    'show_in_rest' => true,
]);
```

Luego en el bloque:
```json
{
    "attributes": {
        "price": {
            "type": "number",
            "source": "binding",
            "binding": {
                "price": {
                    "type": "string",
                    "source": "meta",
                    "meta": "_mpc_precio"
                }
            }
        }
    }
}
```
