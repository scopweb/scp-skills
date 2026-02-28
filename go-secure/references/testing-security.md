# Security Testing in Go

Referencia para tests de seguridad. Cargar cuando el usuario pida tests, fuzzing,
o revisión de cobertura de seguridad en código Go.

---

## Estructura de Tests de Seguridad

Todo `_test.go` de seguridad debe cubrir:

1. **Happy path** — Inputs válidos funcionan correctamente
2. **Boundary testing** — Límites de longitud, tamaño, rango
3. **Malicious inputs** — SQL injection, XSS, path traversal, null bytes
4. **Concurrency safety** — Race conditions con `-race`
5. **Error handling** — Los errores se propagan correctamente

---

## Plantilla Base

```go
package mypackage_test

import (
    "testing"
    "strings"
)

func TestValidateInput_Security(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
        errMsg  string
    }{
        {name: "valid input", input: "Hello World", wantErr: false},
        {name: "empty input", input: "", wantErr: true, errMsg: "empty"},
        {name: "max length exactly", input: strings.Repeat("a", 100), wantErr: false},
        {name: "over max length", input: strings.Repeat("a", 101), wantErr: true, errMsg: "too long"},
        {name: "sql injection", input: "'; DROP TABLE users; --", wantErr: true},
        {name: "sql injection 2", input: "1 OR 1=1", wantErr: true},
        {name: "xss attempt", input: "<script>alert('xss')</script>", wantErr: true},
        {name: "path traversal", input: "../../../etc/passwd", wantErr: true},
        {name: "path traversal encoded", input: "..%2F..%2Fetc%2Fpasswd", wantErr: true},
        {name: "null byte", input: "hello\x00world", wantErr: true},
        {name: "newline injection", input: "hello\nworld", wantErr: true},
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
                    t.Errorf("error %q doesn't contain %q", err.Error(), tt.errMsg)
                }
            }
        })
    }
}
```

---

## Fuzzing (Go 1.18+)

```go
// Ejecutar: go test -fuzz=FuzzValidateInput -fuzztime=30s
func FuzzValidateInput(f *testing.F) {
    f.Add("")
    f.Add("hello")
    f.Add("'; DROP TABLE users; --")
    f.Add("<script>alert(1)</script>")
    f.Add(strings.Repeat("a", 1000))
    f.Add("\x00\x01\x02")
    f.Add("../../../etc/passwd")

    f.Fuzz(func(t *testing.T, input string) {
        result, err := ValidateInput(input)
        if err == nil && !utf8.ValidString(result) {
            t.Errorf("returned invalid UTF-8: %q", result)
        }
        if err == nil && strings.ContainsAny(result, "<>\x00") {
            t.Errorf("returned dangerous chars: %q", result)
        }
    })
}

func FuzzSafeFilePath(f *testing.F) {
    f.Add("/safe/base", "file.txt")
    f.Add("/safe/base", "../../../etc/passwd")

    f.Fuzz(func(t *testing.T, base, input string) {
        result, err := SafeFilePath(base, input)
        if err == nil && !strings.HasPrefix(result, filepath.Clean(base)) {
            t.Errorf("path traversal not prevented: base=%q input=%q result=%q", base, input, result)
        }
    })
}
```

---

## Race Condition Tests

```go
func TestSafeCounter_Concurrent(t *testing.T) {
    counter := &SafeCounter{}
    const goroutines = 100
    const increments = 1000

    var wg sync.WaitGroup
    for i := 0; i < goroutines; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for j := 0; j < increments; j++ {
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
    tokens := make(map[string]bool)
    for i := 0; i < 1000; i++ {
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
    rand.Read(key)

    cases := [][]byte{
        []byte("hello world"),
        []byte(""),
        make([]byte, 10000),
        {0x00, 0xFF, 0x00},
    }

    for _, plaintext := range cases {
        ct, err := Encrypt(key, plaintext)
        if err != nil {
            t.Fatalf("encrypt: %v", err)
        }
        got, err := Decrypt(key, ct)
        if err != nil {
            t.Fatalf("decrypt: %v", err)
        }
        if !bytes.Equal(plaintext, got) {
            t.Error("decrypted doesn't match original")
        }
    }
}

func TestDecrypt_TamperedCiphertext(t *testing.T) {
    key := make([]byte, 32)
    rand.Read(key)
    ct, _ := Encrypt(key, []byte("secret"))
    ct[len(ct)-1] ^= 0xFF
    if _, err := Decrypt(key, ct); err == nil {
        t.Error("expected error for tampered ciphertext")
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

    want := map[string]string{
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options":        "DENY",
        "X-XSS-Protection":       "1; mode=block",
    }
    for h, v := range want {
        if got := rec.Header().Get(h); got != v {
            t.Errorf("header %s = %q, want %q", h, got, v)
        }
    }
}
```

---

## Comandos CI

```bash
# Tests básicos
go test ./...

# Con race detector (SIEMPRE en CI)
go test -race ./...

# Fuzzing
go test -fuzz=FuzzXxx -fuzztime=30s ./pkg/...

# Cobertura
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Vulnerabilidades en deps
govulncheck ./...

# Todo junto para CI
go test -race -coverprofile=coverage.out ./... && \
  govulncheck ./... && \
  go vet ./...
```

---

## Checklist por Tipo de Funcionalidad

| Funcionalidad | Tests Obligatorios |
|--------------|-------------------|
| Validación inputs | Vacío, límites, SQL injection, XSS, path traversal, null bytes |
| Autenticación | Credenciales inválidas, tokens expirados, tokens manipulados |
| Crypto | Roundtrip, uniqueness, tampered data, empty input |
| HTTP handlers | Headers seguridad, body size limit, timeouts |
| File operations | Path traversal, permisos, symlinks |
| Concurrencia | Race detector con múltiples goroutines |
| Parsing (JSON/XML) | Inputs malformados, deeply nested |
