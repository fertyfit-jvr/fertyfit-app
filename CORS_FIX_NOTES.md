# Problemas CORS y Solución

## Problema Actual

Los endpoints de Vercel (`/api/gemini/process-vision`, `/api/ocr/process`, `/api/gemini/generate`) están bloqueando las peticiones desde `localhost:5173` por CORS, y algunos están devolviendo errores 500.

## Solución Implementada

### 1. CORS configurado correctamente en todos los endpoints
- Todos los endpoints ahora manejan CORS PRIMERO, antes de cualquier otra validación
- OPTIONS requests (preflight) se manejan inmediatamente
- `localhost:5173` está en la lista de orígenes permitidos

### 2. URLs siempre completas
- En desarrollo: apuntan a `https://method.fertyfit.com/api/...`
- En producción: usan `window.location.origin/api/...`

## Estado del Deploy

Los cambios ya están en el repositorio, pero necesitan:
1. ✅ Hacer push a GitHub (YA HECHO)
2. ⏳ Esperar a que Vercel despliegue automáticamente
3. ⏳ Verificar que los endpoints funcionen

## Cómo Verificar

### 1. Verificar que Vercel ha desplegado
- Ve a https://vercel.com/dashboard
- Verifica que el último commit esté desplegado
- Espera 1-2 minutos después del push

### 2. Probar CORS manualmente
```bash
curl -X OPTIONS https://method.fertyfit.com/api/gemini/process-vision \
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

#### Opción A: Verificar variable de entorno en Vercel
- Ve a Vercel Dashboard → Settings → Environment Variables
- Verifica que `GEMINI_API` esté configurada correctamente

#### Opción B: Verificar logs de Vercel
- Ve a Vercel Dashboard → Deployments → [último deploy] → Functions
- Revisa los logs de error de las funciones

#### Opción C: Probar directamente desde producción
- Abre la app en producción (no local)
- Las APIs deberían funcionar sin problemas de CORS

## Errores Comunes

### Error 500 en `/api/gemini/generate`
**Causa**: API key de Gemini no configurada o inválida
**Solución**: 
1. Obtén una nueva API key en https://aistudio.google.com
2. Añádela en Vercel → Settings → Environment Variables como `GEMINI_API`

### Error "No Access-Control-Allow-Origin header"
**Causa**: El código aún no está desplegado en Vercel
**Solución**: Espera a que Vercel termine de desplegar (1-2 minutos)

### Errores 404 localmente
**Causa**: Algo está intentando usar rutas relativas
**Solución**: Los servicios ya están configurados para usar URLs completas, pero si persisten, recarga la página con caché limpio (Cmd+Shift+R)

## Próximos Pasos

1. ⏳ Esperar deploy de Vercel
2. ✅ Probar el componente de comparación en producción
3. ✅ Si funciona en producción, el problema es solo de CORS en desarrollo

