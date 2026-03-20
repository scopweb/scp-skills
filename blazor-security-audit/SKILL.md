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
□ Dependency audit (dotnet list package --vulnerable)
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
| **High** | Missing HTTPS, weak password policy, no antiforgery, singleton state leak |
| **Medium** | Missing CSP headers, no rate limiting, verbose error messages |
| **Low** | Missing X-Content-Type-Options, no HSTS preload, no audit logging |

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
builder.Services.AddServerSideBlazor(options =>
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

# OWASP dependency check (optional, more thorough)
dotnet tool install -g dotnet-retire
dotnet retire
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
