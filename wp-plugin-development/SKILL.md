---
name: wp-plugin-development
description: >
  Crear plugins WordPress desde cero con scaffolding completo.
  Usar cuando: crear un plugin nuevo, generar estructura base de plugin WordPress,
  scaffolding de plugin con CPTs, taxonomías, block templates, ACF, admin panel,
  WP_CLI commands, dbDelta migrations, integración con APIs externas,
  o plugin de funcionalidades para tema. Sin Composer (structura simple) o con PSR-4/Composer
  según complejidad. Triggers: "crea un plugin", "nuevo plugin WordPress", "plugin desde cero",
  "scaffolding plugin WP", "plugin con CPT", "plugin con ACF", "plugin con admin",
  "plugin con API", "plugin para mi tema", "plugin con migrations", "plugin con WP_CLI".
  Complementa wp-plugin-audit (que cubre revisión/seguridad del código ya existente).
license: MIT
---

# WP Plugin Development — Scaffolding desde Cero

Skill para **crear plugins WordPress** con estructura completa y código base funcional.
Sin Composer. PHP estándar WordPress. Compatible con PHP 8.x y WP 6.x.

## Archivos de referencia

| Archivo | Cuándo leer |
|---------|-------------|
| [scaffold-structure.md](references/scaffold-structure.md) | Siempre — estructura base y main file |
| [cpt-taxonomy.md](references/cpt-taxonomy.md) | Plugin con CPTs, taxonomías o block templates |
| [acf-integration.md](references/acf-integration.md) | Plugin que usa Advanced Custom Fields |
| [admin-panel.md](references/admin-panel.md) | Plugin con admin panel / settings page |
| [api-integration.md](references/api-integration.md) | Plugin que consume APIs externas |
| [wp-cli.md](references/wp-cli.md) | Plugin que necesita comandos WP_CLI |
| [migrations.md](references/migrations.md) | Plugin con tablas custom y versionado de schema |

**Regla:** Lee `scaffold-structure.md` siempre primero. Luego los específicos según el tipo de plugin solicitado.

---

## Flujo de creación

### Paso 1 — Recopilar información del plugin

Antes de generar nada, preguntar al usuario:

```
1. Nombre del plugin (se usará para el slug y el namespace)
2. Descripción breve (para el header)
3. Tipo(s): CPT / taxonomía / ACF / admin panel / API / funcionalidades de tema
4. ¿Tiene frontend (shortcodes, scripts, estilos) o solo backend?
5. ¿Hay APIs externas involucradas? ¿Cuáles?
```

### Paso 2 — Leer referencias necesarias

Según el tipo seleccionado:
- Siempre: `scaffold-structure.md`
- CPT/taxonomía: `cpt-taxonomy.md`
- ACF: `acf-integration.md`
- Admin panel: `admin-panel.md`
- API externa: `api-integration.md`

### Paso 3 — Generar scaffold completo

Generar **todos los archivos** del plugin con código funcional real, no placeholders.
Cada archivo debe estar listo para usar, no "completar según necesidad".

### Paso 4 — Resumen de archivos generados

Al final, listar:
```
✓ plugin-slug/
  ├── plugin-slug.php          (main file con header)
  ├── includes/
  │   ├── class-plugin-name.php
  │   └── [archivos según tipo]
  ├── admin/                   (si aplica)
  ├── assets/                  (si aplica)
  └── languages/
```

---

## Convenciones del stack

### Nomenclatura

```php
// Slug del plugin: kebab-case
mi-plugin-cliente

// Prefijo de funciones/constantes: snake_case único
mpc_          // mi-plugin-cliente → mpc_

// Clases: PascalCase sin namespace (sin Composer)
class MPC_Plugin {}
class MPC_CPT_Producto {}
class MPC_Admin {}
class MPC_API_Cliente {}

// Hooks y filtros: prefijo + descripción
add_action('mpc_after_save_producto', ...);
```

### Constantes base (siempre en main file)

```php
define('MPC_VERSION', '1.0.0');
define('MPC_PATH', plugin_dir_path(__FILE__));
define('MPC_URL', plugin_dir_url(__FILE__));
define('MPC_BASENAME', plugin_basename(__FILE__));
```

### Carga de clases (sin Composer)

```php
// En main file, antes de instanciar
require_once MPC_PATH . 'includes/class-mpc-plugin.php';
require_once MPC_PATH . 'includes/class-mpc-cpt.php';
// etc.
```

### Patrón de instanciación principal

```php
// Main file — siempre así, nunca global directo
function mpc_init() {
    return MPC_Plugin::get_instance();
}
add_action('plugins_loaded', 'mpc_init');
```

---

## Checklist antes de entregar el scaffold

```
□ Header del plugin completo (Plugin Name, Version, Author, Text Domain)
□ Comprobación ABSPATH en cada archivo PHP
□ Prefijo único en todas las funciones, hooks, opciones y constantes
□ register_activation_hook y register_deactivation_hook en main file
□ load_plugin_textdomain() para i18n
□ Carpeta languages/ creada
□ Assets con wp_enqueue correctamente (no hardcoded URLs)
□ Nonces en formularios de admin
□ Capability checks antes de guardar opciones
□ sanitize_*() al guardar, esc_*() al mostrar
□ uninstall.php creado para cleanup completo
□ Decisión clara: scaffold simple (sin Composer) vs PSR-4/Composer
□ Block templates en CPT si es Gutenberg-first
□ WP_CLI commands si hay tareas de mantenimiento
□ dbDelta migrations si hay tablas custom
```
