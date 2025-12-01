# Solución de Errores 500 en APIs

## Problema

Estás recibiendo errores 500 en `/api/ocr/process`.

## Causas Comunes

### 1. Variables de Entorno Faltantes

#### Para OCR (`/api/ocr/process`):
Necesitas estas variables en Vercel:
- `GOOGLE_CLOUD_CREDENTIALS` - JSON del service account
- `GOOGLE_CLOUD_PROJECT_ID` - ID del proyecto de Google Cloud

### 2. Cómo Verificar Variables de Entorno en Vercel

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Verifica que existan:
   - `GOOGLE_CLOUD_CREDENTIALS`
   - `GOOGLE_CLOUD_PROJECT_ID`
5. Asegúrate de que estén marcadas para **Production**

### 3. Ver Logs de Error en Vercel

1. Ve a **Deployments** en Vercel Dashboard
2. Selecciona el último deployment
3. Ve a la pestaña **Functions**
4. Haz clic en `/api/ocr/process`
5. Revisa los **Runtime Logs** para ver el error específico

Los errores más comunes que verás:

#### Error: "Google Cloud credentials not configured"
**Solución**: Añade `GOOGLE_CLOUD_CREDENTIALS` y `GOOGLE_CLOUD_PROJECT_ID` en Vercel

#### Error: "Invalid credentials format"
**Solución**: Verifica que `GOOGLE_CLOUD_CREDENTIALS` sea un JSON válido en una sola línea

#### Error: "Error initializing Vision client"
**Solución**: 
- Verifica que el service account tenga permisos de Vision API
- Verifica que Vision API esté habilitada en Google Cloud Console

### 4. Probar Directamente la API

Puedes probar la API directamente desde la terminal para ver el error completo:

```bash
# Probar OCR (necesitas una imagen en base64)
curl -X POST https://method.fertyfit.com/api/ocr/process \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{
    "image": "data:image/jpeg;base64,iVBORw0KG...",
    "examType": "hormonal"
  }' \
  -v
```

## Pasos para Resolver

1. ✅ Verifica que las variables de entorno estén configuradas en Vercel
2. ✅ Revisa los logs de Vercel para ver el error específico
3. ✅ Si falta alguna variable, añádela y espera 1-2 minutos para que se propague
4. ✅ Vuelve a probar el componente

## Próximos Pasos

Una vez que identifiques el error específico en los logs de Vercel, podremos resolverlo más rápido.

