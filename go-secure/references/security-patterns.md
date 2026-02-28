# Security Patterns in Go

Referencia de patrones de seguridad para aplicaciones Go. Cargar cuando se implementen
funcionalidades relacionadas con crypto, TLS, autenticación, validación de inputs o HTTP.

---

## 1. Validación y Sanitización de Inputs

### Siempre validar antes de procesar

```go
// MAL: usar input directamente
func processName(name string) string {
    return strings.ToUpper(name)
}

// BIEN: validar primero
func processName(name string) (string, error) {
    if len(name) == 0 {
        return "", errors.New("name cannot be empty")
    }
    if len(name) > 100 {
        return "", errors.New("name too long: max 100 chars")
    }
    for _, r := range name {
        if !unicode.IsLetter(r) && !unicode.IsSpace(r) {
            return "", fmt.Errorf("invalid character: %q", r)
        }
    }
    return strings.TrimSpace(name), nil
}
```

### Path traversal prevention

```go
func safeFilePath(base, userInput string) (string, error) {
    clean := filepath.Clean(userInput)
    full := filepath.Join(base, clean)
    if !strings.HasPrefix(full, filepath.Clean(base)+string(os.PathSeparator)) {
        return "", errors.New("path traversal detected")
    }
    return full, nil
}
```

---

## 2. Criptografía con stdlib

### Hashing seguro de contraseñas (bcrypt - única dep externa justificada)

```go
import "golang.org/x/crypto/bcrypt"

func hashPassword(password string) (string, error) {
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(bytes), err
}

func checkPassword(password, hash string) bool {
    return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
```

### Generación de tokens seguros (stdlib)

```go
import "crypto/rand"
import "encoding/hex"

func generateToken(length int) (string, error) {
    bytes := make([]byte, length)
    if _, err := rand.Read(bytes); err != nil {
        return "", fmt.Errorf("generating token: %w", err)
    }
    return hex.EncodeToString(bytes), nil
}
```

### AES-GCM para cifrado simétrico (stdlib)

```go
import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "errors"
    "io"
)

func encrypt(key, plaintext []byte) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    nonce := make([]byte, gcm.NonceSize())
    if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }
    return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func decrypt(key, ciphertext []byte) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    if len(ciphertext) < gcm.NonceSize() {
        return nil, errors.New("ciphertext too short")
    }
    nonce, ct := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
    return gcm.Open(nil, nonce, ct, nil)
}
```

---

## 3. HTTP Seguro

### Cliente HTTP con timeouts obligatorios

```go
// MAL: http.DefaultClient (sin timeouts = DoS vulnerable)
resp, err := http.Get(url)

// BIEN: cliente con timeouts explícitos
client := &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        DialContext: (&net.Dialer{
            Timeout:   10 * time.Second,
            KeepAlive: 30 * time.Second,
        }).DialContext,
        TLSHandshakeTimeout:   10 * time.Second,
        ResponseHeaderTimeout: 10 * time.Second,
        MaxIdleConns:          100,
        MaxIdleConnsPerHost:   10,
    },
}
resp, err := client.Get(url)
```

### Servidor HTTP con headers de seguridad

```go
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-XSS-Protection", "1; mode=block")
        w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        w.Header().Set("Content-Security-Policy", "default-src 'self'")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        next.ServeHTTP(w, r)
    })
}
```

### Limitar body size

```go
func handler(w http.ResponseWriter, r *http.Request) {
    r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB max
}
```

---

## 4. Gestión Segura de Secretos

```go
func loadConfig() (Config, error) {
    dbPass := os.Getenv("DB_PASSWORD")
    if dbPass == "" {
        return Config{}, errors.New("DB_PASSWORD env var required")
    }
    apiKey := os.Getenv("API_KEY")
    if apiKey == "" {
        return Config{}, errors.New("API_KEY env var required")
    }
    return Config{DBPassword: dbPass, APIKey: apiKey}, nil
}

func processSecret(secret []byte) {
    defer func() {
        for i := range secret {
            secret[i] = 0 // Zeroize memory
        }
    }()
}
```

---

## 5. SQL: Prevención de Inyección

```go
// MAL: concatenar strings
query := "SELECT * FROM users WHERE name = '" + userInput + "'"

// BIEN: prepared statements siempre
rows, err := db.QueryContext(ctx,
    "SELECT id, name FROM users WHERE name = $1", userInput)
```

---

## 6. Context y Timeouts

```go
func fetchData(ctx context.Context, url string) ([]byte, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil {
        return nil, fmt.Errorf("creating request: %w", err)
    }
    resp, err := client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("executing request: %w", err)
    }
    defer resp.Body.Close()
    return io.ReadAll(io.LimitReader(resp.Body, 10<<20))
}
```

---

## 7. Concurrencia Segura

```go
func worker(ctx context.Context, jobs <-chan Job, wg *sync.WaitGroup) {
    defer wg.Done()
    for {
        select {
        case <-ctx.Done():
            return
        case job, ok := <-jobs:
            if !ok {
                return
            }
            processJob(job)
        }
    }
}
```

---

## 8. TLS Configuration

```go
func secureTLSConfig() *tls.Config {
    return &tls.Config{
        MinVersion:               tls.VersionTLS12,
        PreferServerCipherSuites: true,
        CurvePreferences: []tls.CurveID{
            tls.X25519,
            tls.CurveP256,
        },
        CipherSuites: []uint16{
            tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
            tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
        },
    }
}
```
