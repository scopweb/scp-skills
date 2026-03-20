# Anti-Patterns — Razor Pages + MVC + API + Dapper

## Razor Pages

```csharp
// ❌ Binding to domain entity directly — security risk (mass assignment)
[BindProperty]
public Product Product { get; set; } = new(); // exposes ALL properties

// ✅ Use a dedicated InputModel
[BindProperty]
public ProductInputModel Input { get; set; } = new();


// ❌ Returning Page() after successful POST — causes re-submit on F5
public async Task<IActionResult> OnPostAsync()
{
    await _repo.SaveAsync(Input);
    return Page(); // ← user can re-submit by refreshing
}

// ✅ Redirect after POST (PRG pattern)
public async Task<IActionResult> OnPostAsync()
{
    await _repo.SaveAsync(Input);
    TempData["Success"] = "Saved.";
    return RedirectToPage("./Index");
}


// ❌ Not checking ModelState — saves invalid data
public async Task<IActionResult> OnPostAsync()
{
    await _repo.SaveAsync(Input); // runs even if validation failed
    return RedirectToPage("./Index");
}

// ✅ Always check first
if (!ModelState.IsValid) return Page();
```

## API Controllers

```csharp
// ❌ Throwing exceptions for expected errors
[HttpGet("{id:int}")]
public async Task<IActionResult> GetById(int id)
{
    var item = await _repo.GetByIdAsync(id);
    if (item is null) throw new Exception("Not found"); // returns 500
}

// ✅ Return proper HTTP status
if (item is null) return NotFound();


// ❌ Returning raw exception messages to client
catch (Exception ex)
{
    return BadRequest(ex.Message); // exposes internals
}

// ✅ Log internally, return ProblemDetails
catch (Exception ex)
{
    _logger.LogError(ex, "Error getting product {Id}", id);
    return Problem("An error occurred processing your request.");
}


// ❌ Using Controller instead of ControllerBase for APIs
public class ProductsController : Controller // adds view support overhead
{
}

// ✅ Use ControllerBase for APIs
public class ProductsController : ControllerBase
{
}


// ❌ Missing [ApiController] — loses auto-validation and binding inference
[Route("api/[controller]")]
public class ProductsController : ControllerBase { }

// ✅
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase { }
```

## Authentication

```csharp
// ❌ Hardcoding JWT secret
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("my-secret-key"));

// ✅ From configuration (use user secrets in dev, Key Vault in prod)
var key = new SymmetricSecurityKey(
    Encoding.UTF8.GetBytes(config["Jwt:Key"]!));


// ❌ Short JWT secrets (< 32 chars) — HS256 requires 256-bit minimum
"Jwt:Key": "short"

// ✅ Minimum 32 characters
"Jwt:Key": "your-secret-key-must-be-at-least-32-chars!!"


// ❌ Using DateTime.Now for token expiry (local timezone)
expires: DateTime.Now.AddHours(2)

// ✅ Always UTC
expires: DateTime.UtcNow.AddHours(2)


// ❌ Not using LocalRedirect — open redirect vulnerability
return Redirect(returnUrl); // returnUrl could be "https://evil.com"

// ✅
return LocalRedirect(returnUrl ?? "/");


// ❌ Storing JWT in localStorage (XSS vulnerable)
// JavaScript: localStorage.setItem('token', token)

// ✅ Use HttpOnly cookies or sessionStorage with short lifetime
// For API clients that can't use cookies, accept the tradeoff but document it
```

## Dapper

```csharp
// ❌ SQL injection via string interpolation
var sql = $"SELECT * FROM Products WHERE Name = '{name}'";

// ✅ Parameterized always
var sql = "SELECT * FROM Products WHERE Name = @Name";
await db.QueryAsync(new CommandDefinition(sql, new { Name = name }));


// ❌ No CancellationToken — request hangs after client disconnect
await db.QueryAsync<ProductDto>("SELECT * FROM Products");

// ✅ Always pass CT via CommandDefinition
await db.QueryAsync<ProductDto>(new CommandDefinition(sql, cancellationToken: ct));


// ❌ QueryAsync().FirstOrDefault() — fetches all rows then discards
var product = (await db.QueryAsync<ProductDto>(sql, new { Id = id })).FirstOrDefault();

// ✅ QuerySingleOrDefaultAsync — stops after first row
var product = await db.QuerySingleOrDefaultAsync<ProductDto>(
    new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));


// ❌ Scoped IDbConnection used across concurrent operations
// Multiple async calls on same IDbConnection in Blazor circuits is unsafe
// For Razor Pages/MVC this is fine (one request = one connection)


// ❌ Transactions without explicit open
await using var tx = db.BeginTransaction(); // fails if connection not open

// ✅ Open first
if (db is SqlConnection c && c.State != ConnectionState.Open)
    await c.OpenAsync(ct);
await using var tx = await c.BeginTransactionAsync(ct);


// ❌ Catching and swallowing in transaction
catch (Exception)
{
    await tx.RollbackAsync(ct);
    return false; // caller doesn't know what happened
}

// ✅ Rollback and re-throw — let service layer decide
catch
{
    await tx.RollbackAsync(ct);
    throw;
}
```

## Dependency Injection

```csharp
// ❌ Singleton service depending on Scoped service
builder.Services.AddSingleton<CacheService>(); // depends on IDbConnection (Scoped) → captive dependency

// ✅ Inject IServiceScopeFactory in singletons that need scoped services
public sealed class CacheService(IServiceScopeFactory scopeFactory)
{
    public async Task RefreshAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IDbConnection>();
        // ...
    }
}


// ❌ new-ing up services (bypasses DI, no lifetime management)
var service = new ProductRepository(new SqlConnection(connStr));

// ✅ Always inject
public class ProductsController(IProductRepository repo) : ControllerBase { }
```

## General C#

```csharp
// ❌ .Result / .Wait() in async context — deadlock risk
var product = _repo.GetByIdAsync(id).Result;

// ✅ await all the way
var product = await _repo.GetByIdAsync(id);


// ❌ DateTime.Now for stored/compared timestamps
CreatedAt = DateTime.Now; // local timezone, inconsistent across servers

// ✅ UTC everywhere, convert to local only for display
CreatedAt = DateTime.UtcNow;
```
