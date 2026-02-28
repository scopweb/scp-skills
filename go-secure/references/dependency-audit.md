# Dependency Audit Guide

Referencia para evaluar librerías externas en proyectos Go. Cargar cuando el usuario
pida añadir una dependencia, auditar `go.mod`, o cuando debas decidir si usar una lib externa.

---

## Principio Fundamental

> "A little copying is better than a little dependency." — Go Proverbs

Si solo necesitas 1-3 funciones de una librería, **copia e internaliza el código** en lugar
de añadir la dependencia. Esto elimina vectores de ataque de supply chain y reduce superficie.

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
¿Cuántas líneas de código serían si lo implemento yo?
¿La stdlib cubre alguna parte de esto?
```

**Regla de las 200 líneas**: Si internalizar el código requiere < 200 líneas, hazlo.

### Paso 2: Verificar vulnerabilidades conocidas

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
govulncheck -json ./... | jq '.vulnerability'
```

También consultar:
- https://pkg.go.dev/vuln/
- https://osv.dev/
- https://github.com/advisories

### Paso 3: Analizar actividad del repositorio

```bash
gh api repos/{owner}/{repo} --jq '.pushed_at'
gh issue list -R {owner}/{repo} --state open --limit 10
```

### Paso 4: Revisar dependencias transitivas

```bash
go mod graph
go list -m -json all | jq 'select(.Indirect == false)'
go mod tidy
```

---

## Decisión: Usar vs Internalizar

### Internalizar cuando:

- Solo se necesitan 1-3 funciones
- El código es < 200 líneas
- Sin actualizaciones en > 6 meses
- Tiene CVEs conocidos
- Sus dependencias transitivas son problemáticas

### Cómo internalizar correctamente

```
1. Crear pkg/internal/<nombre-funcionalidad>/
2. Copiar solo las funciones necesarias
3. Añadir header: // Adapted from github.com/xxx/yyy (MIT License)
4. Añadir tests propios
5. Eliminar la dependencia del go.mod
```

### Usar dependencia externa cuando:

- Funcionalidad compleja que no vale internalizar (driver BD, cliente gRPC)
- Mantenimiento activo y score > 60
- Sin CVEs conocidos
- Stdlib no cubre el caso
- Estándar de facto en la comunidad

---

## Lista de Dependencias Permitidas (Pre-aprobadas)

| Librería | Uso | Razón |
|---------|-----|-------|
| `golang.org/x/crypto` | bcrypt, ed25519, x25519 | Official Go team |
| `golang.org/x/net` | HTTP/2, websockets | Official Go team |
| `google.golang.org/grpc` | gRPC | Google maintained |
| `github.com/jackc/pgx` | PostgreSQL driver | Mejor driver Go para Postgres |
| `go.uber.org/zap` | Logging estructurado | Uber, mantenimiento excelente |
| `github.com/spf13/cobra` | CLI apps | Estándar de facto |

---

## Lista de Librerías a Evitar

| Librería | Problema | Alternativa |
|---------|----------|------------|
| `github.com/dgrijalva/jwt-go` | CVE-2020-26160, abandonado | `github.com/golang-jwt/jwt` |
| `gopkg.in/yaml.v2` | Versión antigua | `gopkg.in/yaml.v3` |
| `github.com/satori/go.uuid` | Sin mantenimiento desde 2018 | `github.com/google/uuid` |
| Cualquier lib crypto no oficial | Supply chain risk | `crypto/...` stdlib |

---

## Plantilla de Justificación

```
Dependencia: github.com/xxx/yyy v1.2.3
Uso: [funciones exactas que se usan]
Alternativas evaluadas: [stdlib / internalizar / otras libs]
Por qué no internalizar: [razón]
Score de auditoría: [X/100]
- Último commit: [fecha]
- CVEs conocidos: [ninguno / lista]
- Mantenedor: [activo/inactivo]
- Licencia: [MIT/Apache/etc]
govulncheck: [PASS/issues encontrados]
```
