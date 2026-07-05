---
name: wp-plugin-audit
description: >
  Auditoría de seguridad, PHP moderno y testing para plugins WordPress privados/cliente.
  Usar cuando: revisar o auditar un plugin existente, detectar vulnerabilidades de seguridad
  en plugins WordPress, aplicar patrones PHP 8.x modernos (namespaces, PSR-4, Composer),
  configurar PHPUnit, PHPStan o PHPCS en plugins, auditar CPTs o taxonomías personalizadas,
  revisar nonces/capabilities/sanitización/escaping, detectar SQL injection o XSS en plugins,
  validar seguridad OWASP en código WordPress, auditar Block Bindings API e Interception API
  (WP 6.5+). También usar cuando el usuario diga
  "revisa mi plugin", "audita este código WP", "es seguro este plugin", "añade tests al plugin",
  "plugin con namespace", "PHP moderno en WordPress".
  Complementa wp-plugin-development (creación) — este skill se centra en REVISIÓN y CALIDAD.
license: MIT
---

# WP Plugin Audit — Seguridad, PHP Moderno y Testing

Skill especializado en **auditoría** de plugins WordPress privados/cliente.
Cubre lo que el skill oficial de desarrollo no profundiza: OWASP, PHP 8.x moderno y testing.

## Archivos de referencia

| Archivo | Cuándo leer |
|---------|-------------|
| [owasp-wp-security.md](references/owasp-wp-security.md) | Auditar vulnerabilidades, revisar nonces/caps/SQL/XSS |
| [php-modern-patterns.md](references/php-modern-patterns.md) | Namespaces, PSR-4, Composer, autoloading, PHP 8.x |
| [testing-phpunit.md](references/testing-phpunit.md) | PHPUnit, WP_Mock, PHPCS, configurar CI |

Lee el archivo relevante antes de dar recomendaciones. Para auditoría completa, lee los tres.

---

## Checklist de auditoría rápida

### 1. Seguridad OWASP

```
□ Nonces en todos los formularios y acciones AJAX
□ Capability checks antes de cualquier operación privilegiada
□ sanitize_*() en inputs, esc_*() en outputs (nunca al revés)
□ $wpdb->prepare() para toda SQL dinámica
□ wp_unslash() antes de sanitizar $_POST/$_GET
□ Verificación de nonce con wp_verify_nonce() / check_ajax_referer()
□ Archivos directamente accesibles protegidos con ABSPATH check
□ No datos sensibles en logs ni en opciones sin cifrar
□ Uploads validados: tipo MIME, extensión, tamaño
□ REST endpoints con permission_callback que no sea __return_true
```

### 2. PHP moderno

```
□ Namespace declarado (Vendor\PluginName o Client\PluginName)
□ Autoloading PSR-4 via Composer o spl_autoload_register
□ Type hints en funciones y propiedades de clase
□ No funciones globales sueltas — todo en clases o closures
□ PHP 8.0+ features usadas donde corresponde (match, nullsafe ?->, named args)
□ No código legacy: extract(), eval(), @ para suprimir errores
□ Dependencias de terceros via Composer, no copia-pegadas
□ composer.json presente con autoload configurado
```

### 3. Testing

```
□ phpunit.xml o phpunit.xml.dist presente
□ Tests en /tests o /test con bootstrap.php
□ WP_Mock o WP Test Suite configurado
□ Funciones de WP mockeadas correctamente (no llamadas reales)
□ PHPCS con ruleset WordPress-Extra o WordPress-Core
□ .phpcs.xml.dist en raíz del plugin
□ PHPStan o Psalm configurado (nivel 5+)
□ phpstan.neon.dist o psalm.xml en raíz
□ CI configurado (GitHub Actions o similar)
□ Cobertura de: activación, desactivación, casos límite de seguridad
```

### 4. CPTs y taxonomías

```
□ register_post_type() en hook init, no antes
□ Labels completos y traducibles con __()
□ capability_type definido si se necesitan caps custom
□ Rewrite rules con flush solo en activación (no en cada carga)
□ Meta boxes con nonce propio
□ Sanitización de meta al guardar con update_post_meta
□ Taxonomías: show_in_rest si se usa Gutenberg
```

---

## Procedimiento de auditoría

### Paso 1 — Localizar entrypoints

```bash
# Detectar main plugin file
grep -r "Plugin Name:" . --include="*.php" -l

# Ver estructura general
find . -name "*.php" | head -40 | sort
```

### Paso 2 — Revisar seguridad (leer owasp-wp-security.md)

Buscar patrones peligrosos primero:

```bash
# SQL sin prepare
grep -rn "wpdb->query\|wpdb->get_results" . --include="*.php" | grep -v "prepare"

# Outputs sin escapar
grep -rn "echo \$\|print \$" . --include="*.php" | grep -v "esc_"

# $_POST/$_GET sin sanitizar
grep -rn "\$_POST\|\$_GET\|\$_REQUEST" . --include="*.php" | grep -v "sanitize\|wp_unslash\|nonce"
```

### Paso 3 — Revisar estructura PHP (leer php-modern-patterns.md)

```bash
# ¿Tiene namespace?
grep -rn "^namespace " . --include="*.php" | head -10

# ¿Tiene composer.json?
cat composer.json 2>/dev/null || echo "Sin Composer"

# Type hints en métodos públicos
grep -rn "public function" . --include="*.php" | head -20
```

### Paso 4 — Revisar o configurar tests (leer testing-phpunit.md)

```bash
# ¿Existe configuración de tests?
ls phpunit.xml phpunit.xml.dist .phpcs.xml.dist 2>/dev/null

# ¿Existe directorio de tests?
ls -la tests/ test/ 2>/dev/null
```

---

## Criterios de aceptación tras auditoría

- Sin vulnerabilidades críticas (SQL injection, XSS, CSRF)
- Todas las acciones AJAX/form con nonce + capability check
- Namespace declarado y autoloading funcional
- PHPCS pasa sin errores en WordPress-Extra
- PHPStan nivel 5+ sin errores críticos
- Al menos tests de humo para activación y funcionalidad principal
- Block bindings y REST endpoints con permission_callback verificado
