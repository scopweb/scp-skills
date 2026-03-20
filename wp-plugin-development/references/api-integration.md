# API Integration — Consumir APIs externas desde WordPress

Patrones con `wp_remote_get/post`, transients, autenticación y manejo de errores.

---

## Clase base de integración con API

```php
<?php
// class-mpc-api.php
if ( ! defined( 'ABSPATH' ) ) exit;

class MPC_API {

    private $base_url   = 'https://api.ejemplo.com/v1';
    private $api_key;
    private $timeout    = 15;
    private $cache_ttl  = 3600; // 1 hora

    public function __construct() {
        $this->api_key = mpc_get_option( 'api_key' );
    }

    // -------------------------
    // Métodos HTTP
    // -------------------------

    private function get( $endpoint, $params = array() ) {
        $url = trailingslashit( $this->base_url ) . ltrim( $endpoint, '/' );

        if ( ! empty( $params ) ) {
            $url = add_query_arg( $params, $url );
        }

        $response = wp_remote_get( $url, array(
            'timeout' => $this->timeout,
            'headers' => $this->get_headers(),
        ) );

        return $this->parse_response( $response );
    }

    private function post( $endpoint, $body = array() ) {
        $url = trailingslashit( $this->base_url ) . ltrim( $endpoint, '/' );

        $response = wp_remote_post( $url, array(
            'timeout' => $this->timeout,
            'headers' => $this->get_headers(),
            'body'    => wp_json_encode( $body ),
        ) );

        return $this->parse_response( $response );
    }

    private function get_headers() {
        return array(
            'Authorization' => 'Bearer ' . $this->api_key,
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
        );
    }

    private function parse_response( $response ) {
        // Error de conexión (WP_Error)
        if ( is_wp_error( $response ) ) {
            return array(
                'success' => false,
                'error'   => $response->get_error_message(),
                'data'    => null,
            );
        }

        $status_code = wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code < 200 || $status_code >= 300 ) {
            $error_msg = isset( $data['message'] ) ? $data['message'] : "HTTP {$status_code}";
            return array(
                'success' => false,
                'error'   => $error_msg,
                'code'    => $status_code,
                'data'    => null,
            );
        }

        return array(
            'success' => true,
            'data'    => $data,
            'code'    => $status_code,
        );
    }

    // -------------------------
    // Métodos públicos con caché
    // -------------------------

    public function get_productos( $categoria = '' ) {
        $cache_key = 'mpc_productos_' . md5( $categoria );
        $cached    = get_transient( $cache_key );

        if ( false !== $cached ) {
            return $cached;
        }

        $params = array();
        if ( $categoria ) {
            $params['categoria'] = sanitize_key( $categoria );
        }

        $result = $this->get( 'productos', $params );

        if ( $result['success'] ) {
            set_transient( $cache_key, $result, $this->cache_ttl );
        }

        return $result;
    }

    public function get_producto( $id ) {
        $cache_key = 'mpc_producto_' . intval( $id );
        $cached    = get_transient( $cache_key );

        if ( false !== $cached ) {
            return $cached;
        }

        $result = $this->get( 'productos/' . intval( $id ) );

        if ( $result['success'] ) {
            set_transient( $cache_key, $result, $this->cache_ttl );
        }

        return $result;
    }

    public function crear_pedido( $datos ) {
        // Sin caché — operación de escritura
        $datos_limpios = array(
            'producto_id' => intval( $datos['producto_id'] ),
            'cantidad'    => intval( $datos['cantidad'] ),
            'cliente'     => sanitize_text_field( $datos['cliente'] ),
            'email'       => sanitize_email( $datos['email'] ),
        );

        return $this->post( 'pedidos', $datos_limpios );
    }

    // -------------------------
    // Gestión de caché
    // -------------------------

    public function invalidar_cache( $tipo = 'all' ) {
        if ( 'productos' === $tipo || 'all' === $tipo ) {
            // WP no tiene wildcard en transients — necesitamos registrar las keys
            // o usar una query directa
            global $wpdb;
            $wpdb->query(
                "DELETE FROM {$wpdb->options}
                 WHERE option_name LIKE '_transient_mpc_producto%'
                 OR option_name LIKE '_transient_timeout_mpc_producto%'"
            );
        }
    }
}
```

---

## Uso desde shortcode o template

```php
// Ejemplo de shortcode que consume la API
function mpc_shortcode_productos( $atts ) {
    $atts = shortcode_atts( array(
        'categoria' => '',
        'limite'    => 10,
    ), $atts, 'mpc_productos' );

    $api    = new MPC_API();
    $result = $api->get_productos( $atts['categoria'] );

    if ( ! $result['success'] ) {
        return '<p class="mpc-error">' . esc_html__( 'Error al cargar productos.', 'mi-plugin-cliente' ) . '</p>';
    }

    $productos = array_slice( $result['data'], 0, intval( $atts['limite'] ) );

    ob_start();
    foreach ( $productos as $producto ) {
        ?>
        <div class="mpc-producto">
            <h3><?php echo esc_html( $producto['nombre'] ); ?></h3>
            <p><?php echo esc_html( $producto['descripcion'] ); ?></p>
            <span><?php echo esc_html( $producto['precio'] ); ?> €</span>
        </div>
        <?php
    }
    return ob_get_clean();
}
add_shortcode( 'mpc_productos', 'mpc_shortcode_productos' );
```

---

## Webhook — Recibir datos de la API

```php
// Registrar endpoint REST para recibir webhooks
add_action( 'rest_api_init', function() {
    register_rest_route( 'mi-plugin/v1', '/webhook', array(
        'methods'             => 'POST',
        'callback'            => 'mpc_handle_webhook',
        'permission_callback' => 'mpc_validate_webhook',
    ) );
} );

function mpc_validate_webhook( $request ) {
    $secret   = mpc_get_option( 'webhook_secret' );
    $received = $request->get_header( 'x-webhook-signature' );
    $payload  = $request->get_body();

    if ( empty( $secret ) || empty( $received ) ) {
        return false;
    }

    $expected = hash_hmac( 'sha256', $payload, $secret );
    return hash_equals( $expected, $received );
}

function mpc_handle_webhook( $request ) {
    $data = $request->get_json_params();

    // Procesar evento
    $evento = isset( $data['evento'] ) ? sanitize_key( $data['evento'] ) : '';

    do_action( 'mpc_webhook_' . $evento, $data );

    return rest_ensure_response( array( 'status' => 'ok' ) );
}
```

---

## Autenticación con OAuth / token renovable

```php
// Obtener token y cachear
function mpc_get_access_token() {
    $token = get_transient( 'mpc_access_token' );
    if ( $token ) return $token;

    $response = wp_remote_post( 'https://api.ejemplo.com/oauth/token', array(
        'body' => array(
            'grant_type'    => 'client_credentials',
            'client_id'     => mpc_get_option( 'client_id' ),
            'client_secret' => mpc_get_option( 'client_secret' ),
        ),
    ) );

    if ( is_wp_error( $response ) ) return false;

    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( empty( $data['access_token'] ) ) return false;

    $expires_in = isset( $data['expires_in'] ) ? intval( $data['expires_in'] ) - 60 : 3540;
    set_transient( 'mpc_access_token', $data['access_token'], $expires_in );

    return $data['access_token'];
}
```

---

## Notas

- Usar siempre `wp_remote_get/post` — nunca `curl` o `file_get_contents` directamente.
- `is_wp_error()` antes de procesar cualquier respuesta.
- Cachear con `set_transient` toda llamada GET — nunca las de escritura (POST/PUT/DELETE).
- La invalidación de transients con wildcard requiere query directa o un registro de keys.
- Para APIs con rate limits: considerar una cola con `wp_schedule_single_event`.
- Los webhooks deben verificar firma HMAC siempre — nunca aceptar payloads sin validar.
