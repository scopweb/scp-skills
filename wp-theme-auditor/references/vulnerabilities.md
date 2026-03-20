# Vulnerabilidades Reales en Temas WordPress (2025)

## Divi

| Vulnerabilidad | Versión | Severidad | Detalle |
|---|---|---|---|
| DOM XSS stored | ≤ 4.25.0 | 🟠 ALTO | Atributos de módulos sin escape → XSS en builder |
| Arbitrary file upload | ≤ 4.5.2 | 🔴 CRÍTICO | Validación solo en cliente → PHP backdoor upload |
| Code injection (contributor+) | 3.23–4.0.9 | 🔴 CRÍTICO | Ejecución PHP por roles bajos |
| CSRF en AJAX ET | Versiones antiguas | 🟠 ALTO | AJAX handlers sin verificación de nonce |

> Divi tiene 1M+ instalaciones activas. Verificar siempre que el padre esté actualizado.
> WPScan: https://wpscan.com/theme/Divi/

## Otros temas (referencia)

| Tema | CVE | Severidad | Descripción |
|---|---|---|---|
| Shuttle | CVE-2025-62137 | 🟠 ALTO | XSS stored — output sin escapar de contribuidores |
| Alone | Sin CVE | 🔴 CRÍTICO | RCE via importación ZIP sin validación → backdoors persistentes |

## Estadística 2025

- El 9% de vulnerabilidades WordPress 2025 son de temas
- XSS sigue siendo el vector más frecuente (>60% de vulnerabilidades de temas)
- Vulnerabilidades de privilege escalation crecen en temas con roles personalizados

---

## Referencias oficiales

- [WordPress Theme Security Handbook](https://developer.wordpress.org/themes/advanced-topics/security/)
- [Divi Child Theme — Elegant Themes](https://help.elegantthemes.com/en/articles/2188070-how-to-create-a-child-theme-for-divi)
- [WP Child Themes Handbook](https://developer.wordpress.org/themes/advanced-topics/child-themes/)
- [Patchstack — Common vulnerabilities](https://patchstack.com/articles/common-plugin-vulnerabilities-how-to-fix-them/)
- [WPScan — Divi](https://wpscan.com/theme/Divi/)
