# ACF Integration — Advanced Custom Fields en Plugins

Patrones para usar ACF desde un plugin sin Composer. Asume ACF instalado como plugin separado.

---

## Verificar ACF disponible

```php
// Siempre verificar antes de usar ACF
if ( ! function_exists( 'acf_add_local_field_group' ) ) {
    return; // ACF no está activo
}
```

---

## Registrar grupos de campos por código (Local JSON)

Mejor que configurarlo en el admin: el código es portable y vive en el repositorio.

```php
<?php
// class-mpc-acf.php
if ( ! defined( 'ABSPATH' ) ) exit;

class MPC_ACF {

    public function register() {
        add_action( 'acf/init', array( $this, 'register_field_groups' ) );
        add_filter( 'acf/settings/load_json', array( $this, 'load_json_path' ) );
        add_filter( 'acf/settings/save_json', array( $this, 'save_json_path' ) );
    }

    /**
     * Ruta donde ACF guarda/lee el JSON de campos
     */
    public function save_json_path( $path ) {
        return MPC_PATH . 'acf-json';
    }

    public function load_json_path( $paths ) {
        $paths[] = MPC_PATH . 'acf-json';
        return $paths;
    }

    /**
     * Registrar grupos de campos por código (alternativa al JSON)
     */
    public function register_field_groups() {
        if ( ! function_exists( 'acf_add_local_field_group' ) ) return;

        acf_add_local_field_group( array(
            'key'      => 'group_mpc_producto',
            'title'    => 'Datos del Producto',
            'fields'   => array(
                array(
                    'key'          => 'field_mpc_precio',
                    'label'        => 'Precio (€)',
                    'name'         => 'mpc_precio',
                    'type'         => 'number',
                    'min'          => 0,
                    'step'         => 0.01,
                    'required'     => 1,
                ),
                array(
                    'key'          => 'field_mpc_sku',
                    'label'        => 'SKU',
                    'name'         => 'mpc_sku',
                    'type'         => 'text',
                    'maxlength'    => 50,
                ),
                array(
                    'key'          => 'field_mpc_galeria',
                    'label'        => 'Galería de imágenes',
                    'name'         => 'mpc_galeria',
                    'type'         => 'gallery',
                    'return_format'=> 'array',
                    'preview_size' => 'medium',
                ),
                array(
                    'key'          => 'field_mpc_relacionados',
                    'label'        => 'Productos relacionados',
                    'name'         => 'mpc_relacionados',
                    'type'         => 'relationship',
                    'post_type'    => array( 'mpc_producto' ),
                    'return_format'=> 'object',
                    'max'          => 4,
                ),
            ),
            'location' => array(
                array(
                    array(
                        'param'    => 'post_type',
                        'operator' => '==',
                        'value'    => 'mpc_producto',
                    ),
                ),
            ),
            'menu_order'   => 0,
            'position'     => 'normal',
            'style'        => 'default',
            'label_placement' => 'top',
        ) );
    }
}
```

---

## Leer campos ACF en templates / shortcodes

```php
// Campo simple
$precio = get_field( 'mpc_precio', $post_id );

// Campo de imagen (return_format: array)
$imagen = get_field( 'mpc_imagen', $post_id );
if ( $imagen ) {
    echo '<img src="' . esc_url( $imagen['url'] ) . '" alt="' . esc_attr( $imagen['alt'] ) . '">';
}

// Galería
$galeria = get_field( 'mpc_galeria', $post_id );
if ( $galeria ) {
    foreach ( $galeria as $img ) {
        echo '<img src="' . esc_url( $img['url'] ) . '">';
    }
}

// Relación (return_format: object — devuelve WP_Post)
$relacionados = get_field( 'mpc_relacionados', $post_id );
if ( $relacionados ) {
    foreach ( $relacionados as $producto ) {
        echo '<a href="' . esc_url( get_permalink( $producto->ID ) ) . '">'
             . esc_html( $producto->post_title ) . '</a>';
    }
}

// Repeater
if ( have_rows( 'mpc_caracteristicas', $post_id ) ) {
    while ( have_rows( 'mpc_caracteristicas', $post_id ) ) {
        the_row();
        $nombre = get_sub_field( 'nombre' );
        $valor  = get_sub_field( 'valor' );
        echo esc_html( $nombre ) . ': ' . esc_html( $valor );
    }
}
```

---

## ACF en páginas de opciones (settings globales del plugin)

```php
// En MPC_ACF::register() o en el activador
public function register_options_page() {
    if ( function_exists( 'acf_add_options_page' ) ) {
        acf_add_options_page( array(
            'page_title' => __( 'Ajustes Mi Plugin', 'mi-plugin-cliente' ),
            'menu_title' => __( 'Mi Plugin', 'mi-plugin-cliente' ),
            'menu_slug'  => 'mi-plugin-ajustes',
            'capability' => 'manage_options',
            'redirect'   => false,
        ) );
    }
}

// Leer opción global
$api_key = get_field( 'mpc_api_key', 'option' );
```

---

## Estructura de carpetas con ACF JSON

```
plugin-slug/
├── acf-json/           ← ACF sincroniza aquí automáticamente
│   └── group_mpc_producto.json
├── includes/
│   └── class-mpc-acf.php
```

---

## Notas

- Usar `acf/init` como hook, no `init` — garantiza que ACF está cargado.
- Los `key` de grupos y campos deben ser únicos globalmente: usar prefijo del plugin.
- Con ACF JSON activado, los cambios desde el admin se sincronizan al archivo — commitear el JSON al repositorio.
- Si ACF no está disponible: el plugin no debe romperse. Usar siempre `function_exists('acf_add_local_field_group')`.
- ACF PRO necesario para: Repeater, Flexible Content, Gallery, Options Page, Relationship avanzado.
