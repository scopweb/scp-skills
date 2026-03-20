# Security Patterns in Go

Referencia de patrones de seguridad para aplicaciones Go 1.26. Cargar cuando se implementen
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
    // Solo caracteres alfabéticos y espacios
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
import "golang.org/x/crypto/bcrypt"  // Caso especial: bcrypt no está en stdlib

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
import (
    "crypto/rand"
    "encoding/hex"
)

func generateToken(length int) (string, error) {
    b := make([]byte, length)
    if _, err := rand.Read(b); err != nil {
        return "", fmt.Errorf("generating token: %w", err)
    }
    return hex.EncodeToString(b), nil
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
    block, err := aes.NewCipher(key) // key debe ser 16, 24 o 32 bytes
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

### ServeMux con method routing (Go 1.22+)

```go
// Go 1.22+: method + path patterns en el mux estándar
mux := http.NewServeMux()

// El método se especifica directamente — no hace falta router externo para casos simples
mux.HandleFunc("GET /users/{id}", getUser)
mux.HandleFunc("POST /users", createUser)
mux.HandleFunc("DELETE /users/{id}", deleteUser)

func getUser(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id") // Nuevo en Go 1.22
    // validar id antes de usar
}
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

### Limitar body size para evitar ataques

```go
func handler(w http.ResponseWriter, r *http.Request) {
    r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB max
    // ...
}
```

---

## 4. Gestión Segura de Secretos

### Leer de variables de entorno

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
```

### Zeroizar secretos en memoria después de usar

```go
func processSecret(secret []byte) {
    defer func() {
        for i := range secret {
            secret[i] = 0
        }
    }()
    // usar secret...
}
```

---

## 5. SQL: Prevención de Inyección

```go
// MAL: concatenar strings = SQL injection
query := "SELECT * FROM users WHERE name = '" + userInput + "'"

// BIEN: prepared statements siempre
rows, err := db.QueryContext(ctx,
    "SELECT id, name FROM users WHERE name = $1", userInput)
```

---

## 6. Context y Timeouts en Operaciones

```go
// Toda operación con I/O, red o DB debe aceptar context
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
    return io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
}

// Añadir timeout en el punto de entrada
func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    data, err := fetchData(ctx, "https://api.example.com/data")
    _ = data
    _ = err
}
```

---

## 7. Concurrencia Segura

### Loop variables en goroutines (Go 1.22+: ya no hace falta captura explícita)

```go
// Go 1.21 y anterior — era necesario capturar la variable
for _, item := range items {
    item := item // captura necesaria en versiones < 1.22
    go process(item)
}

// Go 1.22+ — cada iteración tiene su propia variable, captura ya NO es necesaria
for _, item := range items {
    go process(item) // seguro: item es independiente en cada iteración
}
```

### Goroutine con lifecycle controlado

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

### Uso seguro de datos compartidos

```go
type SafeCounter struct {
    mu    sync.Mutex
    value int
}

func (c *SafeCounter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.value++
}

func (c *SafeCounter) Value() int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.value
}
```

---

## 8. TLS Configuration (Go 1.26 — post-quantum ready)

```go
import "crypto/tls"

func secureTLSConfig() *tls.Config {
    return &tls.Config{
        MinVersion: tls.VersionTLS13, // TLS 1.3 por defecto en Go 1.26; 1.2 solo si es imprescindible
        // PreferServerCipherSuites: eliminado — Go gestiona esto automáticamente desde 1.18
        CurvePreferences: []tls.CurveID{
            tls.X25519MLKEM768, // Go 1.24+: híbrido post-quantum (preferido)
            tls.X25519,
            tls.CurveP256,
        },
        // CipherSuites solo aplica a TLS 1.2; en TLS 1.3 Go los gestiona automáticamente
        CipherSuites: []uint16{
            tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
            tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
        },
    }
}
```

---

## 9. Logging Seguro con log/slog (Go 1.21+ stdlib)

```go
import "log/slog"

// MAL: log.Printf con datos sin estructura (difícil de auditar)
log.Printf("user login failed: %s from %s", username, ip)

// BIEN: slog estructurado, sin exponer datos sensibles
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelInfo,
}))

// Nunca loguear contraseñas, tokens o secretos completos
logger.Warn("login failed",
    slog.String("user", username),
    slog.String("ip", ip),
    // NO: slog.String("password", password)
)

// Pasar logger por context en aplicaciones
func withLogger(ctx context.Context, logger *slog.Logger) context.Context {
    return context.WithValue(ctx, loggerKey{}, logger)
}
```

---

## 10. Números Aleatorios Seguros (Go 1.22+)

```go
// MAL: math/rand legado (predecible, deprecado en Go 1.20+)
import "math/rand"
n := rand.Intn(100)

// BIEN para valores no criptográficos: math/rand/v2 (Go 1.22+)
import "math/rand/v2"
n := rand.N(100) // genérico, type-safe

// BIEN para valores criptográficos: siempre crypto/rand
import "crypto/rand"
import "math/big"
n, err := rand.Int(rand.Reader, big.NewInt(100))
```
