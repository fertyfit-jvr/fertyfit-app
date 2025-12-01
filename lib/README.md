# Logger Library

Este directorio contiene el logger centralizado para el frontend.

## Archivos

### `logger.ts`
Logger centralizado que solo muestra logs en desarrollo:
- `logger.log()` - Logs en desarrollo
- `logger.error()` - Siempre muestra errores
- `logger.warn()` - Warnings en desarrollo
- `logger.info()` - Info en desarrollo
- `logger.debug()` - Debug en desarrollo

## Uso

```typescript
import { logger } from './lib/logger';

logger.log('Mensaje informativo');
logger.error('Error:', error);
logger.warn('Advertencia');
```

## Nota

Las utilidades de seguridad, validación y manejo de errores para las APIs serverless se encuentran en `api/lib/`.
