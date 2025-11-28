# Security & Validation Library

Este directorio contiene utilidades de seguridad, validación y manejo de errores.

## Archivos

### `validation.ts`
Esquemas de validación usando Zod para:
- Autenticación (login, signup)
- Perfiles de usuario
- Ciclos menstruales
- Registros diarios
- Requests de API (Gemini, OCR)

### `rateLimiter.ts`
Sistema de rate limiting para prevenir abuso:
- `geminiRateLimiter`: 20 requests/minuto
- `ocrRateLimiter`: 10 requests/minuto
- `apiRateLimiter`: 100 requests/minuto

### `errorHandler.ts`
Manejo centralizado de errores:
- Oculta detalles en producción
- Logging estructurado
- Respuestas user-friendly

### `security.ts`
Headers de seguridad y utilidades:
- CSP headers
- Validación de imágenes
- CORS validation

## Uso

```typescript
// Validación
import { LoginSchema } from './lib/validation';
const validated = LoginSchema.parse(req.body);

// Rate limiting
import { geminiRateLimiter, rateLimitMiddleware } from './lib/rateLimiter';
const result = rateLimitMiddleware(geminiRateLimiter, req, res);

// Error handling
import { sendErrorResponse, createError } from './lib/errorHandler';
try {
  // ...
} catch (error) {
  sendErrorResponse(res, error, req);
}

// Security headers
import { applySecurityHeaders } from './lib/security';
applySecurityHeaders(res);
```

