# Content Guidelines — MCP Docs Generator

## Público objetivo

Usuarios que saben qué es un MCP server conceptualmente pero pueden no ser programadores.
Necesitan comandos copy-paste que funcionen y quieren entender las implicaciones de seguridad antes de instalar.

**Tono**: Profesional pero cercano. Como un amigo con conocimiento explicando las cosas con claridad.

---

## Reglas de contenido

- Usar componentes built-in de Starlight: `Aside`, `Tabs`, `TabItem`, `Card`, `CardGrid`, `Steps`
- Usar sintaxis de directivas para avisos: `:::note`, `:::tip`, `:::caution`, `:::danger`
- `<Steps>` para instrucciones secuenciales
- `<Tabs>` para alternativas (npm vs yarn, macOS vs Windows)
- Tablas sobre listas para datos estructurados (parámetros, opciones de config)
- Máximo 3 niveles de heading
- Sin acrónimos sin explicar en el primer uso
- Todo bloque de código con prop `title` cuando representa un archivo
- Todo comando muestra el output esperado
- Sin texto placeholder — todo con datos reales del servidor

---

## Starlight Component Quick Reference

| Necesidad | Componente |
|-----------|-----------|
| Warning/tip | `:::note` / `:::tip` / `:::caution` / `:::danger` |
| Pasos secuenciales | `<Steps>` con lista ordenada |
| Alternativas | `<Tabs>` + `<TabItem>` |
| Feature cards | `<CardGrid>` + `<Card>` |
| Código con nombre | ` ```lang title="filename.ext" ` |
| Link cards | `<LinkCard>` |

Todos importan desde `@astrojs/starlight/components`.

---

## Workflow

1. **Gather info**: Leer código fuente del MCP server, `package.json`, README existente
2. **Extract tools**: Parsear definiciones de tools (nombres, descripciones, parámetros, tipos)
3. **Extract config**: Encontrar variables de entorno, archivos de config, permisos necesarios
4. **Scaffold Starlight**: Crear `astro.config.mjs` con sidebar que coincida con los tools encontrados
5. **Write MDX**: Generar cada página con datos reales — nombres reales, parámetros reales, ejemplos reales
6. **Add styles**: `custom.css` con variables de fuente ÚNICAMENTE — nunca sobreescribir `--sl-color-*`
7. **Add Head override**: Inyectar Typekit stylesheet
8. **Verify**: Todos los tools documentados, ejemplos válidos, sin placeholders

### Fuentes de información (por prioridad)

1. Código fuente del MCP server (definiciones de tools, schemas)
2. `package.json` / `Cargo.toml` / `go.mod` (nombre, versión, deps)
3. `README.md` existente
4. Archivos de config (`.env.example`, config schemas)
5. Input del usuario para lo que falte

---

## Quality Checklist

- [ ] Todos los MCP tools documentados con parámetros y ejemplos
- [ ] Comandos de instalación copy-paste listos
- [ ] Ejemplos de configuración con valores placeholder realistas pero seguros
- [ ] Sección de seguridad cubre los permisos reales que necesita el servidor
- [ ] Sin texto placeholder ("Lorem ipsum", "TODO", "your-value-here" sin contexto)
- [ ] Sidebar en `astro.config.mjs` coincide con archivos de contenido reales
- [ ] `custom.css` SOLO sets fonts (tondo, tondo-signage, aesthet-nova) — NO `--sl-color-*`
- [ ] Starlight base theme CSS completamente intacto
- [ ] Head override carga el Typekit stylesheet
- [ ] Theme toggle oculto (light only)
- [ ] Componentes Starlight usados correctamente
