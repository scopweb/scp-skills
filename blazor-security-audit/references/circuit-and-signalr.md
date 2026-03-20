# Circuit & SignalR Security — Blazor Server .NET 10

## Table of Contents

1. [Circuit Model & Threats](#circuit-model--threats)
2. [CircuitOptions Hardening](#circuitoptions-hardening)
3. [SignalR Hub Protection](#signalr-hub-protection)
4. [DoS Mitigation](#dos-mitigation)
5. [WebSocket Compression Risks](#websocket-compression-risks)
6. [State Isolation](#state-isolation)
7. [Reconnection Security](#reconnection-security)

---

## Circuit Model & Threats

Blazor Server uses SignalR circuits: persistent connections between client and server. Each circuit holds server memory and has a DI scope. Key threats:

- **Memory exhaustion**: Attacker opens many circuits → server runs out of memory
- **CPU exhaustion**: Attacker triggers expensive computations via circuit events
- **State leakage**: Singleton services accidentally share data between users
- **Fake events**: Malicious client dispatches crafted events to the server
- **Circuit hijacking**: Attacker intercepts/replays SignalR messages

---

## CircuitOptions Hardening

```csharp
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents(options =>
    {
        // How long disconnected circuits stay in memory
        options.DisconnectedCircuitRetentionPeriod = TimeSpan.FromMinutes(3);
        // Default is 100 — reduce for memory-constrained servers
        options.DisconnectedCircuitMaxRetained = 100;
        // Max unacknowledged render batches before circuit is terminated
        options.MaxBufferedUnacknowledgedRenderBatches = 10;

        // CRITICAL: Never true in production!
        options.DetailedErrors = false;
    });
```

### Recommended values by environment

| Setting | Development | Production |
|---------|------------|------------|
| `DetailedErrors` | `true` | **`false`** |
| `DisconnectedCircuitRetentionPeriod` | 5 min | 1-3 min |
| `DisconnectedCircuitMaxRetained` | 200 | 50-100 |
| `MaxBufferedUnacknowledgedRenderBatches` | 10 | 5-10 |

---

## SignalR Hub Protection

### Require authentication on the Blazor hub

```csharp
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .RequireAuthorization(); // Forces auth on SignalR connection
```

### Configure hub options

```csharp
builder.Services.AddSignalR(options =>
{
    // Limit message size to prevent large payload attacks
    options.MaximumReceiveMessageSize = 32 * 1024; // 32 KB default
    // For file uploads, increase selectively per endpoint
    options.StreamBufferCapacity = 10;
    options.EnableDetailedErrors = false; // production
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
});
```

### Disable CORS for SignalR hub (if not needed)

```csharp
// If CORS is globally enabled, disable for Blazor hub
app.MapBlazorHub().RequireCors(policy =>
    policy.WithOrigins("https://yourdomain.com")
          .AllowCredentials());

// Or disable completely with DisableCors attribute
```

---

## DoS Mitigation

### Rate limiting on the server

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
        context => RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsync("Too many requests", ct);
    };
});

app.UseRateLimiter(); // before UseAuthentication
```

### Circuit-level protections

```csharp
// Limit concurrent circuits per user (custom middleware)
public sealed class CircuitLimitMiddleware(RequestDelegate next)
{
    private static readonly ConcurrentDictionary<string, int> _circuitCounts = new();

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/_blazor"))
        {
            var userId = context.User?.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString();
            if (userId is not null)
            {
                var count = _circuitCounts.AddOrUpdate(userId, 1, (_, c) => c + 1);
                if (count > 10) // max 10 circuits per user
                {
                    context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    return;
                }
            }
        }
        await next(context);
    }
}
```

### File upload limits

```csharp
// In InputFile component — always limit size
<InputFile OnChange="HandleFile" accept=".pdf,.xlsx" />

@code {
    private async Task HandleFile(InputFileChangeEventArgs e)
    {
        const long maxFileSize = 10 * 1024 * 1024; // 10 MB
        var file = e.File;

        if (file.Size > maxFileSize)
        {
            _error = "File too large (max 10MB)";
            return;
        }

        // Process with size limit
        await using var stream = file.OpenReadStream(maxFileSize);
    }
}
```

---

## WebSocket Compression Risks

WebSocket compression can expose the app to CRIME/BREACH side-channel attacks against TLS. Blazor mitigates this automatically by:

1. Blocking iframe embedding when compression is enabled
2. Setting `frame-ancestors 'self'` CSP

**If you enable compression**, ensure:

```csharp
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents(options =>
    {
        // If compression is enabled (default in some configs):
        // - frame-ancestors CSP is set automatically to 'self'
        // - Do NOT relax iframe restrictions unless you understand the risk
    });
```

**Rule**: Never render sensitive PII alongside user-controlled data in the same render batch when compression is enabled. An attacker could use the compression oracle to extract secrets.

---

## State Isolation

### Circuit scope = user session (not HTTP request)

Scoped services live for the entire circuit (browser session), not per-request.

```csharp
// ✅ SAFE: Scoped service — isolated per circuit/user
builder.Services.AddScoped<UserSessionState>();

// ❌ DANGEROUS: Singleton with mutable state — shared across ALL users
builder.Services.AddSingleton<SharedState>();

// ✅ SAFE: Singleton but immutable or keyed
builder.Services.AddSingleton<IMemoryCache>(new MemoryCache(
    new MemoryCacheOptions { SizeLimit = 1024 }));
```

### Audit checklist for state leaks

```
□ Search for AddSingleton with mutable state
□ Verify no static fields storing user data
□ Check ConcurrentDictionary singletons for user-keyed data
□ Ensure IDbContextFactory (not singleton DbContext)
□ Review any custom state containers for proper scoping
```

---

## Reconnection Security

When a client reconnects to a Blazor Server app:

1. Authentication is re-evaluated from the existing cookie/token
2. The circuit's DI scope is restored if within retention period
3. If the circuit expired, a new one is created

### Security considerations

- **Session fixation**: Ensure cookies rotate on login (`options.Cookie.MaxAge`)
- **Token expiration**: Check that expired tokens force re-authentication
- **Circuit reuse**: A disconnected circuit retains its state — if a user logs out on another tab, the old circuit may still have the previous auth state until revalidation runs

### Stateful reconnect (.NET 10)

```csharp
// Azure SignalR Service with stateful reconnect
builder.Services.AddSignalR()
    .AddAzureSignalR(options =>
    {
        options.ServerStickyMode = ServerStickyMode.Required;
    });
```

When using stateful reconnect, be aware that reconnection preserves the full circuit state including any sensitive data in memory.
