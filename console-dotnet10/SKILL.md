---
name: console-dotnet10
version: 1.0.0
description: Best practices for .NET 10 CLI tools and console applications. Covers IHost setup, DI, configuration, Serilog logging, secrets management, error handling, and testing patterns.
tags: [dotnet, console, cli, csharp, net10, serilog, di, testing]
references:
  - references/security.md
  - references/testing.md
  - references/net11-upcoming.md
---

# .NET 10 Console App & CLI Tool — Best Practices

## Scope
CLI tools and automation scripts using `IHost` / `HostApplicationBuilder`. Not Blazor, not ASP.NET — pure console with optional background services.

---

## 1. Project Setup

### Minimal `.csproj`
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <Optimize>true</Optimize>
    <!-- AOT-ready when targeting self-contained tools -->
    <PublishAot>false</PublishAot>
  </PropertyGroup>
</Project>
```

### Key NuGet packages
```xml
<!-- DI + Config + Hosting -->
<PackageReference Include="Microsoft.Extensions.Hosting" Version="10.*" />

<!-- Logging -->
<PackageReference Include="Serilog.Extensions.Hosting" Version="9.*" />
<PackageReference Include="Serilog.Sinks.Console" Version="6.*" />
<PackageReference Include="Serilog.Sinks.File" Version="6.*" />
<PackageReference Include="Serilog.Settings.Configuration" Version="9.*" />

<!-- Secrets -->
<PackageReference Include="Microsoft.Extensions.Configuration.UserSecrets" Version="10.*" />

<!-- CLI parsing (optional, preferred over manual args) -->
<PackageReference Include="System.CommandLine" Version="2.*" />
```

---

## 2. Host Setup (IHost Pattern)

**Always use `HostApplicationBuilder` in .NET 10 — not the legacy `Host.CreateDefaultBuilder`.**

```csharp
// Program.cs
using Microsoft.Extensions.Hosting;
using Serilog;

var builder = Host.CreateApplicationBuilder(args);

// Serilog replaces default logging
builder.Logging.ClearProviders();
builder.Services.AddSerilog((sp, lc) => lc
    .ReadFrom.Configuration(builder.Configuration)
    .ReadFrom.Services(sp)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File("logs/app-.log", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7));

// Register services
builder.Services.AddSingleton<IMyService, MyService>();
builder.Services.AddHostedService<AppRunner>();

// Configuration — order matters (last wins)
builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddEnvironmentVariables()        // MYAPP_ prefix optional, see security.md
    .AddCommandLine(args);

// User Secrets (development only)
if (builder.Environment.IsDevelopment())
    builder.Configuration.AddUserSecrets<Program>();

var host = builder.Build();
await host.RunAsync();
```

---

## 3. AppRunner — Entry Point via IHostedService

Prefer `BackgroundService` for long-running work, `IHostedService` for run-once CLI tools:

```csharp
// AppRunner.cs — run-once CLI pattern
public sealed class AppRunner(
    ILogger<AppRunner> logger,
    IMyService myService,
    IHostApplicationLifetime lifetime,
    IOptions<AppSettings> options) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            logger.LogInformation("Starting {App} v{Version}",
                nameof(AppRunner), Assembly.GetExecutingAssembly().GetName().Version);

            await myService.RunAsync(cancellationToken);

            logger.LogInformation("Completed successfully");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Operation cancelled by user");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Fatal error during execution");
            Environment.ExitCode = 1;
        }
        finally
        {
            lifetime.StopApplication();
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
```

---

## 4. Configuration & Options Pattern

### `appsettings.json`
```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    }
  },
  "App": {
    "BatchSize": 100,
    "RetryCount": 3,
    "OutputPath": "output/"
  }
}
```

### Strongly-typed settings
```csharp
// AppSettings.cs
public sealed record AppSettings
{
    public int BatchSize { get; init; } = 100;
    public int RetryCount { get; init; } = 3;
    public string OutputPath { get; init; } = "output/";
}

// Registration
builder.Services.Configure<AppSettings>(
    builder.Configuration.GetSection("App"));

// Validation at startup — fail fast
builder.Services.AddOptions<AppSettings>()
    .BindConfiguration("App")
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

---

## 5. Logging — Serilog Patterns

```csharp
// CORRECT — structured logging, never string interpolation in log calls
logger.LogInformation("Processing {Count} records from {Source}", count, source);
logger.LogError(ex, "Failed to process record {Id}", record.Id);

// WRONG — kills structured logging benefits
logger.LogInformation($"Processing {count} records");  // ❌

// Conditional expensive computation
if (logger.IsEnabled(LogLevel.Debug))
    logger.LogDebug("Payload: {Payload}", JsonSerializer.Serialize(payload));

// Operation timing
using var _ = logger.BeginScope("BatchId={BatchId}", batchId);
// All logs within this scope carry BatchId automatically
```

### Log levels guide for CLI tools
| Level | Use |
|-------|-----|
| `Trace` | Loop internals, raw data — disable in prod |
| `Debug` | Diagnostics — enabled via env var override |
| `Information` | Normal progress: started, completed, counts |
| `Warning` | Recoverable issues: retry, skipped record |
| `Error` | Failed item — processing continues |
| `Critical` | Fatal — app must stop |

---

## 6. Error Handling

### Result pattern (no exceptions for business logic)
```csharp
// Result.cs
public readonly record struct Result<T>
{
    public T? Value { get; }
    public string? Error { get; }
    public bool IsSuccess => Error is null;

    private Result(T value) => Value = value;
    private Result(string error) => Error = error;

    public static Result<T> Ok(T value) => new(value);
    public static Result<T> Fail(string error) => new(error);
}

// Usage
public async Task<Result<ProcessedData>> ProcessAsync(string input, CancellationToken ct)
{
    if (string.IsNullOrWhiteSpace(input))
        return Result<ProcessedData>.Fail("Input cannot be empty");

    try
    {
        var data = await _parser.ParseAsync(input, ct);
        return Result<ProcessedData>.Ok(data);
    }
    catch (FormatException ex)
    {
        return Result<ProcessedData>.Fail($"Invalid format: {ex.Message}");
    }
}
```

### Global unhandled exception handler
```csharp
// In Program.cs, before builder.Build()
AppDomain.CurrentDomain.UnhandledException += (_, e) =>
{
    Log.Fatal(e.ExceptionObject as Exception, "Unhandled exception — process terminating");
    Log.CloseAndFlush();
    Environment.Exit(1);
};
```

---

## 7. CancellationToken Propagation

**Every async method must accept and forward `CancellationToken`.**

```csharp
// CORRECT
public async Task ProcessFileAsync(string path, CancellationToken cancellationToken)
{
    await using var stream = File.OpenRead(path);
    await foreach (var line in ReadLinesAsync(stream, cancellationToken))
    {
        cancellationToken.ThrowIfCancellationRequested();
        await ProcessLineAsync(line, cancellationToken);
    }
}

// WRONG — ignores cancellation, blocks graceful shutdown
public async Task ProcessFileAsync(string path)
{
    // ...
}
```

---

## 8. CLI Argument Parsing (System.CommandLine)

```csharp
// Program.cs — with System.CommandLine
var rootCommand = new RootCommand("My automation tool");

var inputOption = new Option<FileInfo>("--input", "Input file path") { IsRequired = true };
var verboseOption = new Option<bool>("--verbose", "Enable verbose output");
var batchSizeOption = new Option<int>("--batch-size", () => 100, "Records per batch");

rootCommand.AddOption(inputOption);
rootCommand.AddOption(verboseOption);
rootCommand.AddOption(batchSizeOption);

rootCommand.SetHandler(async (input, verbose, batchSize) =>
{
    // Build host here with parsed args
    var builder = Host.CreateApplicationBuilder();
    builder.Services.AddSingleton(new CliOptions(input, verbose, batchSize));
    // ... register services
    await builder.Build().RunAsync();
}, inputOption, verboseOption, batchSizeOption);

return await rootCommand.InvokeAsync(args);
```

---

## 9. Anti-Patterns

```csharp
// ❌ Thread.Sleep — blocks thread, ignores cancellation
Thread.Sleep(5000);
// ✅
await Task.Delay(5000, cancellationToken);

// ❌ .Result / .Wait() — deadlock risk
var result = GetDataAsync().Result;
// ✅
var result = await GetDataAsync(cancellationToken);

// ❌ Catching Exception broadly and swallowing
catch (Exception) { }
// ✅
catch (Exception ex) when (ex is not OperationCanceledException)
{
    logger.LogError(ex, "...");
    return Result<T>.Fail(ex.Message);
}

// ❌ Hardcoded connection strings / credentials
var conn = "Server=prod;Password=secret123";
// ✅ See references/security.md

// ❌ Console.WriteLine for structured apps
Console.WriteLine("Done");
// ✅
logger.LogInformation("Done");
```

---

## References

- **[security.md](references/security.md)** — Secrets, env vars, User Secrets, hardening
- **[testing.md](references/testing.md)** — Unit and integration testing with IHost
- **[net11-upcoming.md](references/net11-upcoming.md)** — Upcoming .NET 11 features relevant to console apps
