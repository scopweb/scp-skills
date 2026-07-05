# Web Vulnerabilities — Blazor Server .NET 10

## Table of Contents

1. [XSS (Cross-Site Scripting)](#xss)
2. [CSRF (Cross-Site Request Forgery)](#csrf)
3. [CORS](#cors)
4. [Content Security Policy (CSP)](#content-security-policy)
5. [Clickjacking](#clickjacking)
6. [Input Validation](#input-validation)
7. [SQL Injection](#sql-injection)
8. [Open Redirect](#open-redirect)
9. [Path Traversal, File Handling & IDOR](#path-traversal-file-handling--idor)

---

## XSS

Blazor Server mitigates most XSS by default — Razor components encode output automatically. However, vulnerabilities exist in:

### Dangerous patterns to audit

```razor
<!-- ❌ CRITICAL: Raw HTML rendering — XSS if userContent is unvalidated -->
@((MarkupString)userContent)

<!-- ❌ HIGH: JS interop with user data -->
@inject IJSRuntime JS
@code {
    await JS.InvokeVoidAsync("eval", userInput); // NEVER
    await JS.InvokeVoidAsync("setInnerHTML", elementId, userInput); // NEVER
}

<!-- ❌ MEDIUM: NavigationManager with user input -->
NavigationManager.NavigateTo(userProvidedUrl); // Open redirect
```

### Safe patterns

```razor
<!-- ✅ Default Razor encoding — safe -->
<p>@userContent</p>

<!-- ✅ If raw HTML needed, sanitize first -->
@inject IHtmlSanitizer Sanitizer
@((MarkupString)Sanitizer.Sanitize(userContent))

<!-- ✅ JS interop with safe methods -->
await JS.InvokeVoidAsync("setTextContent", elementId, userInput);
```

### HTML Sanitization (if raw HTML is required)

```csharp
// Install: dotnet add package HtmlSanitizer
builder.Services.AddScoped<IHtmlSanitizer>(_ =>
{
    var sanitizer = new HtmlSanitizer();
    sanitizer.AllowedTags.Clear();
    sanitizer.AllowedTags.Add("p");
    sanitizer.AllowedTags.Add("br");
    sanitizer.AllowedTags.Add("strong");
    sanitizer.AllowedTags.Add("em");
    // No script, iframe, object, embed, form
    return sanitizer;
});
```

### Custom JS / wwwroot scripts (and MVC/Vue mixed apps)

Blazor's auto-encoding does NOT protect HTML you build yourself in JS interop or `wwwroot` scripts. Audited holes: jQuery `.html(...)`, `el.innerHTML = ...`, Vue `v-html`, and `@Html.Raw(...)` in `.cshtml` — all fed server/DB data (a document named `<img src=x onerror=alert(1)>.pdf` executes on render).

```js
// ❌ el.innerHTML = data.nombre;      $(el).html(data.nombre);
// ✅ el.textContent = data.nombre;    $(el).text(data.nombre);   // or an escapeHtml() helper
```

Treat any `@Html.Raw`, `(MarkupString)`, or `v-html` fed by editable data as XSS until proven sanitized.

### Audit commands

```bash
# Search for raw HTML rendering
grep -rn "MarkupString" --include="*.razor" --include="*.cs" .

# Search for dangerous JS interop
grep -rn "eval\|innerHTML\|document\.write" --include="*.js" --include="*.razor" .

# Search for NavigateTo with variables
grep -rn "NavigateTo(" --include="*.razor" --include="*.cs" .
```

---

## CSRF

Blazor Server uses SignalR (WebSockets), which is inherently less vulnerable to CSRF than traditional form POST. However, protection is still needed for:

- Static SSR pages with forms
- Hybrid rendering modes
- API endpoints called from Blazor

### Antiforgery setup

```csharp
// Program.cs — antiforgery is automatic with AddRazorComponents
// Just ensure middleware order is correct:
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery(); // MUST be after auth, before endpoints
```

### In forms (automatic with EditForm)

```razor
<!-- ✅ EditForm includes antiforgery token automatically -->
<EditForm Model="_model" OnValidSubmit="Submit" FormName="myForm">
    <DataAnnotationsValidator />
    <!-- fields -->
</EditForm>

<!-- ❌ HTML form — no automatic antiforgery -->
<form method="post" action="/api/submit">
    <!-- Missing antiforgery token! -->
</form>
```

### For API endpoints called from Blazor

```csharp
// If you have minimal API endpoints alongside Blazor:
app.MapPost("/api/orders", [ValidateAntiForgeryToken] async (OrderDto dto) =>
{
    // process
});
```

---

## CORS

Blazor Server typically doesn't need CORS since everything runs same-origin. However, if CORS is globally enabled:

```csharp
// ✅ Disable CORS on Blazor hub specifically
app.MapBlazorHub().RequireCors(policy =>
    policy.WithOrigins("https://yourdomain.com"));

// ❌ DANGEROUS: Never use AllowAnyOrigin with credentials
builder.Services.AddCors(options =>
{
    options.AddPolicy("Dangerous", policy =>
        policy.AllowAnyOrigin()       // ← with this
              .AllowCredentials());    // ← this is blocked by browser, but shows intent issues
});

// ✅ Restrictive CORS for API endpoints
builder.Services.AddCors(options =>
{
    options.AddPolicy("ApiPolicy", policy =>
        policy.WithOrigins("https://yourdomain.com")
              .AllowAnyHeader()
              .WithMethods("GET", "POST")
              .AllowCredentials());
});
```

---

## Content Security Policy

CSP is a critical security header that prevents XSS, clickjacking, and data injection.

### Recommended CSP for Blazor Server

```csharp
// Middleware approach
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +  // Blazor needs inline styles
        "img-src 'self' data: https:; " +
        "font-src 'self'; " +
        "connect-src 'self' wss:; " +            // WebSocket for SignalR
        "frame-ancestors 'self'; " +              // Clickjacking protection
        "form-action 'self'; " +
        "base-uri 'self'; " +
        "object-src 'none'");
    await next();
});
```

**Notes:**
- `'unsafe-inline'` for styles is often needed by Blazor's rendering
- `'unsafe-eval'` should NEVER be needed — if it is, audit your JS interop
- `wss:` in connect-src allows SignalR WebSocket connections
- `frame-ancestors 'self'` replaces X-Frame-Options

### CSP via meta tag (alternative)

```html
<!-- In App.razor or _Host.cshtml -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

---

## Clickjacking

Prevent your app from being embedded in iframes on malicious sites:

```csharp
// Option 1: X-Frame-Options header
context.Response.Headers.Append("X-Frame-Options", "DENY");
// or "SAMEORIGIN" if you need same-origin iframes

// Option 2: CSP frame-ancestors (preferred, more flexible)
context.Response.Headers.Append("Content-Security-Policy",
    "frame-ancestors 'self'");

// Blazor's WebSocket compression adds frame-ancestors automatically
// but explicit is better than implicit
```

---

## Input Validation

### Server-side validation (mandatory)

```csharp
// ✅ Model with validation attributes
public sealed class OrderInput
{
    [Required(ErrorMessage = "Code is required")]
    [StringLength(20, MinimumLength = 3)]
    [RegularExpression(@"^[A-Z0-9-]+$", ErrorMessage = "Invalid format")]
    public string Code { get; set; } = string.Empty;

    [Range(0.01, 999999.99)]
    public decimal Amount { get; set; }

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}

// ✅ In service — always validate again (defense in depth)
public async Task<Result<Order>> CreateOrderAsync(OrderInput input, CancellationToken ct)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(input.Code);
    ArgumentOutOfRangeException.ThrowIfNegativeOrZero(input.Amount);

    // Sanitize
    var code = input.Code.Trim().ToUpperInvariant();
    // ...
}
```

### In Blazor forms

```razor
<EditForm Model="_input" OnValidSubmit="HandleSubmit" FormName="CreateOrder">
    <DataAnnotationsValidator />
    <ValidationSummary />

    <InputText @bind-Value="_input.Code" />
    <ValidationMessage For="() => _input.Code" />

    <InputNumber @bind-Value="_input.Amount" />
    <ValidationMessage For="() => _input.Amount" />

    <button type="submit">Create</button>
</EditForm>
```

**Never trust client-side validation alone** — always validate server-side.

---

## SQL Injection

EF Core parameterizes queries by default, but watch for:

```csharp
// ❌ CRITICAL: String concatenation in raw SQL
var orders = await context.Orders
    .FromSqlRaw($"SELECT * FROM Orders WHERE Code = '{userInput}'")
    .ToListAsync();

// ✅ SAFE: Parameterized
var orders = await context.Orders
    .FromSqlInterpolated($"SELECT * FROM Orders WHERE Code = {userInput}")
    .ToListAsync();

// ✅ SAFE: LINQ (always parameterized)
var orders = await context.Orders
    .Where(o => o.Code == userInput)
    .ToListAsync();

// ❌ DANGEROUS: Dynamic LINQ with user input
var orders = context.Orders
    .OrderBy(userProvidedSortColumn); // If using System.Linq.Dynamic
```

### Raw ADO.NET / Dapper (no EF Core)

Read-only legacy DBs hit via `SqlConnection`/`SqlCommand` or Dapper get **no** automatic parameterization. Real audit findings:

```csharp
// ❌ CRITICAL: IN-clause built by quoting + concatenating values.
//    A value like   1', 0, (SELECT @@VERSION), '   breaks out of the quotes.
string Build(IEnumerable<string> ids) => string.Join(",", ids.Select(v => $"'{v}'"));
var sql = $"... WHERE NumCarga IN ({Build(cargas)})";          // NEVER

// ✅ SAFE: real parameterized IN — one parameter per value, typed to the column.
var names = cargas.Select((_, i) => $"@c{i}").ToArray();
cmd.CommandText = $"... WHERE NumCarga IN ({string.Join(",", names)})";
for (int i = 0; i < cargas.Count; i++)
    cmd.Parameters.Add($"@c{i}", SqlDbType.VarChar).Value = cargas[i];   // VARCHAR col → VarChar, not Int

// ❌ CRITICAL: building SQL by token replacement — worst when the template is loaded from the DB.
sql = queryTemplate.Replace("@ids", string.Join(",", ids));     // NEVER

// ❌ HIGH: interpolating an identifier (table / db / column) from config or input.
cmd.CommandText = $"SELECT * FROM [{databaseName}].dbo.Pedidos"; // a ']' in the value breaks escaping
// ✅ Validate identifiers against a whitelist first:
if (databaseName is not ("JJP_CRM" or "JJP_CRM_TEST"))
    throw new InvalidOperationException("BD no permitida");
```

If the project already has a correctly-parameterized helper, reuse it instead of inventing a new query path.

### Audit commands

```bash
# Search for raw SQL
grep -rn "FromSqlRaw\|ExecuteSqlRaw\|SqlCommand\|SqlDataAdapter" --include="*.cs" .

# Search for string concatenation in SQL context
grep -rn "SELECT.*+\|INSERT.*+\|UPDATE.*+\|DELETE.*+" --include="*.cs" .
```

---

## Open Redirect

```csharp
// ❌ DANGEROUS: Unvalidated redirect
NavigationManager.NavigateTo(returnUrl);

// ✅ SAFE: Validate redirect URL is local
private bool IsLocalUrl(string url)
{
    return Uri.TryCreate(url, UriKind.Relative, out _) &&
           !url.StartsWith("//") &&
           !url.StartsWith("/\\");
}

// ✅ Or use built-in
if (Url.IsLocalUrl(returnUrl))
    NavigationManager.NavigateTo(returnUrl);
else
    NavigationManager.NavigateTo("/");
```

**SSRF (OWASP A01:2025)**: si el servidor descarga o consume una URL proporcionada por el
usuario (`HttpClient.GetAsync(userUrl)`), valida contra una allow-list de hosts y bloquea
rangos internos (localhost, 10.x, 172.16-31.x, 192.168.x, 169.254.x). El Top 10:2025
clasifica SSRF dentro de A01 Broken Access Control.

---

## Path Traversal, File Handling & IDOR

File upload/download/list/delete endpoints are a top source of real findings — none of this is automatic.

### Path traversal

```csharp
// ❌ CRITICAL: user-controlled name concatenated / Path.Combine'd into a path
var path = baseDir + fileName;                  // NEVER
var path = Path.Combine(baseDir, pedido, name); // NEVER when pedido/name come from input
// A route param {fileName} doesn't capture '/' by default, but %2e%2e%2f (encoded ../)
// and Windows backslashes still escape the folder.

// ✅ SAFE: reduce each segment to a bare file name, then confirm containment.
var safeName = Path.GetFileName(fileName);
var full = Path.GetFullPath(Path.Combine(baseDir, safeName));
if (!full.StartsWith(Path.GetFullPath(baseDir) + Path.DirectorySeparatorChar,
        StringComparison.Ordinal))
    return Results.BadRequest(); // escaped the base directory
```

### Extracción de archivos (tar/zip) — CVE-2026-45491

`TarFile.ExtractToDirectory` en runtimes < 10.0.9 permite symlink traversal: un tar
malicioso escribe fuera del directorio destino. Si la app extrae archivos subidos:
runtime **≥ 10.0.9** obligatorio, extraer a un directorio dedicado y verificar la ruta
resuelta de cada entrada antes de escribir (mismo patrón de containment de arriba).

### IDOR (insecure direct object reference)

`[Authorize]` proves *who* the user is, not that they own the resource. An authenticated user passing someone else's `pedido=12345` must be rejected.

```csharp
// ✅ Verify the current user may act on THIS resource before reading/writing/deleting it.
if (!await _svc.UserOwnsPedidoAsync(currentUserId, pedidoId, ct))
    return Results.Forbid();
```

### Upload size limits

```csharp
builder.Services.Configure<FormOptions>(o =>
    o.MultipartBodyLengthLimit = 30 * 1024 * 1024); // 30 MB; also KestrelServerOptions.Limits.MaxRequestBodySize
```
Base64/JSON uploads bypass multipart limits — cap request body size too.

### Audit commands

```bash
grep -rn "Path.Combine\|Path.GetFullPath\|FileStream\|File.Open\|File.ReadAll" --include="*.cs" .
grep -rn "MultipartBodyLengthLimit\|MaxRequestBodySize" --include="*.cs" .
```
