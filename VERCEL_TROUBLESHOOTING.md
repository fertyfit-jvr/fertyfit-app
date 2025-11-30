# Guía de Troubleshooting en Vercel

## 📋 Cómo Verificar Logs y Variables de Entorno en Vercel

### 1. Ver Logs de las Funciones Serverless

#### Opción A: Desde el Dashboard de Vercel (Recomendado)

1. **Accede a tu proyecto en Vercel:**
   - Ve a [vercel.com](https://vercel.com)
   - Inicia sesión
   - Selecciona tu proyecto `fertyfit-app`

2. **Ver logs del último deployment:**
   - Ve a la pestaña **"Deployments"**
   - Haz clic en el último deployment (el más reciente)
   - En la parte inferior, verás una sección **"Functions"**
   - Busca `/api/ocr/process` y haz clic en **"View Function Logs"** o **"Runtime Logs"**

3. **Ver logs en tiempo real:**
   - En la misma página, busca el botón **"View Logs"** o **"Real-time Logs"**
   - Esto te mostrará todos los logs en tiempo real

#### Opción B: Desde la CLI de Vercel

```bash
# Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# Iniciar sesión
vercel login

# Ver logs del proyecto
vercel logs

# Ver logs en tiempo real
vercel logs --follow

# Ver logs de una función específica
vercel logs --function=api/ocr/process
```

### 2. Verificar Variables de Entorno

#### Desde el Dashboard de Vercel:

1. **Accede a Settings:**
   - En tu proyecto de Vercel, ve a **"Settings"** (Configuración)
   - En el menú lateral, selecciona **"Environment Variables"**

2. **Verifica las siguientes variables:**
   - ✅ `GOOGLE_CLOUD_CREDENTIALS` - Debe contener el JSON completo del service account
   - ✅ `GOOGLE_CLOUD_PROJECT_ID` - ID del proyecto de Google Cloud
   - ✅ `GEMINI_API` - API key de Gemini
   - ✅ `NODE_ENV` - Debe ser `production` (opcional, Vercel lo establece automáticamente)

3. **Verificar que estén en el entorno correcto:**
   - Cada variable debe estar marcada para **Production**, **Preview**, y/o **Development**
   - Para producción, asegúrate de que estén marcadas para **Production**

4. **Formato de GOOGLE_CLOUD_CREDENTIALS:**
   - Debe ser un JSON válido en una sola línea
   - Ejemplo:
   ```json
   {"type":"service_account","project_id":"tu-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
   ```
   - **IMPORTANTE:** Si copias desde un archivo JSON, asegúrate de que esté en una sola línea o usa el formato de texto plano

### 3. Probar la API Directamente

Puedes probar la API directamente desde la terminal o Postman:

```bash
# Probar la API OCR (necesitas una imagen en base64)
curl -X POST https://method.fertyfit.com/api/ocr/process \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "examType": "hormonal"
  }'
```

### 4. Errores Comunes y Soluciones

#### Error 500: "Google Cloud credentials not configured"
- **Causa:** `GOOGLE_CLOUD_CREDENTIALS` o `GOOGLE_CLOUD_PROJECT_ID` no están configuradas
- **Solución:** Verifica que las variables estén en Vercel Settings → Environment Variables

#### Error 500: "Invalid credentials format"
- **Causa:** El JSON de `GOOGLE_CLOUD_CREDENTIALS` está mal formateado
- **Solución:** Asegúrate de que sea un JSON válido en una sola línea

#### Error 500: "Error initializing Vision client"
- **Causa:** Problema con las credenciales o permisos de Google Cloud
- **Solución:** 
  1. Verifica que el service account tenga permisos de Vision API
  2. Verifica que la Vision API esté habilitada en Google Cloud Console

#### Error 404: "Function not found"
- **Causa:** La función no se desplegó correctamente
- **Solución:** 
  1. Verifica que el archivo `api/ocr/process.ts` esté en el repositorio
  2. Haz un nuevo deployment desde Vercel

#### Error CORS
- **Causa:** El origen no está permitido
- **Solución:** Ya está configurado en el código, pero verifica que `https://method.fertyfit.com` esté en los orígenes permitidos

### 5. Verificar que la API esté Desplegada

1. Ve a **Deployments** en Vercel
2. Busca el último deployment
3. Verifica que el estado sea **"Ready"** (verde)
4. En la sección **"Functions"**, deberías ver:
   - `/api/ocr/process`
   - `/api/gemini/generate`

### 6. Re-desplegar si es Necesario

Si haces cambios en las variables de entorno:

1. Ve a **Settings** → **Environment Variables**
2. Edita o añade las variables necesarias
3. Ve a **Deployments**
4. Haz clic en los tres puntos (⋯) del último deployment
5. Selecciona **"Redeploy"**
6. Marca **"Use existing Build Cache"** si quieres, o déjalo sin marcar para un build limpio

### 7. Verificar Build Logs

1. Ve a **Deployments**
2. Haz clic en el último deployment
3. En la parte superior, verás los **"Build Logs"**
4. Revisa si hay errores durante el build

### 8. Contactar Soporte de Vercel

Si nada funciona:
1. Ve a [vercel.com/support](https://vercel.com/support)
2. Incluye:
   - URL del deployment
   - Logs de la función
   - Variables de entorno (sin valores sensibles)
   - Descripción del error

---

## 🔍 Comandos Útiles

```bash
# Ver estado del proyecto
vercel inspect

# Ver información del deployment
vercel inspect <deployment-url>

# Ver variables de entorno (sin valores)
vercel env ls

# Añadir variable de entorno desde CLI
vercel env add GOOGLE_CLOUD_CREDENTIALS production

# Ver logs en tiempo real
vercel logs --follow
```

---

## 📝 Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] Las variables de entorno están configuradas en Vercel
- [ ] Las variables están marcadas para "Production"
- [ ] El formato de `GOOGLE_CLOUD_CREDENTIALS` es JSON válido
- [ ] La Vision API está habilitada en Google Cloud
- [ ] El service account tiene permisos de Vision API
- [ ] El último deployment está en estado "Ready"
- [ ] Las funciones `/api/ocr/process` y `/api/gemini/generate` aparecen en Functions
- [ ] Revisaste los logs de la función para ver el error exacto

