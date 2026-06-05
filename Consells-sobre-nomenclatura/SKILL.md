---
name: naming-i18n
description: >
  Conveni de nomenclatura per a projectes on l'equip parla català.
  Defineix què va en anglès (identificadors, BD, API, Git) i què va en
  català (comentaris, textos UI, missatges d'usuari, documentació interna).
  Usar quan: crear un projecte nou, revisar naming, configurar conveni
  d'equip, decidir idioma de comentaris/identificadors, definir .resx,
  redactar README o contributor guide.
  Triggers: nomenclatura, naming, conveni, català, comentaris, identificadors,
  noms en anglès, README, .resx, IStringLocalizer, log message, missatge
  d'error, branch name, commit message, DTO field, JSON field, columna BD,
  taula BD.
license: MIT
---

# Conveni de nomenclatura (Català a la fàbrica, Anglès al codi)

Regla d'or: **anglès per a tot allò que llegeix una màquina, català per a tot allò que llegeix una persona del teu equip**.

> Aquest skill és general. No depèn de cap llenguatge ni framework. És vàlid per a C#, TypeScript, Python, Go, Rust, SQL, JSON, Git — el que sigui.

## La regla en una frase

> *"Si no ho pot dir una variable del teu llenguatge sense queixar-se, va en anglès."*

C# no permet `ç`, `à`, `è` en identificadors (`QuantitatTotal` no compila). Per tant, **tot identificador va en anglès per força**. La resta és conveni.

---

## El gran llistat

### 🟦 Anglès (tècnics — els llegeix una màquina)

| Element | Per què anglès | Exemple |
|---------|----------------|---------|
| **Namespace** | ASCII, ecosistema .NET 100% anglès | `JocDeTruc.Comandes` |
| **Classe / interface** | Compilador, IDE, debugger, anàlisi estàtica | `OrderService`, `IOrderRepository` |
| **Mètode / propietat** | Mateix | `GetActiveByCustomerAsync` |
| **Paràmetre / variable local** | Mateix | `customerId`, `ct` |
| **Camp privat** | Conveni `_camelCase` ja és anglès | `_cache`, `_logger` |
| **Enum value** | Sovint es serialitza a JSON/URL/logs | `OrderStatus.Active` |
| **Constant** | Idem | `MaxRetries = 3` |
| **Nom de fitxer** | Paths ASCII per tooling (git, CI, scripts) | `OrderService.cs` |
| **Carpeta** | Idem | `Components/Pages/Orders/` |
| **Taula BD** | Collation, ordre, migracions, eines externes | `Orders`, `OrderLines` |
| **Columna BD** | Idem | `CustomerId`, `CreatedAt` |
| **Índex BD** | Idem | `IX_Orders_CustomerId_Created` |
| **DTO / JSON field** | Consumers internacionals, OpenAPI, codi gen. | `{ "orderId": 42, "code": "ORD-001" }` |
| **Branch git** | CI/CD, scripts, cerca global | `feature/order-cancel`, `fix/ef-tracking` |
| **Commit message** | Conveni de la indústria (Conventional Commits) | `fix: handle null customerId in OrderService` |
| **Tag git** | Releases, canvis | `v1.4.2`, `release-2026-06` |
| **Nom de NuGet package** | Ecosistema | `MyCompany.OrderService` |
| **Nom de variable d'entorn** | Config, scripts, CI | `ConnectionStrings__Default` |
| **Claim d'autenticació** | Tokens JWT, OpenID | `customer_id`, `tenant_id` |
| **URL slug / route** | SEO, APIs, estàndard web | `/orders/{id}/cancel` |

### 🟧 Català (humans — els llegeix una persona del teu equip)

| Element | Com fer-ho | Exemple |
|---------|------------|---------|
| **Comentari `//`** | Català directe | `// Comprova que el client existeix` |
| **Comentari `///` (XML doc)** | Català, frases completes | `<summary>Retorna les comandes actives...</summary>` |
| **README.md del projecte** | Català, excepte el tècnica universal | veure plantilla avall |
| **CONTRIBUTING.md** | Català | — |
| **Jira / Notion / Linear** | Català | `TICKET-1234: Afegir validació NIF` |
| **Wiki / documentació interna** | Català | — |
| **Email de l'equip** | Català | — |
| **Comentari en PR** | Català | — |
| **Code review (preguntes, suggeriments)** | Català | — |

### 🟨 Català via localització (text que veu l'usuari final)

| Element | Com fer-ho | Exemple |
|---------|------------|---------|
| **Text UI (botons, labels)** | `.resx` + `IStringLocalizer` | `L["SaveButton"]` → "Desar" |
| **Placeholder / hint** | Idem | `L["SearchPlaceholder"]` → "Cerca per codi..." |
| **Missatge d'error mostrat** | Idem | `L["OrderNotFound"]` → "Comanda no trobada" |
| **Toast / Snackbar** | Idem | — |
| **Email transaccional** | Plantilles + cultura | `ca-ES`, `es-ES`, `en-US` |
| **PDF / Excel generat** | Idem | — |

> Mai hardcodejar strings d'usuari directament al `.razor`. Sempre via `IStringLocalizer` o `@inject IStringLocalizer<...> L`. Veure el skill `blazor-dotnet10` secció "Localization Pattern".

### ⚪ Anglès (humans però amb conveni)

| Element | Per què anglès | Exemple |
|---------|----------------|---------|
| **Log message (text lliure)** | Eines centralitzades (Seq, App Insights, Datadog, ELK) — filtres i alerting assumeixen anglès | `"Order {Id} saved for customer {CustomerId}"` |
| **Títol de PR** | GitHub UI, cerca global, enllaços | `Fix null reference in OrderService.GetById` |
| **Tag de release** | Eines, scripts | `v1.4.2` (no `v1.4.2-corregit`) |
| **Clau de traducció (`.resx` key)** | Sovint apareix en logs, no pot tenir accents | `OrderNotFound`, `SaveButton` |

---

## Exemple realista complet

```csharp
// ✅ Tot en ordre — identificadors en anglès, comentaris en català,
//    missatges d'usuari localitzats, log en anglès estructurat.

namespace JocDeTruc.Comandes;  // 🟦 namespace en anglès

public sealed class OrderService(  // 🟦 classe en anglès
    IDbContextFactory<AppDbContext> factory,  // 🟦 paràmetre en anglès
    IStringLocalizer<OrderService> localizer,  // 🟦 per als missatges d'usuari
    ILogger<OrderService> logger)              // 🟦 logger en anglès
{
    /// <summary>
    /// Retorna les comandes actives d'un client, ordenades per data descendent.
    /// </summary>
    /// <param name="customerId">Identificador del client.</param>
    /// <param name="ct">Token de cancel·lació.</param>
    /// <remarks>
    /// Utilitza l'índex IX_Orders_CustomerId_Created. Si el client no existeix,
    /// retorna una llista buida (no llança excepció).
    /// </remarks>
    public async Task<IReadOnlyList<OrderDto>> GetActiveByCustomerAsync(
        int customerId, CancellationToken ct = default)
    {
        await using var ctx = await factory.CreateDbContextAsync(ct);

        var orders = await ctx.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId && o.Status == OrderStatus.Active)
            .OrderByDescending(o => o.Created)
            .ToListAsync(ct);

        // 🟧 comentari en català
        // Filtre addicional: ignora comandes esborrades lògicament.
        var filtered = orders.Where(o => !o.IsDeleted).ToList();

        // 🟦 log en anglès estructurat (per a Seq / App Insights)
        logger.LogDebug(
            "Found {OrderCount} active orders for customer {CustomerId}",
            filtered.Count, customerId);

        return filtered.Select(OrderDto.FromEntity).AsList();
    }

    public async Task<Result<Order>> CancelAsync(
        int orderId, string reason, CancellationToken ct = default)
    {
        var order = await LoadAsync(orderId, ct);
        if (order is null)
        {
            // 🟧 missatge d'usuari via localizer (català segons cultura del client)
            return Result<Order>.Failure(
                localizer["OrderNotFound", orderId]);
        }

        if (!order.CanBeCancelled)
        {
            return Result<Order>.FailureM(
                localizer["OrderCannotBeCancelled"],
                localizer["OrderStatusIs", order.Status]);
        }

        order.Cancel(reason, DateTime.UtcNow);
        await SaveAsync(order, ct);

        logger.LogInformation(
            "Order {OrderId} cancelled by reason {Reason}",
            orderId, reason);

        return Result<Order>.SuccessM(order, localizer["OrderCancelledOk"]);
    }
}
```

```sql
-- 🟦 BD en anglès (taules, columnes, índexs)
CREATE TABLE dbo.Orders (
    Id           INT            IDENTITY(1,1) NOT NULL,
    CustomerId   INT            NOT NULL,
    Code         NVARCHAR(20)   NOT NULL,
    Status       TINYINT        NOT NULL,  -- enum OrderStatus: 0=Pending, 1=Active, 2=Shipped, 3=Cancelled
    Amount       DECIMAL(18, 2) NOT NULL,
    Created      DATETIME2(3)   NOT NULL CONSTRAINT DF_Orders_Created DEFAULT SYSUTCDATETIME(),
    Modified     DATETIME2(3)   NULL,
    IsDeleted    BIT            NOT NULL CONSTRAINT DF_Orders_IsDeleted DEFAULT 0,
    CONSTRAINT PK_Orders PRIMARY KEY (Id),
    INDEX IX_Orders_CustomerId_Created (CustomerId, Created DESC)
);
```

---

## Cas especial: els logs

Els **log messages** divideixen l'opinió. Recomanació clara:

```csharp
// ❌ MAL — log en català, inconsistent amb eines de monitoring
logger.LogInformation("S'ha desat la comanda {OrderId} per al client {CustomerId}");
// filtre a Seq: "OrderId" — però el missatge és en català. Cerca trencada.

// ✅ BÉ — log en anglès estructurat
logger.LogInformation("Order {OrderId} saved for customer {CustomerId}", orderId, customerId);
// filtre a Seq: "OrderId saved for customer" — estable, independent de l'idioma.
```

**Excepció**: si el log és estrictament per a un equip 100% català-parlant i mai s'enviarà a una eina externa, pots posar-lo en català. Però al primer cop que compris Seq / App Insights / Datadog, t'ho repensaràs.

---

## Plantilla de README (a posar al primer commit de tot projecte nou)

```markdown
# Nom del projecte

[Descripció breu en català]

## Conveni de nomenclatura

Aquest projecte segueix el conveni del skill `naming-i18n`. En resum:

- **Codi** (classes, mètodes, variables, taules BD, JSON, branques, commits): **anglès**.
- **Comentaris** i **documentació interna** (XML docs, wiki, Jira): **català**.
- **Textos UI** i **missatges d'usuari**: **català**, via `IStringLocalizer` + `.resx`.
- **Log messages** (text lliure): **anglès** (per compatibilitat amb Seq / App Insights / ELK).

Si tens dubtes sobre si un nom concret va en anglès o en català, mira la
taula gran del skill o pregunta a l'equip.
```

---

## Quan trencar la regla

Casos on és acceptable (o recomanable) fer una excepció:

1. **Projecte 100% intern, sense reutilització, equip tancat i estable**
   — `Comanda.Servei.Desat()` és vàlid. Però a la primera de canvi
   (incorporació, publicació, integració externa), et trobaràs renegant.

2. **Variable de negoci molt local amb sentit difícil en anglès** —
   si el terme angles és ambigu, tradueix al català o crea un terme
   propi. Exemple: "rebut" potser és `Receipt` o `Voucher` segons el
   context; tria un i documenta'l al glosari del projecte.

3. **Tests d'integració que validen missatges literals d'usuari** —
   el test pot contenir el string esperat en català perquè és la
   font de veritat:
   ```csharp
   Assert.Equal("Comanda no trobada", result.Error);
   ```

4. **SQL de reporting one-off per a un departament concret** — el
   departament pot rebre el report amb els headers de columna en
   català, sempre que ho sàpiguen. No ho posis al codi font; exporta
   a CSV/XLSX.

---

## Referència ràpida (TL;DR)

```
Classes / mètodes / variables / propietats / camps  → 🇬🇧 anglès
Taules BD / columnes / índexs                        → 🇬🇧 anglès
DTOs / JSON fields / enums / constants               → 🇬🇧 anglès
Branches / commits / tags git                        → 🇬🇧 anglès
Log messages (text lliure)                           → 🇬🇧 anglès
Comentaris // i ///                                  → 🟧 català
README / wiki / Jira                                 → 🟧 català
Textos UI (botons, labels, placeholders)             → 🟧 català (via .resx)
Missatges d'error / toast                            → 🟧 català (via IStringLocalizer)
```

---

## Com aplicar-ho a un projecte existent (passes)

1. **Crear el README** amb el conveni (1 hora).
2. **Decidir què fer amb el codi antic**:
   - Deixar-ho (cas més comú — el cost de renombrar supera el benefici).
   - Renombrar progressivament quan toquis aquella zona.
   - Configurar `dotnet format` / `eslint --fix` per anar corregint.
3. **Configurar `.editorconfig`** per forçar conveni local:
   ```ini
   [*.cs]
   # No permetre comentaris buits o amb TODO sense context
   # ...
   ```
4. **Configurar hooks de pre-commit** que validin missatges de commit en anglès:
   ```bash
   # .husky/commit-msg
   if ! grep -qE "^(feat|fix|chore|docs|refactor|test|perf|style|build|ci)(\(.+\))?: " "$1"; then
     echo "Commit message must follow Conventional Commits (English)"
     exit 1
   fi
   ```
5. **Crear `.resx` per defecte** (`.ca.resx`) — pot ser un sol idioma al principi, l'estructura ja està.

---

## Cross-references

- Skill `blazor-dotnet10` — secció **Localization Pattern** (com usar `IStringLocalizer` a Blazor).
- Skill `blazor-security-audit` — claims d'autenticació en anglès (convention).
- Qualsevol skill d'un llenguatge concret pot incloure un parell de línies recordant aquest conveni.
