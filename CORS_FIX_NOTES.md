# Problemas CORS y Solución

## Problema Actual

El endpoint de Vercel `/api/ocr/process` estaba bloqueando las peticiones desde `localhost:5173` por CORS.

## Solución Implementada

### 1. CORS configurado correctamente en el endpoint
- El endpoint maneja CORS PRIMERO, antes de cualquier otra validación
- OPTIONS requests (preflight) se manejan inmediatamente
- `localhost:5173` está en la lista de orígenes permitidos

### 2. Proxy de Vite para desarrollo
- En desarrollo: Vite proxy redirige `/api/ocr` a `https://method.fertyfit.com`
- En producción: usa rutas relativas que apuntan al mismo dominio

## Estado del Deploy

Los cambios ya están en el repositorio y desplegados.

## Cómo Verificar

### 1. Verificar que Vercel ha desplegado
- Ve a https://vercel.com/dashboard
- Verifica que el último commit esté desplegado

### 2. Probar CORS manualmente
```bash
curl -X OPTIONS https://method.fertyfit.com/api/ocr/process \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Debería devolver:
```
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: http://localhost:5173
```

### 3. Si CORS sigue fallando

#### Opción A: Verificar variables de entorno en Vercel
- Ve a Vercel Dashboard → Settings → Environment Variables
- Verifica que `GOOGLE_CLOUD_CREDENTIALS` y `GOOGLE_CLOUD_PROJECT_ID` estén configuradas

#### Opción B: Verificar logs de Vercel
- Ve a Vercel Dashboard → Deployments → [último deploy] → Functions
- Revisa los logs de error de las funciones

#### Opción C: Probar directamente desde producción
- Abre la app en producción (no local)
- Las APIs deberían funcionar sin problemas de CORS

## Errores Comunes

### Error "No Access-Control-Allow-Origin header"
**Causa**: El código aún no está desplegado en Vercel o el proxy de Vite no está funcionando
**Solución**: 
- En desarrollo: Verifica que el proxy esté configurado en `vite.config.ts`
- En producción: Espera a que Vercel termine de desplegar (1-2 minutos)

### Errores 404 localmente
**Causa**: El proxy de Vite no está funcionando correctamente
**Solución**: Reinicia el servidor de desarrollo (`npm run dev`)

