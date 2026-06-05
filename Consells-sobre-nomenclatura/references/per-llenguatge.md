# Conveni per llenguatge / tecnologia

Aquesta és una extensió de la taula del SKILL.md. Aquí trobaràs les particularitats de cada tecnologia que la regla general no cobreix.

---

## C# / .NET

### Identificadors

```csharp
// ✅ Correcte
public class OrderService
{
    private readonly ILogger<OrderService> _logger;
    public async Task<IReadOnlyList<OrderDto>> GetActiveByCustomerAsync(
        int customerId, CancellationToken ct = default) { ... }
}

// ❌ Incorrecte — no compila o no és l'estàndard
public class ServeiComanda  // classe en català
{
    private readonly ILogger<ServeiComanda> _logger;
    public async Task<IReadOnlyList<OrderDto>> ObtenirActivesPerClientAsync(
        int idClient, CancellationToken ct = default) { ... }
}
```

### Namespaces

```csharp
// ✅ Estructura per funcionalitat, no per idioma
namespace Company.Product.Orders;        // ✅
namespace Empresa.Producte.Comandes;     // ❌
```

### Atributs i constants

```csharp
[Route("api/orders")]                    // ✅ ruta API en anglès
[Route("api/comandes")]                   // ❌

public const int MaxRetries = 3;          // ✅
public const int MaxReintents = 3;        // ❌

[Description("Order status")]            // ✅ atribut en anglès
[Description("Estat de la comanda")]     // ❌
```

### Recursos localitzats (`.resx`)

```
Resources/
├── SharedResource.resx              (clau, sense traduir)
├── SharedResource.ca.resx           (català, per defecte)
├── SharedResource.es.resx           (espanyol)
└── SharedResource.en.resx           (anglès)
```

```xml
<!-- SharedResource.resx — les claus van en anglès, sense accents -->
<data name="OrderNotFound" xml:space="preserve">
  <value>Order not found</value>  <!-- fallback en anglès -->
</data>
```

```xml
<!-- SharedResource.ca.resx -->
<data name="OrderNotFound" xml:space="preserve">
  <value>Comanda no trobada</value>
</data>
```

```xml
<!-- SharedResource.es.resx -->
<data name="OrderNotFound" xml:space="preserve">
  <value>Pedido no encontrado</value>
</data>
```

```csharp
// Ús correcte al codi
return Result<Order>.Failure(localizer["OrderNotFound", orderId]);
// → "Comanda no trobada" si la cultura és ca-ES
// → "Pedido no encontrado" si la cultura és es-ES
```

---

## TypeScript / JavaScript

### Identificadors

```typescript
// ✅ Correcte
export class OrderService {
  async getActiveByCustomer(customerId: number, ct?: AbortSignal): Promise<OrderDto[]> { ... }
}

// ❌ Incorrecte
export class ServeiComanda {
  async obtenirActivesPerClient(idClient: number, ct?: AbortSignal): Promise<OrderDto[]> { ... }
}
```

### `package.json` i dependències

```json
{
  "name": "@company/order-service",     // ✅ kebab-case anglès
  "version": "1.0.0",
  "description": "Order management service"  // ✅ descripció breu en anglès
}
```

### i18n libraries (i18next, react-intl, vue-i18n)

```typescript
// ✅ Claus en anglès
i18n.t('order.notFound', { orderId: 42 })
i18n.t('order.cancelledSuccessfully')

// ❌ Claus en català
i18n.t('comanda.noTrobada', { orderId: 42 })
```

```json
// ca.json
{
  "order": {
    "notFound": "Comanda no trobada",
    "cancelledSuccessfully": "Comanda cancel·lada correctament"
  }
}
```

```json
// es.json
{
  "order": {
    "notFound": "Pedido no encontrado",
    "cancelledSuccessfully": "Pedido cancelado correctamente"
  }
}
```

---

## SQL

### DDL

```sql
-- ✅ Taules i columnes en anglès
CREATE TABLE dbo.Orders (
    Id           INT            IDENTITY(1,1) NOT NULL,
    CustomerId   INT            NOT NULL,
    Code         NVARCHAR(20)   NOT NULL,
    Status       TINYINT        NOT NULL,
    Created      DATETIME2(3)   NOT NULL CONSTRAINT DF_Orders_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED (Id)
);

CREATE INDEX IX_Orders_CustomerId_Created ON dbo.Orders (CustomerId, Created DESC);

-- ❌ No crear taules en català
CREATE TABLE dbo.Comandes (
    Identificador INT IDENTITY(1,1) NOT NULL,
    -- ...
);
```

### Comentaris SQL

```sql
-- 🟧 Comentari en català
-- Aquesta query retorna les comandes actives dels últims 30 dies.
-- S'utilitza al dashboard principal.
SELECT
    o.Id,
    o.Code,
    o.Amount,
    o.Created
FROM dbo.Orders o WITH (NOLOCK)
WHERE o.Status = 1  -- Active
  AND o.Created >= DATEADD(DAY, -30, SYSUTCDATETIME())
ORDER BY o.Created DESC;
```

### Noms de stored procedures

```sql
-- ✅ Schema + verb + entitat, en anglès
CREATE PROCEDURE dbo.usp_GetActiveOrdersByCustomer
    @CustomerId INT,
    @FromDate   DATETIME2(3) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT Id, Code, Amount, Status, Created
    FROM   dbo.Orders
    WHERE  CustomerId = @CustomerId
      AND  Status = 1
      AND  (@FromDate IS NULL OR Created >= @FromDate)
    ORDER  BY Created DESC;
END;

-- ❌ No en català
CREATE PROCEDURE dbo.psc_ObtenirComandesActivesPerClient ...
```

---

## Python

```python
# ✅ Correcte
class OrderService:
    def __init__(self, db_session_factory: Callable) -> None:
        self._factory = db_session_factory

    async def get_active_by_customer(
        self, customer_id: int, ct: CancellationToken = None
    ) -> list[OrderDto]:
        ...

# ❌ Incorrecte
class ServeiComanda:
    def obtenir_actives_per_client(self, id_client: int) -> list[OrderDto]:
        ...
```

### Noms de mòduls i fitxers

```
order_service.py            # ✅ snake_case en anglès
models/
├── order.py
├── customer.py
└── order_line.py

# ❌ No
servei_comandes.py
models/
├── comanda.py
├── client.py
└── linia_comanda.py
```

### `pyproject.toml` / `setup.py`

```toml
[project]
name = "company-order-service"     # ✅
version = "1.0.0"
description = "Order management service"
```

---

## Go

```go
// ✅ Correcte
package orders

type OrderService struct {
    db *sql.DB
    log *slog.Logger
}

func (s *OrderService) GetActiveByCustomer(ctx context.Context, customerID int) ([]OrderDTO, error) {
    // ...
}

// ❌ Incorrecte
package comandes

type ServeiComanda struct { ... }
```

---

## Git

### Branches

```bash
# ✅ Tipus + àmbit, en anglès
feature/order-cancel
feature/blazor-server-quickgrid
fix/ef-tracking-leak
fix/null-customer-id
chore/update-dapper-2-1
docs/add-localization-guide
refactor/extract-order-validator
test/add-dapper-integration-tests

# ❌ No en català
funcionalitat/cancelar-comanda
correccio/fuga-tracking-ef
```

### Commit messages (Conventional Commits)

```bash
# ✅ Tipus + àmbit + subject en anglès, cos opcional
feat(orders): add bulk cancel endpoint
fix(ef): dispose DbContext on circuit end
chore(deps): bump Dapper to 2.1.35
docs(readme): add English setup section
refactor(orders): extract validator to OrderValidator
test(dapper): add integration tests for multi-mapping
perf(orders): cache active orders list with HybridCache
style(blazor): fix indentation in OrderList.razor
build(ci): pin SDK to 10.0.300 in global.json
ci(github): add health check workflow

# ❌ No
feat(comandes): afegir endpoint cancel·lació massiva
fix(ef): disposar DbContext al final del circuit
```

### Tags

```bash
# ✅ Versions semàntiques
v1.0.0
v1.4.2
v1.5.0-rc.1
release-2026-06

# ❌ No
v1.0.0-versió-inicial
```

### Títols de PR

```markdown
# ✅ Anglès, curt, descriptiu
Fix null reference in OrderService.GetById
Add HybridCache to OrderService.GetActiveByCustomer
Refactor: extract OrderValidator
Bump Dapper to 2.1.35

# ❌ No en català
Corregir referència nul·la a OrderService.GetById
```

---

## JSON / API contracts

```json
// ✅ Noms de propietat en anglès (camelCase o snake_case segons el que consumeixis)
{
  "orderId": 42,
  "customerId": 7,
  "code": "ORD-001",
  "amount": 99.95,
  "status": "active",
  "createdAt": "2026-06-05T10:30:00Z"
}

// ❌ No en català
{
  "identificadorComanda": 42,
  "codi": "ORD-001",
  "estat": "activa"
}
```

**Excepció**: APIs internes que **mai** sortiran del vostre ecosistema i el client és 100% català — pot ser acceptable. Però per defecte, anglès.

### OpenAPI / Swagger

```yaml
# ✅ Anglès
paths:
  /api/orders:
    get:
      summary: Get active orders
      parameters:
        - name: customerId
          in: query
          schema:
            type: integer

# ❌ No
paths:
  /api/comandes:
    get:
      summary: Obtenir comandes actives
```

---

## HTML / CSS

```html
<!-- ✅ Classes CSS en anglès, kebab-case -->
<button class="btn btn-primary order-cancel-button">Cancel order</button>

<!-- ❌ No -->
<button class="botó botó-primari botó-cancel·lar-comanda">Cancel·lar comanda</button>
```

```css
/* ✅ Anglès */
.order-cancel-button {
    background-color: var(--danger-500);
}

/* ❌ No */
.botó-cancel·lar-comanda { ... }
```

> BEM, Tailwind, Bootstrap — tot és en anglès. No reinventis la roda.

---

## Variables d'entorn i configuració

```bash
# ✅ En anglès, UPPER_SNAKE_CASE
CONNECTION_STRING=Server=localhost;Database=OrdersDb;...
LOG_LEVEL=Information
FEATURE_FLAG_NEW_BILLING=true
HYBRID_CACHE_DEFAULT_EXPIRATION_SECONDS=300

# ❌ No
CADENA_CONNEXIO=...
NIVELL_LOG=...
```

```json
// appsettings.json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;..."
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

---

## Resum visual

```
┌─────────────────────────────────────────────────────────────┐
│  Tècnica          │ Anglès                    │ Català       │
├─────────────────────────────────────────────────────────────┤
│  C# / .NET        │ TOT                         │ només comentaris │
│  TypeScript       │ TOT                         │ només comentaris │
│  SQL              │ noms (taules, cols, sp)     │ comentaris      │
│  Python           │ TOT                         │ només comentaris │
│  Go               │ TOT                         │ només comentaris │
│  Git              │ branches, commits, tags     │ —               │
│  JSON / API       │ keys                        │ —               │
│  HTML / CSS       │ classes, ids                │ —               │
│  Env vars         │ TOT                         │ —               │
│  Log messages     │ TOT                         │ —               │
│  Comentaris       │ —                           │ TOT             │
│  README / wiki    │ —                           │ TOT             │
│  Textos UI        │ —                           │ TOT (via .resx) │
│  Missatges user   │ —                           │ TOT (via localizer) │
└─────────────────────────────────────────────────────────────┘
```

Si la teva tecnologia no és a la taula, aplica la regla del SKILL.md: **anglès si ho llegeix una màquina, català si ho llegeix una persona**.
