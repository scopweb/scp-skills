---
name: wp-theme-auditor
description: >
  Audita temas WordPress existentes (clásicos y de bloque/FSE) en busca de
  vulnerabilidades de seguridad y desviaciones de best practices. Úsalo cuando
  el usuario comparta código de un tema WordPress para revisar, pida auditar un
  tema, detectar vulnerabilidades XSS/CSRF/SQLi en templates PHP, revisar
  functions.php, child themes o archivos de tema en general. Actívalo también
  ante frases como: "revisa este tema", "es seguro este código", "audita mi
  theme", "tiene vulnerabilidades", "security review WordPress theme",
  "¿está bien este functions.php?", "revisa mi Divi child theme",
  "audita mi child theme Divi". Target: WordPress 6.7+ / PHP 8.2+.
  NO cubre plugins, WooCommerce, Gutenberg block development ni infraestructura.
license: MIT
---

# WordPress Theme Auditor

Auditor de seguridad y calidad para **temas WordPress existentes**.  
Scope: `functions.php`, templates (`*.php`), `style.css`, `theme.json`, partials, child themes.  
Excluye: plugins, WooCommerce, servidor.

## Reference Files

| File | Leer cuando... |
|------|----------------|
| [divi-child.md](references/divi-child.md) | El tema es un Divi child theme — leer ANTES que los bloques generales |
| [security-blocks.md](references/security-blocks.md) | Bloques 1-5: XSS, sanitización, CSRF, enqueue, permisos |
| [vulnerabilities.md](references/vulnerabilities.md) | CVEs reales de temas en 2025, referencias externas |

---

## Workflow de auditoría

### 1. Identificar tipo de tema

- **Clásico**: `functions.php` + template hierarchy (`index.php`, `single.php`…)
- **Bloque (FSE)**: `theme.json` + templates en `/templates/*.html`
- **Child theme Divi**: padre es Divi → leer `divi-child.md` antes de continuar
- **Child theme genérico**: auditar `functions.php` del child + acceso al padre si hay

### 2. Ejecutar bloques de revisión (en orden)

| # | Bloque | Reference |
|---|--------|-----------|
| 1 | Output escaping (XSS) | `security-blocks.md` |
| 2 | Input sanitization | `security-blocks.md` |
| 3 | CSRF / nonces | `security-blocks.md` |
| 4 | Enqueue correcto | `security-blocks.md` |
| 5 | Permisos y acceso | `security-blocks.md` |

Si es Divi child: ejecutar primero `divi-child.md` (D1–D7), luego los 5 bloques generales.

### 3. Consultar CVEs conocidos

Leer `vulnerabilities.md` para cruzar el tema/versión con vulnerabilidades conocidas.

### 4. Generar informe

```
## Auditoría: [Nombre child theme] (Divi child) vX.X
Parent: Divi vX.X / WordPress 6.7+ / PHP 8.2+
Archivos analizados: style.css, functions.php, [otros]

### 🔴 CRÍTICOS (n)
[D-01] Ruta incorrecta en functions.php:12
  Código: include( get_template_directory() . '/helpers.php' );
  Riesgo: Carga desde el PADRE — si el padre cambia, el child rompe silenciosamente
  Fix:    include( get_stylesheet_directory() . '/helpers.php' );

### 🟠 ALTOS (n)
### 🟡 MEDIOS (n)
### 🟢 INFO / Best practices
```

Niveles: 🔴 CRÍTICO · 🟠 ALTO · 🟡 MEDIO · 🟢 INFO

---

## Checklist rápida

**Divi child (ver `divi-child.md` para detalle):**
- [ ] `Template: Divi` en `style.css` (mayúscula exacta, sin slash)
- [ ] Enqueue usa handle `divi-style` para el padre
- [ ] `get_stylesheet_directory()` para archivos del child
- [ ] Funciones con prefijo propio, nunca `et_` ni nombres genéricos
- [ ] Hooks via `et_builder_ready`, nunca edición directa del padre
- [ ] Divi padre actualizado

**General:**
- [ ] Todos los `echo` con datos dinámicos usan función de escape adecuada al contexto
- [ ] `sanitize_text_field()` no se usa como sustituto de escape en output
- [ ] URLs escapadas con `esc_url()`, no `esc_attr()`
- [ ] Formularios con `wp_nonce_field()` y `wp_verify_nonce()`
- [ ] AJAX handlers usan `check_ajax_referer()`
- [ ] Scripts/estilos cargados vía `wp_enqueue_*`, no hardcodeados
- [ ] `wp_enqueue_script` usa `strategy: defer/async` donde proceda (WP 6.3+)
- [ ] Sin `include`/`require` con input de usuario sin whitelist
- [ ] Customizer settings tienen `sanitize_callback` definido
