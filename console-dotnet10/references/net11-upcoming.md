# .NET 11 Upcoming — Console / CLI Tools

> Status: Preview 2 (April 2026). GA expected November 2026.
> **Do not use in production.** Track: https://github.com/dotnet/core/discussions

---

## Relevant for Console Apps

### Runtime Async V2
The runtime will natively manage async suspension/resumption instead of compiler-generated state machines.

**Impact for CLI tools:**
- Stack traces in exceptions become readable (no more `MoveNext` noise)
- Better debugging experience in long async pipelines
- Reduced allocations in hot async paths

No code changes required — transparent upgrade.

---

### `TimeProvider` — Now in Box (no package needed)
`TimeProvider` is promoted to a first-class BCL type. Relevant for testing time-dependent CLI tools without external packages.

```csharp
// .NET 10 — requires Microsoft.Extensions.TimeProvider.Testing
// .NET 11 — built-in, no package

// Abstracting time in services (do this now in .NET 10 — future-proof)
public sealed class ScheduledRunner(TimeProvider timeProvider, ILogger<ScheduledRunner> logger)
{
    public async Task RunAsync(CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow();
        logger.LogInformation("Running at {Time}", now);
        // ...
    }
}

// In tests — control time deterministically
var fakeTime = new FakeTimeProvider();
fakeTime.SetUtcNow(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
var runner = new ScheduledRunner(fakeTime, logger);
```

---

### Native OpenTelemetry (ASP.NET Core)
For console apps that emit telemetry:

```csharp
// .NET 11 — less boilerplate for OTel in console
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource("MyApp.*")
        .AddOtlpExporter());
```

In .NET 10 this already works but requires more manual setup.

---

### `HostApplicationBuilder` improvements (Preview 2)
- Faster startup via reduced reflection in DI container bootstrap
- `builder.Services.AddKeyedSingleton<T>()` now resolves correctly in all edge cases (bug fixes from .NET 10)

---

## What's NOT Changing for Console

- `IHost` / `IHostedService` / `BackgroundService` API — stable, no breaking changes
- Serilog integration — unchanged
- `System.CommandLine` — still in preview, same API
- `appsettings.json` configuration — unchanged
- User Secrets — unchanged

---

## Migration Checklist (.NET 10 to .NET 11)

```xml
<!-- Change TargetFramework when ready -->
<TargetFramework>net11.0</TargetFramework>
```

- [ ] Check `dotnet list package --outdated` — update all `10.*` packages to `11.*`
- [ ] Verify hardware: x64 now requires **x86-64-v3** (AVX2). Old VMs may fail.
- [ ] OpenAPI 3.2.0 — breaking change if you expose/consume OpenAPI specs
- [ ] Run `dotnet publish --self-contained` — AOT improvements may affect output size

---

## Recommended: Start with .NET 10 LTS

.NET 10 is LTS (3 years support). For CLI tools and automation:
- Use .NET 10 for anything going to production before Nov 2026
- Start evaluating .NET 11 at Preview 4-5 (June-July 2026) when APIs stabilize
- The patterns in this skill (IHost, Serilog, Result<T>, testing) carry forward unchanged
