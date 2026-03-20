# Admin Panel — Settings API y Páginas de Administración

Patrones para crear páginas de admin, settings y formularios en plugins WordPress.

---

## Página de admin con Settings API

```php
<?php
// class-mpc-admin.php
if ( ! defined( 'ABSPATH' ) ) exit;

class MPC_Admin {

    private $option_group = 'mpc_options_group';
    private $option_name  = 'mpc_options';

    public function register() {
        add_action( 'admin_menu',       array( $this, 'add_menu' ) );
        add_action( 'admin_init',       array( $this, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
    }

    // -------------------------
    // Menú
    // -------------------------

    public function add_menu() {
        // Menú principal
        add_menu_page(
            __( 'Mi Plugin', 'mi-plugin-cliente' ),
            __( 'Mi Plugin', 'mi-plugin-cliente' ),
            'manage_options',
            'mi-plugin-cliente',
            array( $this, 'render_main_page' ),
            'dashicons-admin-generic',
            30
        );

        // Submenú (Settings)
        add_submenu_page(
            'mi-plugin-cliente',
            __( 'Ajustes', 'mi-plugin-cliente' ),
            __( 'Ajustes', 'mi-plugin-cliente' ),
            'manage_options',
            'mi-plugin-ajustes',
            array( $this, 'render_settings_page' )
        );
    }

    // -------------------------
    // Settings API
    // -------------------------

    public function register_settings() {
        register_setting(
            $this->option_group,
            $this->option_name,
            array(
                'sanitize_callback' => array( $this, 'sanitize_options' ),
                'default'           => array(),
            )
        );

        add_settings_section(
            'mpc_section_general',
            __( 'Configuración general', 'mi-plugin-cliente' ),
            array( $this, 'render_section_general' ),
            'mi-plugin-ajustes'
        );

        add_settings_field(
            'mpc_api_key',
            __( 'API Key', 'mi-plugin-cliente' ),
            array( $this, 'render_field_api_key' ),
            'mi-plugin-ajustes',
            'mpc_section_general'
        );

        add_settings_field(
            'mpc_activo',
            __( 'Activar funcionalidad', 'mi-plugin-cliente' ),
            array( $this, 'render_field_activo' ),
            'mi-plugin-ajustes',
            'mpc_section_general'
        );
    }

    public function sanitize_options( $input ) {
        $output = array();

        if ( isset( $input['api_key'] ) ) {
            $output['api_key'] = sanitize_text_field( $input['api_key'] );
        }

        $output['activo'] = isset( $input['activo'] ) ? 1 : 0;

        return $output;
    }

    // -------------------------
    // Render secciones y campos
    // -------------------------

    public function render_section_general() {
        echo '<p>' . esc_html__( 'Configuración principal del plugin.', 'mi-plugin-cliente' ) . '</p>';
    }

    public function render_field_api_key() {
        $options = get_option( $this->option_name, array() );
        $value   = isset( $options['api_key'] ) ? $options['api_key'] : '';
        ?>
        <input type="text"
               name="<?php echo esc_attr( $this->option_name ); ?>[api_key]"
               value="<?php echo esc_attr( $value ); ?>"
               class="regular-text" />
        <p class="description"><?php esc_html_e( 'Introduce tu API Key.', 'mi-plugin-cliente' ); ?></p>
        <?php
    }

    public function render_field_activo() {
        $options = get_option( $this->option_name, array() );
        $activo  = isset( $options['activo'] ) ? $options['activo'] : 0;
        ?>
        <input type="checkbox"
               name="<?php echo esc_attr( $this->option_name ); ?>[activo]"
               value="1"
               <?php checked( 1, $activo ); ?> />
        <label><?php esc_html_e( 'Activar', 'mi-plugin-cliente' ); ?></label>
        <?php
    }

    // -------------------------
    // Render páginas
    // -------------------------

    public function render_main_page() {
        if ( ! current_user_can( 'manage_options' ) ) return;
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <p><?php esc_html_e( 'Bienvenido al panel de Mi Plugin.', 'mi-plugin-cliente' ); ?></p>
        </div>
        <?php
    }

    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) return;

        // Mostrar mensaje de éxito tras guardar
        if ( isset( $_GET['settings-updated'] ) ) {
            add_settings_error(
                'mpc_messages',
                'mpc_message',
                __( 'Ajustes guardados.', 'mi-plugin-cliente' ),
                'updated'
            );
        }
        settings_errors( 'mpc_messages' );
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields( $this->option_group );
                do_settings_sections( 'mi-plugin-ajustes' );
                submit_button( __( 'Guardar ajustes', 'mi-plugin-cliente' ) );
                ?>
            </form>
        </div>
        <?php
    }

    // -------------------------
    // Assets de admin
    // -------------------------

    public function enqueue_scripts( $hook ) {
        // Solo cargar en las páginas del plugin
        $plugin_pages = array( 'toplevel_page_mi-plugin-cliente', 'mi-plugin_page_mi-plugin-ajustes' );
        if ( ! in_array( $hook, $plugin_pages, true ) ) return;

        wp_enqueue_style(
            'mpc-admin',
            MPC_URL . 'assets/css/admin.css',
            array(),
            MPC_VERSION
        );
        wp_enqueue_script(
            'mpc-admin',
            MPC_URL . 'assets/js/admin.js',
            array( 'jquery' ),
            MPC_VERSION,
            true
        );

        // Pasar datos a JS
        wp_localize_script( 'mpc-admin', 'mpcAdmin', array(
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'mpc_admin_nonce' ),
            'i18n'    => array(
                'confirm' => __( '¿Estás seguro?', 'mi-plugin-cliente' ),
            ),
        ) );
    }
}
```

---

## Leer opciones en el plugin

```php
// Helper para no repetir get_option en todo el plugin
function mpc_get_option( $key, $default = '' ) {
    $options = get_option( 'mpc_options', array() );
    return isset( $options[ $key ] ) ? $options[ $key ] : $default;
}

// Uso
$api_key = mpc_get_option( 'api_key' );
$activo  = mpc_get_option( 'activo', 0 );
```

---

## AJAX desde admin

```php
// Registrar handlers AJAX
add_action( 'wp_ajax_mpc_accion',        array( $this, 'handle_ajax' ) );
// add_action( 'wp_ajax_nopriv_mpc_accion', ... ); // Solo si necesita usuarios no logados

public function handle_ajax() {
    // Verificar nonce
    check_ajax_referer( 'mpc_admin_nonce', 'nonce' );

    // Verificar capacidad
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( array( 'message' => __( 'Sin permisos.', 'mi-plugin-cliente' ) ) );
    }

    $dato = isset( $_POST['dato'] ) ? sanitize_text_field( wp_unslash( $_POST['dato'] ) ) : '';

    // Procesar...

    wp_send_json_success( array( 'resultado' => $dato ) );
}
```

---

## Notas

- Guardar todas las opciones del plugin en **un solo `option_name`** (array) — no crear una opción por campo.
- `current_user_can('manage_options')` al inicio de cada render de página.
- Los `$hook` en `admin_enqueue_scripts` tienen el formato: `{parent}_page_{slug}` para submenús.
- Nunca usar `$_POST` directamente — siempre `wp_unslash()` + `sanitize_*()`.
