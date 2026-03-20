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
