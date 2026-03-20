# Secciones Opcionales y Guidelines

## Secciones por Feature

Solo crear páginas para features que el plugin realmente tiene.

| Feature del Plugin | Sección a Crear |
|-------------------|-----------------|
| Usa ACF | `configuration/acf-fields.mdx` |
| Registra templates | `usage/templates.mdx` |
| Tiene shortcodes | `usage/shortcodes.mdx` |
| Registra CPTs | `usage/custom-post-types.mdx` |
| Expone hooks | `developers/hooks.mdx` |
| Tiene API pública | `developers/functions.mdx` |
| Tiene Schema.org/SEO | `usage/schema-seo.mdx` |
| Soporte i18n | Mencionar en overview + listar idiomas |

---

## Starlight Components

| Necesidad | Componente |
|-----------|-----------|
| Aviso/tip | `:::note` / `:::tip` / `:::caution` / `:::danger` |
| Pasos secuenciales | `<Steps>` envolviendo lista ordenada |
| Alternativas | `<Tabs>` + `<TabItem>` |
| Cards de features | `<CardGrid>` + `<Card>` |
| Código con nombre | ` ```php title="functions.php" ` |
| Link card | `<LinkCard>` |

Todos importan desde `@astrojs/starlight/components`.

---

## Content Guidelines

**Público objetivo**: Administradores de WordPress y desarrolladores PHP.

**Dos niveles**:
1. **Usuario final** (Instalación, Templates, Shortcodes) — lenguaje sencillo, pasos numerados
2. **Desarrollador** (Hooks, Funciones, Arquitectura) — código PHP, referencias técnicas

**Reglas**:
- Idioma = idioma del README del plugin
- Sin placeholders — todo con datos reales extraídos del código
- Cada bloque PHP debe mostrar ejemplo real con output esperado
- Documentar dependencias explícitamente (ACF, Divi, WooCommerce, etc.)
- Si tiene CHANGELOG.md, extraer versiones directamente

---

## Workflow

1. **Leer el plugin**: archivo principal (cabecera), README.md, CLAUDE.md si existe
2. **Identificar features**: ACF, CPTs, templates, shortcodes, hooks, clases
3. **Detectar dependencias**: ACF, Divi, WooCommerce u otros requeridos
4. **Leer CHANGELOG.md** si existe
5. **Decidir secciones**: Solo lo que el plugin realmente tiene
6. **Scaffold Starlight**: `astro.config.mjs` con sidebar adaptada
7. **Escribir MDX**: Datos reales del código
8. **Verificar**: Sidebar matches archivos, imports correctos, sin TODOs

---

## Quality Checklist

- [ ] Todas las features documentadas
- [ ] Instalación con dependencias explícitas
- [ ] Campos ACF con tipos y descripciones
- [ ] Shortcodes con parámetros y ejemplos
- [ ] Templates con nombre visible en admin
- [ ] Funciones PHP con firma, parámetros y ejemplo
- [ ] Sidebar en `astro.config.mjs` coincide con archivos reales
- [ ] `custom.css` ONLY sets fonts — NO `--sl-color-*` overrides
- [ ] Theme toggle oculto (light only)
- [ ] Sin texto placeholder
- [ ] Idioma = idioma del README
