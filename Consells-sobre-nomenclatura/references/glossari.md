# Glossari: termes catalans → anglesos

Llista de termes de negoci habituals amb la traducció anglesa recomanada. Si el teu projecte introdueix un concepte nou que no és aquí, afegeix-lo al glosari del projecte.

## Domini genèric

| Català | Anglès recomanat | Notes |
|--------|------------------|-------|
| comanda, ordre, encàrrec | **order** | "order" és l'estàndard en e-commerce / ERP |
| línia de comanda | **order line** o **line item** | "order line" és més comú |
| client, comprador | **customer** | mai "client" (pot confondre amb client HTTP) |
| producte, article | **product** | "item" massa genèric |
| magatzem, dipòsit | **warehouse** | — |
| estoc, inventari | **stock** o **inventory** | "stock" UK/AU, "inventory" US |
| factura, rebut | **invoice** / **receipt** | compte! no confondre |
| albarà | **delivery note** o **waybill** | "albarà" no té traducció directa |
| pressupost | **quote** o **estimate** | — |
| proveïdor | **supplier** o **vendor** | — |
| empleat, treballador | **employee** | mai "worker" (pot confondre amb processos) |
| usuari | **user** | — |
| comptat, al comptat | **cash** o **upfront** | — |
| a terminis, aplaçat | **on credit** / **installments** | "installments" US, "instalments" UK |

## Estat i accions

| Català | Anglès recomanat |
|--------|------------------|
| pendent | **pending** |
| confirmat | **confirmed** |
| enviat, tramès | **shipped** / **sent** |
| entregat | **delivered** |
| cancel·lat, anul·lat | **cancelled** (UK) / **canceled** (US) |
| retornat, tornat | **returned** |
| reemborsat | **refunded** |
| bloquejat | **blocked** o **on hold** |
| actiu | **active** |
| inactiu, desactivat | **inactive** o **disabled** |
| esborrat | **deleted** (soft delete) / **removed** (hard delete) |
| arxivat | **archived** |
| publicat | **published** |
| esborrany | **draft** |

## Dates i temps

| Català | Anglès recomanat |
|--------|------------------|
| data de creació | **created at** / **creation date** |
| data de modificació | **modified at** / **last modified** |
| data d'inici | **start date** o **starts at** |
| data de fi | **end date** o **ends at** |
| venciment | **due date** o **expires at** |
| caducitat | **expiration date** o **expires at** |
| durada | **duration** |

## Errors i validació

| Català | Anglès recomanat |
|--------|------------------|
| no trobat | **not found** |
| no autoritzat | **unauthorized** (401) |
| prohibit | **forbidden** (403) |
| conflicte | **conflict** (409) |
| error intern | **internal error** (500) |
| no disponible | **unavailable** (503) |
| temps d'espera esgotat | **timeout** |
| error de validació | **validation error** |
| camp obligatori | **required** o **required field** |
| valor invàlid | **invalid** |
| massa llarg | **too long** |
| massa curt | **too short** |
| ja existeix | **already exists** o **duplicate** |

## Comptes i finances

| Català | Anglès recomanat |
|--------|------------------|
| compte | **account** |
| saldo | **balance** |
| càrrec, deure | **debit** |
| abonament, haver | **credit** |
| transferència | **transfer** |
| devolució | **refund** |
| descompte | **discount** |
| IVA | **VAT** (UK) o **tax** (US) |
| import | **amount** |
| subtotal | **subtotal** |
| total | **total** |
| moneda | **currency** |
| tipus de canvi | **exchange rate** |

## UI / navegació

| Català | Anglès recomanat |
|--------|------------------|
| inici, pàgina principal | **home** / **dashboard** |
| configuració | **settings** / **configuration** |
| perfil | **profile** |
| cerca | **search** |
| filtre | **filter** |
| ordenar | **sort** |
| nou | **new** / **create** |
| desar | **save** |
| cancel·lar | **cancel** |
| eliminar | **delete** |
| editar | **edit** |
| veure, mostrar | **view** / **show** |
| amagar | **hide** |
| tornar | **back** |
| següent | **next** |
| anterior | **previous** |
| acceptar | **accept** / **ok** |

## Adreça i geografia

| Català | Anglès recomanat |
|--------|------------------|
| adreça, direcció | **address** |
| carrer | **street** |
| número | **number** |
| pis | **floor** / **apartment** |
| porta | **door** / **unit** |
| codi postal | **postal code** (US) / **postcode** (UK) / **ZIP code** |
| ciutat | **city** |
| província, departament | **state** (US) / **province** (CA) / **region** |
| país | **country** |

## Comunicacions

| Català | Anglès recomanat |
|--------|------------------|
| correu electrònic | **email** |
| telèfon | **phone** |
| mòbil | **mobile** o **cell phone** |
| WhatsApp / SMS | **WhatsApp** / **SMS** |
| notificació | **notification** |
| alerta | **alert** |
| avís | **notice** / **announcement** |

## Termes que NO existeixen en anglès (cal inventar o mantenir)

Alguns termes són genuïnament locals. Opcions:

1. **Adaptar al so**: `albara` → `albara` (uncommon, no recomanable)
2. **Crear terme propi**: `albara` → `deliveryNote` (recomanable si el projecte ho documenta)
3. **Usar el terme genuí en anglès**: `albara` → `waybill` o `packing slip` (segons el context real)

> Regla: si un terme no té traducció universal, **documenta la tria al glosari del projecte** (un fitxer `docs/GLOSSARY.md` o secció al README). Així tothom sap què vol dir cada cosa.

---

## Plantilla de glosari per projecte

```markdown
# Glossary

| Català | English | Definition | First seen in |
|--------|---------|------------|---------------|
| albarà  | deliveryNote | Document that accompanies a shipment listing its contents | `OrderService.cs` |
| rebut   | receipt    | Proof of payment issued at point of sale | `PaymentService.cs` |
| remesa  | remittance | A batch of payments submitted together | `BankReconciliation.cs` |
```

Quan algú nou entra a l'equip, llegeix el glossari abans de posar-se a programar.
