# Testing — .NET 10 Console / CLI Tools

## NuGet Packages

```xml
<ItemGroup Condition="'$(Configuration)'=='Debug'">
  <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.*" />
  <PackageReference Include="xunit" Version="2.*" />
  <PackageReference Include="xunit.runner.visualstudio" Version="2.*" />
  <PackageReference Include="Microsoft.Extensions.Hosting" Version="10.*" />
  <PackageReference Include="NSubstitute" Version="5.*" />
  <PackageReference Include="FluentAssertions" Version="7.*" />
</ItemGroup>
```

---

## Unit Tests — Service Layer

```csharp
// MyService.Tests.cs
public sealed class MyServiceTests
{
    private readonly ILogger<MyService> _logger = NSubstitute.Substitute.For<ILogger<MyService>>();
    private readonly IOptions<AppSettings> _options;

    public MyServiceTests()
    {
        _options = Options.Create(new AppSettings { BatchSize = 10 });
    }

    [Fact]
    public async Task ProcessAsync_ValidInput_ReturnsSuccess()
    {
        // Arrange
        var sut = new MyService(_logger, _options);

        // Act
        var result = await sut.ProcessAsync("valid_input", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task ProcessAsync_EmptyInput_ReturnsFail(string? input)
    {
        var sut = new MyService(_logger, _options);

        var result = await sut.ProcessAsync(input!, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("empty");
    }

    [Fact]
    public async Task ProcessAsync_CancellationRequested_ThrowsOrReturnsFail()
    {
        var sut = new MyService(_logger, _options);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        var act = () => sut.ProcessAsync("input", cts.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();
    }
}
```

---

## Integration Tests — Full IHost

```csharp
// Integration test bootstraps the real host with test configuration
public sealed class AppIntegrationTests : IAsyncLifetime
{
    private IHost? _host;

    public async Task InitializeAsync()
    {
        _host = Host.CreateApplicationBuilder()
            .ConfigureAppConfiguration(config =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["App:BatchSize"] = "5",
                    ["App:OutputPath"] = Path.GetTempPath()
                });
            })
            .ConfigureServices(services =>
            {
                services.AddSingleton<IMyService, MyService>();
                // Override real external deps with fakes
                services.AddSingleton<IExternalApi, FakeExternalApi>();
            })
            .ConfigureLogging(logging => logging.ClearProviders())  // quiet tests
            .Build();

        await _host.StartAsync();
    }

    public async Task DisposeAsync()
    {
        if (_host is not null)
        {
            await _host.StopAsync();
            _host.Dispose();
        }
    }

    [Fact]
    public async Task FullPipeline_ProcessesInputFile_ProducesOutput()
    {
        // Arrange
        var service = _host!.Services.GetRequiredService<IMyService>();
        var tempInput = Path.GetTempFileName();
        await File.WriteAllTextAsync(tempInput, "test,data");

        // Act
        var result = await service.ProcessFileAsync(tempInput, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        File.Exists(result.Value!.OutputPath).Should().BeTrue();

        // Cleanup
        File.Delete(tempInput);
    }
}
```

---

## Fake Implementations

```csharp
// FakeExternalApi.cs — deterministic, no network in tests
public sealed class FakeExternalApi : IExternalApi
{
    private readonly List<string> _calls = [];
    public IReadOnlyList<string> Calls => _calls;

    public Task<string> FetchDataAsync(string id, CancellationToken ct)
    {
        _calls.Add(id);
        return Task.FromResult($"fake_data_for_{id}");
    }
}
```

---

## Test Configuration Helpers

```csharp
// TestHostBuilder.cs — reusable across test classes
public static class TestHostBuilder
{
    public static IHostBuilder Create(
        Action<IServiceCollection>? configureServices = null,
        Dictionary<string, string?>? config = null)
    {
        return new HostBuilder()
            .ConfigureAppConfiguration(c =>
            {
                c.AddInMemoryCollection(config ?? []);
            })
            .ConfigureServices((ctx, services) =>
            {
                services.Configure<AppSettings>(ctx.Configuration.GetSection("App"));
                services.AddSingleton<IMyService, MyService>();
                configureServices?.Invoke(services);
            })
            .ConfigureLogging(l => l.ClearProviders());
    }
}

// Usage in tests
var host = TestHostBuilder.Create(
    services => services.AddSingleton<IExternalApi, FakeExternalApi>(),
    config: new() { ["App:BatchSize"] = "1" }
).Build();
```

---

## What to Test in CLI Tools

| Layer | Test type | Key scenarios |
|-------|-----------|---------------|
| Service logic | Unit | Valid input, invalid input, boundary values, cancellation |
| Config binding | Unit | Required fields, validation rules |
| File I/O | Integration | File not found, permission denied, large files |
| Full pipeline | Integration | Happy path with fake external deps |
| CLI args | Unit | Required args missing, type coercion, defaults |

**Skip:** Serilog output (tested by the library), `Environment.ExitCode` (verify indirectly via result), timing-sensitive behavior (use `TimeProvider` abstraction instead of `DateTime.Now`).

---

## CI Integration

```yaml
# .github/workflows/test.yml
- name: Test
  run: dotnet test --no-build --logger "trx;LogFileName=results.trx" --collect:"XPlat Code Coverage"

- name: Coverage report
  uses: danielpalme/ReportGenerator-GitHub-Action@5
  with:
    reports: "**/coverage.cobertura.xml"
    targetdir: coverage-report
    reporttypes: Html;Cobertura
```
