# Resilience Pipelines (.NET 8+, Polly v8)

.NET 8 ships **Polly v8** integrated into `Microsoft.Extensions.Http.Resilience`. Configure retry, circuit breaker, timeout, and rate limiter once per HttpClient — your code stays oblivious to transient failures.

For non-HTTP resilience (e.g. Dapper calls to SQL Server, custom operations), use `Microsoft.Extensions.Resilience` and the `ResiliencePipelineBuilder<T>` directly.

---

## The Standard Handler (HTTP — recommended default)

```csharp
builder.Services.AddHttpClient<ExternalApiClient>(client =>
{
    client.BaseAddress = new Uri("https://api.example.com");
    client.Timeout = TimeSpan.FromSeconds(30);
})
.AddStandardResilienceHandler();
```

What `AddStandardResilienceHandler()` gives you out of the box:

| Strategy | Default |
|----------|---------|
| Retry (exponential backoff with jitter) | 3 attempts |
| Circuit breaker | 10% failure ratio over 30s, 2 consecutive faults to open |
| Attempt timeout | 10s per attempt |
| Total request timeout | 30s end-to-end |
| Hedging | off (server has to opt in) |

That's enough for most external API calls. **Use it as-is** unless you have a specific reason to override.

---

## Customizing the Standard Pipeline

```csharp
.AddStandardResilienceHandler(o =>
{
    o.Retry.MaxRetryAttempts = 5;
    o.Retry.Delay = TimeSpan.FromSeconds(2);
    o.Retry.UseJitter = true;
    o.Retry.BackoffType = DelayBackoffType.Exponential;

    o.CircuitBreaker.FailureRatio = 0.3;
    o.CircuitBreaker.MinimumThroughput = 20;
    o.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(60);
    o.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(15);

    o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(5);
    o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(20);
});
```

---

## Custom Pipeline (HTTP)

```csharp
.AddHttpMessageHandler<MyAuthHandler>()
.AddResilienceHandler("customPipeline", builder =>
{
    builder.AddRetry(new RetryStrategyOptions
    {
        MaxRetryAttempts = 4,
        BackoffType = DelayBackoffType.Exponential,
        UseJitter = true,
        Delay = TimeSpan.FromSeconds(1),
        ShouldHandle = new PredicateBuilder()
            .Handle<HttpRequestException>()
            .Handle<TimeoutException>()
            .HandleResult(r => (int)r.StatusCode >= 500),
        OnRetry = args =>
        {
            logger.LogWarning("Retry #{Attempt} after {Delay}",
                args.AttemptNumber, args.RetryDelay);
            return ValueTask.CompletedTask;
        }
    });

    builder.AddCircuitBreaker(new CircuitBreakerStrategyOptions
    {
        FailureRatio = 0.5,
        SamplingDuration = TimeSpan.FromSeconds(30),
        MinimumThroughput = 10,
        BreakDuration = TimeSpan.FromSeconds(20)
    });

    builder.AddTimeout(TimeSpan.FromSeconds(5));
});
```

---

## Strategies Reference

| Strategy | Purpose |
|----------|---------|
| `AddRetry` | Retry transient failures with backoff + jitter |
| `AddCircuitBreaker` | Stop calling a failing dependency for a while |
| `AddTimeout` | Per-attempt or total timeout |
| `AddRateLimiter` | Limit outgoing calls (concurrency or per-window) |
| `AddHedging` | Send parallel requests, take the first response |
| `AddFallback` | Return a default when everything else fails |

### Rate limiter

```csharp
builder.AddRateLimiter(new RateLimiterStrategyOptions
{
    Type = RateLimiterType.Concurrency,
    Limit = 20  // max in-flight
});
```

### Hedging (advanced)

```csharp
builder.AddHedging(new HedgingStrategyOptions
{
    MaxHedgedAttempts = 2,
    Delay = TimeSpan.FromSeconds(1),
    ShouldHandle = new PredicateBuilder().Handle<HttpRequestException>()
});
```

### Fallback

```csharp
builder.AddFallback(new FallbackStrategyOptions
{
    FallbackAction = args => ValueTask.FromResult<Outcome<HttpResponseMessage>>(
        Outcome.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"cached":true}""")
        })),
});
```

---

## Resilience for Non-HTTP (Dapper, EF, custom)

```csharp
public sealed class OrderService(
    IDbConnectionFactory<SqlConnection> connectionFactory,
    ResiliencePipelineProvider<string> pipelineProvider)
{
    public async Task<Order?> GetByIdResilientAsync(int id, CancellationToken ct = default)
    {
        var pipeline = pipelineProvider.GetPipeline("dapper-read");

        return await pipeline.ExecuteAsync(async token =>
        {
            await using var conn = await connectionFactory.CreateConnectionAsync(token);
            return await conn.QueryFirstOrDefaultAsync<Order>(new CommandDefinition(
                "SELECT * FROM dbo.Orders WHERE Id = @Id",
                new { id },
                cancellationToken: token));
        }, ct);
    }
}
```

```csharp
// Program.cs
builder.Services.AddResiliencePipeline("dapper-read", b =>
{
    b.AddRetry(new RetryStrategyOptions
    {
        MaxRetryAttempts = 3,
        BackoffType = DelayBackoffType.Exponential,
        ShouldHandle = new PredicateBuilder()
            .Handle<SqlException>(ex => ex.Number is 1205 or 1222)  // deadlock, lock timeout
            .Handle<TimeoutException>()
    });
    b.AddTimeout(TimeSpan.FromSeconds(10));
});
```

> Be careful with retries for SQL: a non-idempotent `INSERT` or `UPDATE` is **not safe** to retry unless you use a unique request id / idempotency key.

---

## Observability

Polly v8 emits `System.Diagnostics` activities and `ILogger` events automatically. To see traces:

```csharp
// Program.cs
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t.AddSource("Polly.HttpResilience"));
```

Standard log events: `OnRetry`, `OnOpened` (circuit), `OnClosed`, `OnHalfOpened`.

---

## Anti-Patterns

```csharp
// ❌ WRONG — manual try/wait/retry loop
for (int i = 0; i < 3; i++)
{
    try { return await Http.GetAsync(url); }
    catch { await Task.Delay(1000 * (i + 1)); }
}
throw new Exception("failed");

// ❌ WRONG — retrying a non-idempotent operation
.AddRetry() on a POST /api/transfer endpoint  // charges the card twice

// ❌ WRONG — per-request HttpClient in a Blazor component
@inject HttpClient Http   // wrong — use IHttpClientFactory or a typed client
var client = new HttpClient();  // socket exhaustion

// ❌ WRONG — circuit breaker without a fallback
// When the breaker is open the call still throws BrokenCircuitException;
// if there's no fallback the user sees a 500

// ❌ WRONG — exponential backoff without jitter
Delay = TimeSpan.FromSeconds(Math.Pow(2, attempt))  // thundering herd on recovery
```

---

## Quick Reference

| Need | API |
|------|-----|
| Standard pipeline | `AddStandardResilienceHandler()` |
| Customize default | `AddStandardResilienceHandler(o => { o.Retry.... })` |
| Custom HTTP pipeline | `AddResilienceHandler("name", b => { ... })` |
| Non-HTTP pipeline | `AddResiliencePipeline("name", b => { ... })` |
| Get a pipeline | `ResiliencePipelineProvider<string>.GetPipeline("name")` |
| Retry strategy | `AddRetry(new RetryStrategyOptions { ... })` |
| Circuit breaker | `AddCircuitBreaker(new CircuitBreakerStrategyOptions { ... })` |
| Per-attempt timeout | `AddTimeout(TimeSpan)` |
| Total timeout | Set `HttpClient.Timeout` |
| Predictable retry | `ShouldHandle = new PredicateBuilder().Handle<TException>()` |
