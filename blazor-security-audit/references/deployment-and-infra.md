# Deployment & Infrastructure Security — Blazor Server .NET 10

## Table of Contents

1. [HTTPS & TLS](#https--tls)
2. [Security Headers](#security-headers)
3. [Error Handling](#error-handling)
4. [Secrets Management](#secrets-management)
5. [IIS Hardening](#iis-hardening)
6. [Dependency Auditing](#dependency-auditing)
7. [Logging & Monitoring](#logging--monitoring)
8. [Data Protection API](#data-protection-api)

---

## HTTPS & TLS

### Enforce HTTPS

```csharp
// Program.cs
if (!app.Environment.IsDevelopment())
{
    app.UseHsts(); // HTTP Strict Transport Security
}
app.UseHttpsRedirection();

// Kestrel TLS config
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(443, listenOptions =>
    {
        listenOptions.UseHttps("cert.pfx", "password");
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
    });
});
```

### HSTS Configuration

```csharp
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true; // submit to HSTS preload list
});
```

### Disable old TLS versions

```csharp
// In Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    options.ConfigureHttpsDefaults(httpsOptions =>
    {
        httpsOptions.SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13;
    });
});

// In IIS — disable via registry or web.config
// See IIS Hardening section below
```

### Don't disable certificate validation

```text
❌ Server=...;TrustServerCertificate=True    // accepts ANY cert → MITM on the wire
```

`TrustServerCertificate=True` in a SQL/connection string skips TLS certificate validation, exposing the DB connection to man-in-the-middle on the internal network. Install a valid certificate on the DB server and remove the flag (or scope it to dev only).

---

## Security Headers

### Complete security headers middleware

```csharp
public static class SecurityHeadersMiddleware
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;

            // Prevent MIME-type sniffing
            headers.Append("X-Content-Type-Options", "nosniff");

            // Clickjacking protection
            headers.Append("X-Frame-Options", "DENY");

            // XSS filter (legacy browsers)
            headers.Append("X-XSS-Protection", "0");
            // Note: Modern practice is to disable X-XSS-Protection
            // and rely on CSP instead

            // Referrer policy
            headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

            // Permissions policy (restrict browser features)
            headers.Append("Permissions-Policy",
                "camera=(), microphone=(), geolocation=(), " +
                "payment=(), usb=(), magnetometer=()");

            // Content Security Policy
            headers.Append("Content-Security-Policy",
                "default-src 'self'; " +
                "script-src 'self'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data: https:; " +
                "font-src 'self'; " +
                "connect-src 'self' wss:; " +
                "frame-ancestors 'self'; " +
                "form-action 'self'; " +
                "base-uri 'self'; " +
                "object-src 'none'");

            // Remove server identification headers
            headers.Remove("Server");
            headers.Remove("X-Powered-By");

            await next();
        });
    }
}

// Usage in Program.cs (before UseRouting)
app.UseSecurityHeaders();
```

### Verify with tools

```bash
# Check security headers
curl -I https://yourdomain.com

# Online scanners:
# - securityheaders.com
# - observatory.mozilla.org
```

---

## Error Handling

### Production error handling (no stack traces!)

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage(); // OK in dev ONLY
}
else
{
    app.UseExceptionHandler("/Error"); // Custom error page
    app.UseStatusCodePagesWithReExecute("/Error/{0}");
    app.UseHsts();
}
```

### Custom error page

```razor
@page "/Error"
@using Microsoft.AspNetCore.Diagnostics

<h1>An error occurred</h1>
<p>Please try again later or contact support.</p>

@* NEVER show exception details in production *@
@code {
    [CascadingParameter] private HttpContext? HttpContext { get; set; }

    protected override void OnInitialized()
    {
        // Log error server-side only
        var exceptionFeature = HttpContext?.Features.Get<IExceptionHandlerFeature>();
        if (exceptionFeature?.Error is not null)
        {
            // Log to structured logging, NOT to user
            Logger.LogError(exceptionFeature.Error, "Unhandled exception");
        }
    }
}
```

### Blazor circuit error handling

```csharp
// DetailedErrors MUST be false in production
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents(options =>
    {
        options.DetailedErrors = app.Environment.IsDevelopment();
    });
```

---

## Secrets Management

### Never do this

```json
// ❌ appsettings.json with secrets — committed to source control!
{
  "ConnectionStrings": {
    "Default": "Server=myserver;Database=mydb;User=sa;Password=MyP@ssw0rd;"
  },
  "ApiKeys": {
    "Stripe": "sk_live_xxxxx"
  }
}
```

### Development — User Secrets

```bash
# Initialize
dotnet user-secrets init

# Set secrets
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Database=dev;Trusted_Connection=true"
dotnet user-secrets set "ApiKeys:Stripe" "sk_test_xxxxx"
```

```csharp
// Automatically loaded in Development
builder.Configuration.AddUserSecrets<Program>();
```

### Production — Environment Variables or Key Vault

```csharp
// Environment variables (IIS, Docker, etc.)
// Set: ConnectionStrings__Default = "Server=..."
// Double underscore __ for nested keys

// Azure Key Vault
builder.Configuration.AddAzureKeyVault(
    new Uri("https://myvault.vault.azure.net/"),
    new DefaultAzureCredential());

// Or for non-Azure: encrypted config files, HashiCorp Vault, etc.
```

### Audit for exposed secrets

```bash
# Search for potential secrets in code
grep -rn "password\|secret\|apikey\|connectionstring\|sk_live\|sk_test" \
    --include="*.cs" --include="*.json" --include="*.config" \
    --exclude-dir=obj --exclude-dir=bin .

# Use git-secrets or gitleaks for git history
# dotnet tool install -g gitleaks
```

### If a secret was ever committed (git history ≠ working tree)

A clean working tree is not enough — secrets live in history until it's rewritten. A real, recurring mistake: committing the very `replace_secrets.txt` / BFG rules file used to scrub the history, which re-leaks the exact value into *every* commit (including "fresh start" ones), making the cleanup useless.

Order of operations when a credential leaks:
1. **Rotate the credential first** (DB password, API key) — treat it as compromised the moment it was pushed. Purging history does not un-leak it.
2. Then remove the file and rewrite history (BFG / `git filter-repo`), or start a genuinely new repo.
3. Confirm the secret-scrubbing rules file itself is **not** tracked.
4. Verify real config is git-ignored (`appsettings.json` / `appsettings.*.json`) and only a `*.demo` / `*.example` with placeholders is committed. Check this **before** flagging "secret in repo" — a placeholder-only demo file is a false alarm.
5. Scan history, not just HEAD.

```bash
gitleaks detect --source . --log-opts="--all"          # full history, not just current tree
git log --all --full-history -- replace_secrets.txt    # was a scrub-rules file committed?
```

> `SmtpClient` is obsolete per Microsoft (no modern TLS fixes) — prefer MailKit for outbound mail. Minor, not urgent.

---

## IIS Hardening

### web.config security settings

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <!-- Remove Server header -->
    <security>
      <requestFiltering removeServerHeader="true">
        <!-- Limit request size -->
        <requestLimits maxAllowedContentLength="30000000" />
        <!-- Block dangerous file extensions -->
        <fileExtensions>
          <add fileExtension=".config" allowed="false" />
          <add fileExtension=".cs" allowed="false" />
          <add fileExtension=".csproj" allowed="false" />
        </fileExtensions>
        <!-- Block dangerous HTTP verbs -->
        <verbs>
          <add verb="TRACE" allowed="false" />
          <add verb="OPTIONS" allowed="false" />
        </verbs>
      </requestFiltering>
    </security>

    <!-- Remove unwanted headers -->
    <httpProtocol>
      <customHeaders>
        <remove name="X-Powered-By" />
      </customHeaders>
    </httpProtocol>

    <!-- Custom error pages (hide details) -->
    <httpErrors existingResponse="Replace" errorMode="Custom">
      <remove statusCode="404" />
      <error statusCode="404" path="/Error/404" responseMode="ExecuteURL" />
      <remove statusCode="500" />
      <error statusCode="500" path="/Error/500" responseMode="ExecuteURL" />
    </httpErrors>
  </system.webServer>
</configuration>
```

### Application pool settings

- **Identity**: Use a dedicated AppPool identity, never LocalSystem
- **Idle timeout**: Set based on usage (default 20 min is OK)
- **Recycling**: Regular recycling interval (default 1740 min)
- **.NET CLR version**: "No Managed Code" (ASP.NET Core runs out-of-process)
- **Enable 32-bit apps**: False (unless specifically needed)

---

## Dependency Auditing

### Built-in tools

```bash
# Check for vulnerable packages
dotnet list package --vulnerable --include-transitive

# NuGet Audit on restore (auto since .NET 8)
dotnet restore

# Outdated packages (potential unpatched vulnerabilities)
dotnet list package --outdated

# Runtime y SDK parcheados — mínimos jun-2026 (OWASP A03:2025 Software Supply Chain)
dotnet --list-runtimes   # Microsoft.AspNetCore.App >= 10.0.9 (CVE-2026-45591, CVE-2026-45491)
dotnet --version         # SDK >= 10.0.301 (CVE-2026-45490: EoP via named pipe del SDK en Windows)
```

### Third-party tools

```bash
# dotnet-retire está sin mantenimiento — preferir NuGetAudit (restore) + --vulnerable
# Escáneres adicionales: OSV-Scanner, Trivy

# Snyk (if available)
snyk test --file=MyApp.csproj

# GitHub Dependabot — enable in repo settings
```

### In CI/CD pipeline

```yaml
# GitHub Actions example
- name: Check vulnerable packages
  run: |
    dotnet list package --vulnerable --include-transitive 2>&1 | tee vuln-report.txt
    if grep -q "has the following vulnerable packages" vuln-report.txt; then
      echo "::error::Vulnerable packages detected!"
      exit 1
    fi
```

---

## Logging & Monitoring

### Secure logging practices

```csharp
// ✅ Log security events
logger.LogWarning("Failed login attempt for user {UserId} from {IP}",
    userId, context.Connection.RemoteIpAddress);

// ✅ Log auth failures
logger.LogError("Authorization failed for {User} accessing {Resource}",
    user.Identity?.Name, resourceId);

// ❌ NEVER log sensitive data
logger.LogInformation("User logged in with password {Password}", password);
logger.LogDebug("Token: {Token}", accessToken);
logger.LogInformation("Connection string: {CS}", connectionString);
```

### Structured logging with Serilog

```csharp
builder.Host.UseSerilog((context, config) =>
{
    config
        .ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName()
        .WriteTo.Console()
        .WriteTo.File("logs/app-.log",
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 30);
});

// Destructure sensitive types to prevent accidental logging
// Use [NotLogged] attribute on sensitive properties
```

---

## Data Protection API

Used for encrypting cookies, antiforgery tokens, and other protected data.

> **CVE-2026-40372**: las versiones 10.0.0–10.0.6 de `Microsoft.AspNetCore.DataProtection`
> calculan el HMAC sobre bytes incorrectos en el managed authenticated encryptor.
> Verifica que cualquier paquete `Microsoft.AspNetCore.DataProtection*` referenciado
> explícitamente esté fuera de ese rango (alineado con runtime 10.0.9+).

```csharp
// Configure persistent key storage (essential for multi-server or container deployments)
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("/app/keys"))
    .SetApplicationName("MyBlazorApp")
    .SetDefaultKeyLifetime(TimeSpan.FromDays(90))
    .ProtectKeysWithCertificate(certificate); // Optional: encrypt keys at rest

// For SQL Server key storage
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<DataProtectionDbContext>();
```

**Without persistent key storage**, deploying to multiple servers or restarting containers will invalidate all cookies and antiforgery tokens, logging out all users.
