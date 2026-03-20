# Security Testing in Go

Referencia para tests de seguridad en Go 1.26. Cargar cuando el usuario pida tests, fuzzing,
o revisión de cobertura de seguridad en código Go.

---

## Estructura de Tests de Seguridad

Todo archivo `_test.go` de seguridad debe cubrir:

1. **Happy path** — Inputs válidos funcionan correctamente
2. **Boundary testing** — Límites de longitud, tamaño, rango
3. **Malicious inputs** — Inputs diseñados para explotar vulnerabilidades
4. **Concurrency safety** — Race conditions con `-race`
5. **Error handling** — Los errores se propagan correctamente

---

## Plantilla Base de Tests de Seguridad

```go
package mypackage_test

import (
    "strings"
    "testing"
)

func TestValidateInput_Security(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
        errMsg  string
    }{
        // Happy path
        {name: "valid input", input: "Hello World", wantErr: false},

        // Boundary testing
        {name: "empty input", input: "", wantErr: true, errMsg: "empty"},
        {name: "max length exactly", input: strings.Repeat("a", 100), wantErr: false},
        {name: "over max length", input: strings.Repeat("a", 101), wantErr: true, errMsg: "too long"},

        // Malicious inputs - SQL Injection
        {name: "sql injection", input: "'; DROP TABLE users; --", wantErr: true},
        {name: "sql injection 2", input: "1 OR 1=1", wantErr: true},

        // Malicious inputs - XSS
        {name: "xss attempt", input: "<script>alert('xss')</script>", wantErr: true},

        // Malicious inputs - Path Traversal
        {name: "path traversal", input: "../../../etc/passwd", wantErr: true},
        {name: "path traversal encoded", input: "..%2F..%2Fetc%2Fpasswd", wantErr: true},

        // Null bytes y caracteres de control
        {name: "null byte", input: "hello\x00world", wantErr: true},
        {name: "newline injection", input: "hello\nworld", wantErr: true},

        // Unicode edge cases
        {name: "unicode control chars", input: "hello\u202Eworld", wantErr: true},
        {name: "valid unicode", input: "héllo wörld", wantErr: false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := ValidateInput(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidateInput(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
                return
            }
            if tt.wantErr && tt.errMsg != "" && err != nil {
                if !strings.Contains(err.Error(), tt.errMsg) {
                    t.Errorf("error %q doesn't contain expected message %q", err.Error(), tt.errMsg)
                }
            }
        })
    }
}
```

---

## Fuzzing (Go 1.18+)

```go
// Archivo: fuzz_test.go
package mypackage_test

import (
    "strings"
    "testing"
    "unicode/utf8"
)

// Ejecutar: go test -fuzz=FuzzValidateInput -fuzztime=30s
func FuzzValidateInput(f *testing.F) {
    // Seeds: casos conocidos como punto de partida
    f.Add("")
    f.Add("hello")
    f.Add("'; DROP TABLE users; --")
    f.Add("<script>alert(1)</script>")
    f.Add(strings.Repeat("a", 1000))
    f.Add("\x00\x01\x02")
    f.Add("../../../etc/passwd")

    f.Fuzz(func(t *testing.T, input string) {
        result, err := ValidateInput(input)

        // Si no hay error, el resultado debe ser válido UTF-8
        if err == nil && !utf8.ValidString(result) {
            t.Errorf("ValidateInput returned invalid UTF-8: %q", result)
        }

        // Si hay resultado, no debe contener chars peligrosos
        if err == nil {
            if strings.ContainsAny(result, "<>\x00") {
                t.Errorf("ValidateInput returned dangerous chars: %q", result)
            }
        }
    })
}

func FuzzSafeFilePath(f *testing.F) {
    f.Add("/safe/base", "file.txt")
    f.Add("/safe/base", "../../../etc/passwd")
    f.Add("/safe/base", "subdir/file.txt")

    f.Fuzz(func(t *testing.T, base, input string) {
        result, err := SafeFilePath(base, input)
        if err == nil {
            if !strings.HasPrefix(result, filepath.Clean(base)) {
                t.Errorf("path traversal not prevented: base=%q input=%q result=%q",
                    base, input, result)
            }
        }
    })
}
```

---

## Race Condition Tests (Go 1.22+: loop variables seguras)

```go
func TestSafeCounter_Concurrent(t *testing.T) {
    counter := &SafeCounter{}
    const goroutines = 100
    const increments = 1000

    var wg sync.WaitGroup

    // Go 1.22+: i tiene su propia variable en cada iteración, no necesita captura
    for range goroutines {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for range increments {
                counter.Increment()
            }
        }()
    }
    wg.Wait()

    expected := goroutines * increments
    if got := counter.Value(); got != expected {
        t.Errorf("expected %d, got %d", expected, got)
    }
}

// Ejecutar con: go test -race -count=5 ./...
```

---

## Tests de Crypto

```go
func TestGenerateToken_Uniqueness(t *testing.T) {
    tokens := make(map[string]bool, 1000)
    for range 1000 { // Go 1.22+: range sobre entero
        token, err := GenerateToken(32)
        if err != nil {
            t.Fatalf("unexpected error: %v", err)
        }
        if tokens[token] {
            t.Fatal("duplicate token generated")
        }
        tokens[token] = true
        if len(token) < 32 {
            t.Errorf("token too short: %d", len(token))
        }
    }
}

func TestEncryptDecrypt_Roundtrip(t *testing.T) {
    key := make([]byte, 32)
    if _, err := rand.Read(key); err != nil {
        t.Fatal(err)
    }

    tests := [][]byte{
        []byte("hello world"),
        []byte(""),
        make([]byte, 10000),
        {0x00, 0xFF, 0x00},
    }

    for _, plaintext := range tests {
        ciphertext, err := Encrypt(key, plaintext)
        if err != nil {
            t.Fatalf("encrypt error: %v", err)
        }

        decrypted, err := Decrypt(key, ciphertext)
        if err != nil {
            t.Fatalf("decrypt error: %v", err)
        }

        if !bytes.Equal(plaintext, decrypted) {
            t.Error("decrypted doesn't match original")
        }
    }
}

func TestDecrypt_TamperedCiphertext(t *testing.T) {
    key := make([]byte, 32)
    rand.Read(key)

    ciphertext, _ := Encrypt(key, []byte("secret"))
    ciphertext[len(ciphertext)-1] ^= 0xFF // Tamper

    _, err := Decrypt(key, ciphertext)
    if err == nil {
        t.Error("expected error for tampered ciphertext, got nil")
    }
}
```

---

## Tests de HTTP Security

```go
func TestSecurityHeaders(t *testing.T) {
    handler := securityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))

    req := httptest.NewRequest(http.MethodGet, "/", nil)
    rec := httptest.NewRecorder()
    handler.ServeHTTP(rec, req)

    headers := map[string]string{
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options":        "DENY",
        "X-XSS-Protection":       "1; mode=block",
    }

    for header, expected := range headers {
        if got := rec.Header().Get(header); got != expected {
            t.Errorf("header %s = %q, want %q", header, got, expected)
        }
    }
}

func TestBodySizeLimit(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
        if err := r.ParseForm(); err != nil {
            http.Error(w, "Request too large", http.StatusRequestEntityTooLarge)
            return
        }
        w.WriteHeader(http.StatusOK)
    }))
    defer server.Close()

    largeBody := strings.NewReader(strings.Repeat("a", 2<<20))
    resp, err := http.Post(server.URL, "text/plain", largeBody)
    if err != nil {
        t.Fatal(err)
    }
    if resp.StatusCode != http.StatusRequestEntityTooLarge {
        t.Errorf("expected 413, got %d", resp.StatusCode)
    }
}

// Test del nuevo ServeMux con method routing (Go 1.22+)
func TestMethodRouting(t *testing.T) {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /items/{id}", func(w http.ResponseWriter, r *http.Request) {
        id := r.PathValue("id")
        if id == "" {
            http.Error(w, "missing id", http.StatusBadRequest)
            return
        }
        w.WriteHeader(http.StatusOK)
    })

    // GET debe funcionar
    req := httptest.NewRequest(http.MethodGet, "/items/123", nil)
    rec := httptest.NewRecorder()
    mux.ServeHTTP(rec, req)
    if rec.Code != http.StatusOK {
        t.Errorf("GET /items/123 expected 200, got %d", rec.Code)
    }

    // POST debe retornar 405
    req = httptest.NewRequest(http.MethodPost, "/items/123", nil)
    rec = httptest.NewRecorder()
    mux.ServeHTTP(rec, req)
    if rec.Code != http.StatusMethodNotAllowed {
        t.Errorf("POST /items/123 expected 405, got %d", rec.Code)
    }
}
```

---

## Comandos de Testing

```bash
# Tests básicos
go test ./...

# Con race detector (SIEMPRE en CI)
go test -race ./...

# Fuzzing (30 segundos por función)
go test -fuzz=FuzzXxx -fuzztime=30s ./pkg/...

# Cobertura
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Verificar vulnerabilidades en deps
govulncheck ./...

# Benchmark de seguridad (crypto principalmente)
go test -bench=BenchmarkEncrypt -benchmem ./...

# Todo junto para CI
go test -race -coverprofile=coverage.out ./... && \
  govulncheck ./... && \
  go vet ./...
```

---

## Checklist de Tests por Tipo de Funcionalidad

| Funcionalidad | Tests Obligatorios |
|--------------|-------------------|
| Validación de inputs | Vacío, límites, SQL injection, XSS, path traversal, null bytes |
| Autenticación | Credenciales inválidas, tokens expirados, tokens manipulados |
| Crypto (hash/encrypt) | Roundtrip, uniqueness, tampered data, empty input |
| HTTP handlers | Headers de seguridad, body size limit, timeouts, method routing |
| File operations | Path traversal, permisos, symlinks |
| Concurrencia | Race detector con múltiples goroutines (`-race`) |
| Parsing (JSON/XML/YAML) | Inputs malformados, bomba zip, deeply nested |
