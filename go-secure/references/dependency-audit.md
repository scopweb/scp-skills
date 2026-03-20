# Dependency Audit Guide

Referencia para evaluar librerías externas en proyectos Go 1.26. Cargar cuando el usuario
pida añadir una dependencia, auditar `go.mod`, o cuando debas decidir si usar una lib externa.

---

## Principio Fundamental

> "A little copying is better than a little dependency." — Go Proverbs

Si solo necesitas 1-3 funciones de una librería, **copia e internaliza el código** en lugar
de añadir la dependencia. Esto elimina vectores de ataque de supply chain y reduce superficie.

**Antes de buscar una librería, comprueba stdlib Go 1.26:**
- Logging estructurado → `log/slog` (1.21+)
- Operaciones sobre slices → `slices` (1.21+)
- Operaciones sobre maps → `maps` (1.21+)
- Comparación genérica → `cmp` (1.21+)
- Números aleatorios no-crypto → `math/rand/v2` (1.22+)
- Iteradores → `iter` (1.23+)
- HTTP routing con métodos → `http.ServeMux` mejorado (1.22+)

---

## Criterios de Evaluación (Score)

Evalúa cada dependencia con esta tabla. Score < 60 → **rechazar o internalizar**.

| Criterio | Puntos | Evaluación |
|----------|--------|-----------|
| Último commit < 6 meses | 25 | Mantenimiento activo |
| Último commit 6-12 meses | 10 | Mantenimiento lento |
| Último commit > 12 meses | -20 | Sin mantenimiento |
| Mantenedor activo (responde issues) | 15 | Confiabilidad |
| Sin CVEs en últimos 2 años | 20 | Historial de seguridad |
| CVE resuelto en < 30 días | 5 | Respuesta rápida |
| CVE sin resolver | -30 | Riesgo activo |
| > 1000 GitHub stars | 10 | Adopción comunitaria |
| Tests coverage > 70% | 10 | Calidad del código |
| Licencia compatible (MIT/Apache/BSD) | 10 | Sin problemas legales |
| Dependencias transitivas < 5 | 5 | Superficie mínima |

---

## Proceso de Auditoría

### Paso 1: Verificar necesidad real

```
¿Qué funciones específicas necesito de esta librería?
¿La stdlib de Go 1.26 ya lo cubre? (slices, maps, slog, math/rand/v2, iter...)
¿Cuántas líneas de código serían si lo implemento yo?
```

**Regla de las 200 líneas**: Si internalizar el código requiere < 200 líneas, hazlo.

### Paso 2: Verificar vulnerabilidades conocidas

```bash
# Instalar govulncheck
go install golang.org/x/vuln/cmd/govulncheck@latest

# Auditar el proyecto
govulncheck ./...

# Verificar una dep específica
govulncheck -json ./... | jq '.vulnerability'
```

También consultar manualmente:
- https://pkg.go.dev/vuln/ — Base de datos oficial de vulnerabilidades Go
- https://osv.dev/ — Open Source Vulnerabilities
- https://github.com/advisories — GitHub Advisory Database

### Paso 3: Analizar actividad del repositorio

```bash
# Verificar fecha del último commit
gh api repos/{owner}/{repo} --jq '.pushed_at'

# Ver issues abiertos y tiempo de respuesta
gh issue list -R {owner}/{repo} --state open --limit 10
```

### Paso 4: Revisar dependencias transitivas

```bash
# Ver árbol completo de dependencias
go mod graph

# Dependencias directas solamente
go list -m -json all | jq 'select(.Indirect == false)'

# Limpiar deps no usadas
go mod tidy
```

---

## Decisión: Usar vs Internalizar

### Internalizar cuando:

- Solo se necesitan 1-3 funciones
- El código es < 200 líneas
- La librería no se ha actualizado en > 6 meses
- Tiene CVEs conocidos
- Sus dependencias transitivas son problemáticas
- **La stdlib de Go 1.26 ya ofrece esa funcionalidad**

### Cómo internalizar correctamente

```
1. Crear pkg/internal/<nombre-funcionalidad>/
2. Copiar solo las funciones necesarias
3. Añadir header con origen: // Adapted from github.com/xxx/yyy (MIT License)
4. Añadir tests propios
5. Eliminar la dependencia del go.mod
```

Ejemplo:

```go
// pkg/internal/slugify/slugify.go
// Adapted from github.com/gosimple/slug (MIT License)
// Only slug.Make() function extracted to avoid full dependency

package slugify

import (
    "regexp"
    "strings"
    "unicode"
    "golang.org/x/text/unicode/norm"
)

var re = regexp.MustCompile(`[^a-z0-9-]`)

// Make converts a string to a URL-friendly slug.
func Make(s string) string {
    s = strings.ToLower(s)
    s = norm.NFD.String(s)
    s = strings.Map(func(r rune) rune {
        if unicode.IsMark(r) {
            return -1
        }
        return r
    }, s)
    s = re.ReplaceAllString(s, "-")
    s = strings.Trim(s, "-")
    return s
}
```

### Usar dependencia externa cuando:

- Es funcionalidad compleja que no vale internalizar (ej: driver de BD, cliente gRPC)
- Tiene mantenimiento activo y score > 60
- Sin CVEs conocidos
- La alternativa stdlib no existe ni en Go 1.26
- La comunidad la considera estándar de facto

---

## Lista de Dependencias Permitidas (Pre-aprobadas)

| Librería | Uso | Razón |
|---------|-----|-------|
| `golang.org/x/crypto` | bcrypt, ed25519, x25519 | Official Go team, stdlib extension |
| `golang.org/x/net` | HTTP/2, websockets avanzados | Official Go team |
| `google.golang.org/grpc` | gRPC servers/clients | Google maintained, estándar de facto |
| `github.com/jackc/pgx` | PostgreSQL driver | Mejor driver Go para Postgres, activo |
| `github.com/spf13/cobra` | CLI apps complejas | Estándar de facto para CLIs |

> **Nota**: `go.uber.org/zap` ya **no es necesario** para la mayoría de casos.
> Usar `log/slog` (stdlib desde Go 1.21). Solo justificar zap si se necesita
> rendimiento extremo con millones de logs/seg y benchmarks que lo demuestren.

---

## Lista de Librerías a Evitar

| Librería | Problema | Alternativa |
|---------|----------|------------|
| `github.com/dgrijalva/jwt-go` | CVE-2020-26160, abandonado | `github.com/golang-jwt/jwt` |
| `gopkg.in/yaml.v2` | Versión antigua | `gopkg.in/yaml.v3` |
| `github.com/satori/go.uuid` | Sin mantenimiento desde 2018 | `github.com/google/uuid` |
| `math/rand` (legado) | Deprecado, predecible | `math/rand/v2` (stdlib Go 1.22+) |
| `go.uber.org/zap` | Innecesario en la mayoría de casos | `log/slog` (stdlib Go 1.21+) |
| Cualquier lib crypto no oficial | Supply chain risk | `crypto/...` stdlib |

---

## Plantilla de Justificación

Cuando añadas una dependencia, documenta en el PR/commit:

```
Dependencia: github.com/xxx/yyy v1.2.3
Uso: [qué funciones exactas se usan]
¿Stdlib Go 1.26 lo cubre? [sí/no — razona]
Alternativas evaluadas: [internalizar / otras libs]
Por qué no internalizar: [razón]
Score de auditoría: [X/100]
- Último commit: [fecha]
- CVEs conocidos: [ninguno / lista]
- Mantenedor: [activo/inactivo]
- Licencia: [MIT/Apache/etc]
govulncheck: [PASS/issues encontrados]
```
