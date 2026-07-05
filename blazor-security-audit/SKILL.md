---
name: blazor-security-audit
description: >
  Auditoría de seguridad y hardening para aplicaciones Blazor Server .NET 10, C# 14.
  Usar cuando: revisar seguridad de una app Blazor Server, hardening del despliegue,
  auditar autenticación/autorización, verificar vulnerabilidades o securizar circuitos SignalR.
  Triggers: auditoría de seguridad, security review, harden Blazor, secure Blazor,
  vulnerability check, OWASP Blazor, XSS prevention, CSRF protection, CSP headers,
  configuración de autenticación, políticas de autorización, seguridad SignalR,
  protección de circuito, rate limiting, data protection, despliegue seguro,
  SSL/TLS, cookie security, antiforgery tokens, validación de inputs,
  "penetration test", "security scan", "vulnerability assessment", "¿es segura mi app Blazor?".
---

# Blazor Server .NET 10 — Security Audit & Hardening

Comprehensive security checklist for Blazor Server apps on .NET 10 (LTS) with C# 14.
Focused exclusively on **Blazor Server** (SignalR circuits, server-side rendering).

**Versiones mínimas exigibles (jul-2026): runtime ≥ 10.0.9 y SDK ≥ 10.0.301** — los parches
de junio 2026 corrigen CVE-2026-45591 (DoS en el hub protocol MessagePack de SignalR),
CVE-2026-40372 (DataProtection), CVE-2026-45490 (EoP named pipe del SDK en Windows) y
CVE-2026-45491 (symlink traversal en `TarFile.ExtractToDirectory`). Una versión inferior
es hallazgo **High** por sí sola.

## Reference Files

| File | When to read |
|------|-------------|
| [auth-and-authorization.md](references/auth-and-authorization.md) | Authentication setup, Identity, OAuth2/OIDC, role/policy authorization, passkeys |
| [circuit-and-signalr.md](references/circuit-and-signalr.md) | SignalR hardening, circuit limits, DoS protection, WebSocket compression |
| [web-vulnerabilities.md](references/web-vulnerabilities.md) | XSS, CSRF, CORS, CSP headers, clickjacking, input validation |
| [deployment-and-infra.md](references/deployment-and-infra.md) | HTTPS/TLS, cookie config, error handling, secrets management, IIS hardening |

Read the relevant reference before making recommendations. For quick audit, use checklist below.

---

## Quick Audit Checklist

Run through these categories when auditing a Blazor Server app. Each item links to its reference for details.

Mapeo a **OWASP Top 10:2025**: §1 → A01 Broken Access Control (incluye SSRF) y A07 Authentication Failures;
§2 → A02 Security Misconfiguration y A10 Mishandling of Exceptional Conditions; §3 → A05 Injection y A01;
§4 → A06 Cryptographic Failures, A08 Data Integrity Failures y A09 Security Logging and Alerting Failures;
§5 → A02 y A03 Software Supply Chain Failures (nueva en 2025).

### 1. Authentication & Authorization

```
□ Authentication scheme configured (Cookie, OIDC, or Identity)
□ [Authorize] on all protected pages/components
□ Roles or policies for fine-grained access
□ AuthenticationStateProvider validated (not custom-hacked)
□ Identity revalidation every 30 min (default template)
□ No secrets in client-side code or appsettings.json
□ User secrets for dev, Key Vault/env vars for production
□ Password policy meets standards (length ≥ 12, complexity)
□ Account lockout after failed attempts
□ Passkeys/WebAuthn considered (.NET 10 built-in support)
```

### 2. SignalR & Circuit Protection

```
□ Circuit timeout configured (CircuitOptions)
□ Max retained disconnected circuits limited
□ SignalR message size limit reviewed (default 32KB)
□ Hub authentication enforced (RequireAuthorization)
□ WebSocket compression: frame-ancestors CSP set to 'self'
□ Session affinity (sticky sessions) for multi-server
□ No singleton services leaking state across circuits
□ Rate limiting on SignalR hub endpoint
□ HTTPS enforced on WebSocket transport
□ Runtime ≥ 10.0.9 si hay hubs con MessagePack protocol (CVE-2026-45591, DoS por arrays anidados)
```

### 3. Web Vulnerabilities (XSS, CSRF, CORS)

```
□ Antiforgery middleware enabled (UseAntiforgery after UseAuth)
□ EditForm used (never HTML <form>)
□ No raw HTML rendering (@((MarkupString)...) audited)
□ Content Security Policy (CSP) headers configured
□ X-Frame-Options or frame-ancestors set
□ CORS restricted to known origins (or disabled for Blazor hub)
□ Input validation on all user inputs (server-side)
□ Output encoding for any dynamic content
□ No eval() or inline scripts in JS interop
□ File endpoints: Path.GetFileName + base-dir containment (no path traversal)
□ Ownership checks on resource access (no IDOR via id in route/form)
□ Upload/body size capped (FormOptions / Kestrel limits)
□ Raw ADO.NET/Dapper: parameterized IN clauses, identifier whitelist (not only EF)
□ Extracción de archivos subidos (TarFile/ZipFile): runtime ≥ 10.0.9 (CVE-2026-45491) + destino validado
□ SSRF: URLs del usuario nunca consumidas server-side sin allow-list (OWASP A01:2025)
```

### 4. Data Protection & Secrets

```
□ Data Protection API configured with persistent key storage
□ Connection strings NOT in appsettings.json (production)
□ Secrets stored in Key Vault or environment variables
□ Sensitive data encrypted at rest and in transit
□ PII handling complies with GDPR/local regulations
□ Logging does NOT contain sensitive data (passwords, tokens)
□ EF Core: parameterized queries only (no raw SQL concatenation)
□ Paquetes Microsoft.AspNetCore.DataProtection* fuera del rango 10.0.0–10.0.6 (CVE-2026-40372)
□ No TrustServerCertificate=True in connection strings (MITM)
□ Git history scanned for secrets (gitleaks --all); any leaked credential rotated
```

### 5. Deployment & Infrastructure

```
□ HTTPS enforced (HSTS header, HTTP→HTTPS redirect)
□ TLS 1.2+ only (TLS 1.0/1.1 disabled)
□ Secure cookie settings (HttpOnly, Secure, SameSite=Strict)
□ Custom error pages (no stack traces in production)
□ Development exception page REMOVED in production
□ Response headers hardened (X-Content-Type-Options, etc.)
□ IIS: request filtering, URL scan, application pool identity
□ Rate limiting middleware configured
□ Health check endpoints restricted
□ Dependency audit (dotnet list package --vulnerable) — OWASP A03:2025 Software Supply Chain
□ Runtime ≥ 10.0.9 y SDK ≥ 10.0.301 (parches jun-2026; CVE-2026-45490 exige SDK 10.0.301+)
```

---

## Audit Execution Flow

When performing a security audit:

1. **Identify scope** — Which areas does the user want to audit? All or specific?
2. **Gather context** — Read Program.cs, appsettings, middleware pipeline
3. **Check each category** — Use the checklist above, referencing detail files
4. **Report findings** — Severity (Critical/High/Medium/Low), what to fix, code examples
5. **Prioritize** — Critical items first (auth bypass, exposed secrets, no HTTPS)

### Severity Classification

| Severity | Examples |
|----------|---------|
| **Critical** | No auth on admin pages, secrets in source code, SQL injection |
| **High** | Missing HTTPS, weak password policy, no antiforgery, singleton state leak, runtime/SDK sin parches jun-2026 (< 10.0.9 / < 10.0.301) |
| **Medium** | Missing CSP headers, no rate limiting, verbose error messages |
| **Low** | Missing X-Content-Type-Options, no HSTS preload, no audit logging |

### Methodology rules

- **A security review is read-only.** Don't commit anything; if a command dirties the tree (restore/lockfile churn, formatting, `*.sum` edits), revert it. The deliverable is the report, not a commit.
- **Verify every finding against the real code** before assigning severity — automated/agent scans over-report. Reproduce the exploit path (or confirm the guard exists) rather than trusting the label.
- **Build/compile as part of the audit.** A stray `using` for an unreferenced package (CS0246), or nullable warnings under `TreatWarningsAsErrors`, are real "doesn't ship" findings.
- **History ≠ working tree** for secrets (see deployment ref); **check `.gitignore`** before flagging committed secrets.
- **Don't trust textual/regex blacklists as a security control** — comment-stripping, encoding, and whitespace tricks bypass them. Prefer parameterization, allow-lists, and framework controls.
- **Report format:** group by severity (🔴 Critical / 🟠 High / 🟡 Medium / 🟢 verified-OK), each with file:line, impact, and a concrete fix; end with a prioritized remediation list. Offer to implement fixes on a branch — don't auto-apply during the audit.

---

## Common Fixes — Quick Reference

### Program.cs Security Pipeline (correct order)

```csharp
var builder = WebApplication.CreateBuilder(args);

// 1. Services
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Strict;
    });
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery();
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
        context => RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1)
            }));
});

var app = builder.Build();

// 2. Middleware pipeline — ORDER MATTERS
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();    // before authorization
app.UseAuthorization();     // before antiforgery
app.UseAntiforgery();       // after auth

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .RequireAuthorization();  // global auth requirement

app.Run();
```

### Secure Response Headers Middleware

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy",
        "camera=(), microphone=(), geolocation=()");
    context.Response.Headers.Append("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "frame-ancestors 'self'; form-action 'self'");
    await next();
});
```

### Circuit Configuration

```csharp
// .NET 8+ Razor Components model (AddServerSideBlazor es la API legacy)
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents(options =>
    {
        options.DisconnectedCircuitRetentionPeriod = TimeSpan.FromMinutes(3);
        options.DisconnectedCircuitMaxRetained = 100;
        options.MaxBufferedUnacknowledgedRenderBatches = 10;
        options.DetailedErrors = false; // NEVER true in production
    });
```

### Dependency Vulnerability Check

```bash
# Check for known vulnerabilities
dotnet list package --vulnerable --include-transitive

# Audit with NuGet Audit (.NET 8+)
dotnet restore --force  # NuGetAudit runs on restore

# Runtime y SDK parcheados (mínimos jun-2026)
dotnet --list-runtimes   # Microsoft.AspNetCore.App >= 10.0.9
dotnet --version         # SDK >= 10.0.301
```

---

## Anti-Patterns to Flag

| Anti-Pattern | Risk | Fix |
|-------------|------|-----|
| `@((MarkupString)userInput)` | XSS — renders raw HTML | Sanitize or avoid raw rendering |
| `builder.Services.AddSingleton<UserState>()` | State leaks across circuits | Use Scoped lifetime |
| `options.DetailedErrors = true` in prod | Info disclosure | Set false in production |
| Hardcoded connection strings | Credential exposure | User Secrets / Key Vault |
| `[AllowAnonymous]` on admin pages | Auth bypass | Remove and use `[Authorize(Roles = "Admin")]` |
| Missing `CancellationToken` on async | DoS via resource exhaustion | Always propagate CT |
| `app.UseDeveloperExceptionPage()` in prod | Stack trace leakage | Use `UseExceptionHandler` |
| Raw SQL: `$"SELECT * WHERE Id = {id}"` | SQL injection | Use parameterized queries |
| No circuit limits configured | Memory exhaustion DoS | Configure CircuitOptions |
| CORS `AllowAnyOrigin()` | Cross-origin attacks | Restrict to known origins |
| Hub con MessagePack en runtime < 10.0.9 | DoS stack overflow (CVE-2026-45591) | Actualizar runtime a ≥ 10.0.9 |
| `TarFile.ExtractToDirectory` sobre uploads en runtime < 10.0.9 | Symlink traversal (CVE-2026-45491) | Runtime ≥ 10.0.9 + validar rutas extraídas |
| `IN (` + quoted, concatenated values (raw ADO.NET) | SQL injection | Parameterize: `@c0,@c1,…` typed to the column |
| `queryTemplate.Replace("@ids", …)` | SQL injection | Never build SQL by token replacement |
| `[{dbName}]` / identifier from config or input | SQL injection | Whitelist allowed identifiers |
| `Path.Combine(baseDir, userInput)` / `baseDir + fileName` | Path traversal | `Path.GetFileName` + verify resolved path under base |
| Resource fetched by id with no ownership check | IDOR | Verify current user owns the resource |
| `TrustServerCertificate=True` | MITM on DB/TLS connection | Install valid cert; remove flag |
| `@Html.Raw(dbValue)` / `innerHTML = dbValue` / `.html(dbValue)` | Stored XSS | Encode / `textContent` / sanitize |
| `dict["key"]` on a possibly-missing key | KeyNotFoundException mis-handled as wrong error | `TryGetValue` + validate |
| Destructive op runs on a `0` / failed return value | Mass data corruption | Guard `if (id > 0)` before cascading writes |
