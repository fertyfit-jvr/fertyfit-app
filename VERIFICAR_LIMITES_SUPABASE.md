# 🔍 Cómo Verificar Límites de Supabase

## 📍 Pasos para Verificar

### 1. Accede al Dashboard
- Ve a: https://supabase.com/dashboard
- Inicia sesión con tu cuenta
- Selecciona el proyecto: **zoanaxbpbklpbhtcqiwb**

### 2. Navega a "Usage" (Uso)
- En el menú lateral izquierdo, busca **"Usage"** o **"Uso"**
- O ve directamente a: `https://supabase.com/dashboard/project/zoanaxbpbklpbhtcqiwb/usage`

### 3. Revisa estas Métricas Críticas

#### 🗄️ **Database**
- **Espacio usado**: ¿Está cerca de 500 MB? (límite del plan gratuito)
- Si está cerca del límite, puede causar errores

#### 📊 **Bandwidth (Ancho de Banda)**
- **Datos transferidos**: ¿Está cerca de 5 GB? (límite del plan gratuito)
- Si se excede, puede causar errores CORS

#### 💾 **Storage (Almacenamiento)**
- **Espacio usado**: ¿Está cerca de 1 GB? (límite del plan gratuito)
- Si se excede, puede causar HTTP 500 en el logo

#### 🔌 **API Requests**
- **Número de peticiones**: Revisa si hay un pico inusual
- Cada vez que se carga la app, se hacen varias peticiones

#### 🔐 **Auth Requests**
- **Peticiones de autenticación**: Revisa si hay muchas peticiones fallidas

### 4. Límites del Plan Gratuito

| Recurso | Límite Gratuito |
|---------|----------------|
| **Database** | 500 MB |
| **Bandwidth** | 5 GB/mes |
| **Storage** | 1 GB |
| **MAUs** | 50,000 usuarios/mes |
| **Proyectos** | 2 activos |

### 5. Si Has Alcanzado los Límites

#### Opción A: Esperar al Reset Mensual
- Los límites se resetean cada mes
- Puedes esperar hasta el próximo ciclo

#### Opción B: Actualizar el Plan
- Ve a: **Settings → Billing**
- Considera actualizar a un plan de pago si necesitas más recursos

#### Opción C: Optimizar el Código
- Reducir llamadas a la API
- Implementar caché local
- Optimizar consultas

## 🐛 Problemas Comunes y Soluciones

### Error CORS en Login
- **Causa**: Límite de bandwidth excedido
- **Solución**: Verificar uso de bandwidth en "Usage"

### Logo no carga (HTTP 500)
- **Causa**: Límite de Storage excedido
- **Solución**: Verificar uso de Storage en "Usage"

### Errores en Base de Datos
- **Causa**: Límite de Database excedido
- **Solución**: Verificar uso de Database en "Usage"

## 📊 Monitoreo Continuo

### Configurar Alertas (Recomendado)
1. Ve a **Settings → Usage**
2. Configura alertas cuando el uso alcance el 80% del límite
3. Recibirás notificaciones por email

### Revisar Regularmente
- Revisa el uso semanalmente
- Monitorea tendencias de crecimiento
- Planifica actualizaciones de plan si es necesario

## 🔗 Enlaces Útiles

- Dashboard: https://supabase.com/dashboard
- Documentación: https://supabase.com/docs/guides/platform/manage-your-usage
- Pricing: https://supabase.com/pricing

