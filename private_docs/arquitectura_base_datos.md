# Arquitectura de Base de Datos y Escalabilidad

Este documento describe la estructura de datos actual (Supabase/PostgreSQL), el flujo de la información y un análisis de escalabilidad.

## 1. Esquema de Base de Datos (Schema)
El sistema utiliza **Supabase** (PostgreSQL) con las siguientes tablas principales:

### `profiles` (Usuarios)
*   **PK:** `id` (UUID, vinculado a `auth.users`).
*   **Datos:** `email`, `name`, `age`, `weight`, `height`.
*   **Salud:** `diagnoses` (Array), `treatments` (Array).
*   **Ciclo:** `last_period_date`, `cycle_length`, `cycle_regularity`.
*   **Estado:** `method_start_date` (Fecha inicio método), `disclaimer_accepted`.
*   **Roles:** `role` ('user', 'admin').

### `daily_logs` (Registros Diarios)
*   **PK:** `id` (Auto-inc).
*   **FK:** `user_id` -> `profiles.id`.
*   **Temporalidad:** `date` (Unique per user), `cycle_day`.
*   **Biomarcadores:** `bbt`, `mucus`, `cervix_*`, `lh_test`.
*   **Hábitos:** `sleep_*`, `stress_level`, `alcohol`, `veggie_servings`.
*   *Volumen:* 1 registro por usuario por día. Crecimiento lineal.

### `consultation_forms` (Formularios Médicos)
*   **PK:** `id`.
*   **FK:** `user_id`.
*   **Tipo:** `form_type` ('F0', 'FUNCTION', 'FOOD', 'FLORA', 'FLOW').
*   **Contenido:** `answers` (JSONB - Almacena respuestas estructuradas).
*   **Estado:** `status` ('pending', 'reviewed'), `report_url`.

### `notifications` (Sistema de Alertas)
*   **PK:** `id`.
*   **FK:** `user_id`.
*   **Contenido:** `title`, `message`, `type`, `priority`.
*   **Estado:** `is_read`, `metadata` (JSONB - para acciones y soft delete).

### `admin_reports` (Informes PDF)
*   **FK:** `user_id`.
*   **Recurso:** `report_url` (Link a Storage).

---

## 2. Flujo de Datos (Data Flow)
1.  **Autenticación:** Supabase Auth gestiona el login. El `user_id` es la llave maestra.
2.  **Carga Inicial (Hydration):**
    *   Al entrar, la App descarga **TODOS** los `daily_logs` del usuario.
    *   Descarga el perfil y notificaciones.
3.  **Procesamiento (Client-Side):**
    *   **Cálculos:** El `FertyScore`, promedios y predicciones de ciclo se calculan **en el navegador** del usuario usando los datos descargados.
    *   **Ventaja:** Respuesta inmediata en UI, menor coste de servidor.
    *   **Desventaja:** Rendimiento en dispositivos lentos si hay años de datos.
4.  **Persistencia:**
    *   Al guardar un log, se envía a Supabase (`insert`/`update`).
    *   Si hay triggers (ej. IA), se ejecutan funciones (Edge Functions o lógica cliente).

---

## 3. Análisis de Escalabilidad y Mejoras

### A. Estado Actual (MVP Robusto)
*   **Pros:** Arquitectura simple, desarrollo rápido, costes bajos (Logic in Client).
*   **Contras:** Dependencia fuerte del cliente. Si un usuario tiene 5 años de datos (1800 logs), la carga inicial (`fetchLogs`) será lenta.

### B. Cuellos de Botella Identificados
1.  **Carga de Logs Masiva:** Actualmente `select * from daily_logs` trae todo el historial.
2.  **Cálculos en Cliente:** Recalcular el FertyScore iterando arrays grandes en cada render puede bloquear el UI.
3.  **JSONB en Formularios:** Consultar respuestas específicas dentro del JSON `answers` es lento si no está indexado.

### C. Plan de Escalabilidad (Roadmap)
1.  **Paginación de Logs:**
    *   *Acción:* Modificar `fetchLogs` para traer solo los últimos 3 meses por defecto. Cargar el resto bajo demanda ("Ver historial completo").
2.  **Cálculos en Backend (Edge Functions):**
    *   *Acción:* Mover la lógica pesada (FertyScore, IA) a Supabase Edge Functions que se ejecuten con Database Triggers. Guardar el resultado calculado en la tabla `profiles` (ej. columna `current_fertyscore`).
3.  **Índices de Base de Datos:**
    *   *Acción:* Asegurar índices en `daily_logs(user_id, date)` para búsquedas rápidas.
4.  **Optimización de Imágenes:**
    *   *Acción:* Los iconos y assets deben servirse vía CDN con caché agresiva (ya se usa Supabase Storage, verificar caché).
