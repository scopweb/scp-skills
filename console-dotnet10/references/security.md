# Security — .NET 10 Console / CLI Tools

## Secrets Hierarchy (priority order, last wins)

```
appsettings.json          <- defaults, non-sensitive only
appsettings.{env}.json    <- environment overrides
Environment Variables     <- CI/CD, production
User Secrets              <- development only (never committed)
Command line args         <- runtime overrides
```

---

## User Secrets (Development)

```bash
# Initialize (creates secrets.json outside repo)
dotnet user-secrets init

# Add secrets
dotnet user-secrets set "Database:Password" "dev_password"
dotnet user-secrets set "Api:Key" "dev_api_key_here"

# List
dotnet user-secrets list

# Remove
dotnet user-secrets remove "Api:Key"
```

```csharp
// Load only in Development
if (builder.Environment.IsDevelopment())
    builder.Configuration.AddUserSecrets<Program>();
```

Secrets file location: `%APPDATA%\Microsoft\UserSecrets\{userSecretsId}\secrets.json`
**Never version-control this file.**

---

## Environment Variables

### Prefix filtering (recommended)
```csharp
// Only loads vars starting with MYAPP_
builder.Configuration.AddEnvironmentVariables(prefix: "MYAPP_");
```

```bash
# Maps to App:BatchSize in config
MYAPP_APP__BATCHSIZE=500
MYAPP_DATABASE__CONNECTIONSTRING=Server=...
```

Note: double underscore `__` maps to `:` in configuration keys.

### Production secrets via env vars
```bash
# CI/CD / server environment
$env:MYAPP_DATABASE__PASSWORD = "prod_password"
$env:MYAPP_API__KEY = "prod_api_key"
```

---

## .gitignore — Required Entries

```gitignore
# Secrets
appsettings.*.json
!appsettings.Development.json
*.env
.env*
secrets.json

# Logs
logs/
*.log

# Output directories
output/
temp/
```

**Rule:** `appsettings.json` may only contain non-sensitive defaults. Connection strings with credentials never go in source control.

---

## Sensitive Data in Logs

```csharp
// WRONG — logs credentials
logger.LogInformation("Connecting with {ConnectionString}", connString);

// CORRECT — log only safe identifiers
logger.LogInformation("Connecting to {Server} / {Database}", server, dbName);

// Masking helper
public static string MaskSecret(string? value)
{
    if (string.IsNullOrEmpty(value)) return "(empty)";
    if (value.Length <= 4) return "****";
    return $"{value[..2]}{"*".PadRight(value.Length - 4, '*')}{value[^2..]}";
}

logger.LogDebug("Using API key: {Key}", MaskSecret(apiKey));
```

---

## Input Validation

```csharp
// File path traversal prevention
public static string SafeResolvePath(string basePath, string userInput)
{
    var fullPath = Path.GetFullPath(Path.Combine(basePath, userInput));
    if (!fullPath.StartsWith(Path.GetFullPath(basePath), StringComparison.OrdinalIgnoreCase))
        throw new SecurityException($"Path traversal attempt detected: {userInput}");
    return fullPath;
}

// File extension allowlist
private static readonly HashSet<string> AllowedExtensions = [".csv", ".json", ".txt"];

public static void ValidateFileExtension(string path)
{
    var ext = Path.GetExtension(path).ToLowerInvariant();
    if (!AllowedExtensions.Contains(ext))
        throw new ArgumentException($"File type '{ext}' is not allowed");
}
```

---

## Process Execution (if shell commands needed)

```csharp
// WRONG — shell injection risk
Process.Start("cmd.exe", $"/c copy {userInput} output/");

// CORRECT — no shell, explicit args
var psi = new ProcessStartInfo
{
    FileName = "robocopy",
    ArgumentList = { sourceDir, destDir, "/E" },  // no shell expansion
    UseShellExecute = false,
    RedirectStandardOutput = true,
    RedirectStandardError = true,
    CreateNoWindow = true
};

using var process = Process.Start(psi) ?? throw new InvalidOperationException("Process failed to start");
await process.WaitForExitAsync(cancellationToken);
```

---

## Dependency Auditing

```bash
# Check for known CVEs in NuGet packages
dotnet list package --vulnerable

# Check outdated packages
dotnet list package --outdated

# Restore with audit enabled (add to CI)
dotnet restore --require-secure --no-cache
```

Add to CI pipeline — break build on critical vulnerabilities:
```yaml
- name: Audit packages
  run: dotnet list package --vulnerable --include-transitive
```

---

## Minimal Attack Surface

```csharp
// Run with least privilege — document required permissions
// Required: Read access to input/, Write access to output/, no network

// Validate required config at startup, fail fast
builder.Services.AddOptions<AppSettings>()
    .BindConfiguration("App")
    .Validate(s => s.BatchSize > 0 && s.BatchSize <= 10000,
              "BatchSize must be between 1 and 10000")
    .ValidateOnStart();  // Crash at startup, not mid-run
```
