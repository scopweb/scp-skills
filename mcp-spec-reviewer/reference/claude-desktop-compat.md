# Claude Desktop Compatibility

**Last verified**: 2025-11 (Claude Desktop ~0.10.x)
**Scope**: Particularidades de Claude Desktop como host MCP — útil para validar si un servidor será compatible.

---

## Transport: solo stdio

Claude Desktop **solo soporta stdio**. No soporta Streamable HTTP ni HTTP+SSE.

| Implicación | Detalle |
|-------------|---------|
| El servidor debe lanzarse como subprocess | Claude Desktop lo arranca con el comando configurado |
| No sirve exponer un puerto HTTP | Claude Desktop no se conectará |
| Servidores remotos/cloud no son compatibles directamente | Requieren un wrapper stdio local |

**Validación**: Si un servidor solo implementa Streamable HTTP → ⚠️ **No compatible con Claude Desktop**.

---

## Protocol Version

Claude Desktop negocia versiones. Versión conocida en uso: `2025-11-25` (versiones recientes) o `2025-06-18` (versiones anteriores).

**Patrón recomendado**: el servidor debe aceptar la `protocolVersion` que el cliente envía en `initialize` o responder con la más alta que soporte en common:

```json
// Cliente envía:
{ "protocolVersion": "2025-11-25" }

// Servidor responde con la misma versión (o la más alta que soporte):
{ "protocolVersion": "2025-11-25" }
```

**Validación**: Si el servidor fija una versión sin aceptar negociación → ⚠️ **Riesgo de fallo con versiones distintas de Claude Desktop**.

---

## Configuración: claude_desktop_config.json

Ubicación del archivo de configuración:

| OS | Ruta |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### Estructura

```json
{
  "mcpServers": {
    "nombre-servidor": {
      "command": "node",
      "args": ["/ruta/al/servidor/index.js"],
      "env": {
        "API_KEY": "valor"
      }
    }
  }
}
```

Campos:

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `command` | ✅ | Ejecutable (node, python, go binary, npx…) |
| `args` | — | Array de argumentos |
| `env` | — | Variables de entorno adicionales |

**Nota**: Claude Desktop hereda el PATH del sistema, pero puede diferir del shell interactivo. Usar rutas absolutas en `command`/`args` es más fiable.

---

## Capacidades habilitadas en Claude Desktop

Claude Desktop como host generalmente declara soporte para:

- **Roots** (`roots.listChanged`) — puede enviar listas de raíces al servidor
- **Sampling** — puede o no estar disponible según versión

**Validación**: No asumir que el host soporta sampling si el servidor lo requiere; verificar capacidades negociadas en `initialize`.

---

## Restricciones conocidas

| Restricción | Impacto |
|-------------|---------|
| Solo stdio | Servidores HTTP no conectan |
| Sin hot-reload de config | Hay que reiniciar Claude Desktop tras cambiar `claude_desktop_config.json` |
| stderr visible en logs de Claude Desktop | Útil para debugging; no usar stdout para logs |
| Timeout en initialize | Servidores lentos en arrancar pueden fallar la conexión |

---

## Checklist rápido: ¿Mi servidor es compatible con Claude Desktop?

- [ ] Implementa transporte **stdio**
- [ ] Acepta negociación de `protocolVersion` (echo del cliente o fallback gracioso)
- [ ] No escribe contenido no-MCP en **stdout**
- [ ] Usa **stderr** para logging
- [ ] Arranca rápido (initialize no hace llamadas lentas síncronas)
- [ ] No requiere capacidades del host que Claude Desktop pueda no soportar (ej: sampling)
