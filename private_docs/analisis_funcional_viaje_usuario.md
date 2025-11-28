# Análisis Funcional y Viaje del Usuario (User Journey)

Este documento detalla el flujo de la aplicación FertyFit, desde la entrada del usuario hasta el uso de las funcionalidades principales, identificando puntos clave y posibles mejoras.

## 1. Entrada y Autenticación
**Flujo Actual:**
1.  **Carga de la App (`App.tsx`):**
    *   Se verifica la sesión del usuario con Supabase.
    *   **Si no hay sesión:** Se muestra la vista `ONBOARDING`.
    *   **Si hay sesión:**
        *   Se busca el perfil del usuario en la base de datos.
        *   **Si no existe perfil:** Se crea uno automáticamente usando metadatos del login (nombre, email) y se recarga el estado.
        *   **Si existe perfil:** Se cargan todos los datos (logs, notificaciones, reportes) y se dirige al usuario al `DASHBOARD`.
        *   *Excepción:* Si el usuario no ha aceptado el disclaimer médico, se dirige a la vista `DISCLAIMER`.

**Puntos Clave:**
*   **Creación Automática de Perfil:** El sistema es robusto; si falla la carga del perfil pero hay sesión, intenta crearlo para evitar bloqueos.
*   **Carga de Datos:** Se hace una carga inicial completa (`fetchLogs`, `fetchNotifications`, etc.) antes de mostrar el Dashboard. Esto asegura que la UI no parpadee, pero podría ser lento si hay muchos datos.

## 2. Onboarding y Configuración Inicial
**Flujo:**
*   El usuario nuevo llega a la vista de Onboarding (Login/Registro).
*   Al registrarse, se capturan datos básicos.
*   **Ficha F0 (Formulario Inicial):**
    *   Es el primer paso crítico. El sistema detecta si se ha completado el formulario "F0".
    *   Si no se ha completado, el acceso al "Tracker" (registro diario) está bloqueado o redirige a `CONSULTATIONS` para forzar su llenado.
    *   **Datos F0:** Fecha última regla, duración ciclo, edad, peso, altura, objetivo (concepción/RA), diagnósticos.

**Mejoras Potenciales:**
*   Asegurar que el bloqueo del Tracker sea claro para el usuario ("Por favor completa tu ficha F0 para empezar").

## 3. Dashboard Principal (El Hub)
La vista `DASHBOARD` es el centro de control.
*   **Encabezado:** Saludo personalizado y contador de días del método (si está activo).
*   **Botón de Acceso Rápido:** Permite ir al Tracker o a Consultas rápidamente.
*   **Tarjeta "Comienza Tu Viaje":** Si el usuario no ha iniciado el método, se muestra un "Call to Action" prominente.
*   **FertyScore (Puntuación):**
    *   Muestra una puntuación global (0-100) y desglose en 4 pilares: Function, Food, Flora, Flow.
    *   Código de colores (Rojo/Ámbar/Verde) para feedback visual inmediato.
    *   Barra de progreso de los 90 días del método.
*   **Reporte Médico (MedicalReport):**
    *   Componente colapsable que muestra resumen del ciclo (probabilidad de embarazo hoy, fechas fértiles).
    *   Al expandir, muestra detalles profundos de salud.
*   **Notificaciones:** Lista de alertas no leídas (ej. recordatorios, insights de IA).

## 4. Funcionalidades Clave

### A. Registro Diario (Tracker)
*   **Acceso:** Desde el Dashboard o menú de navegación.
*   **Funcionalidad:** Permite registrar BBT, moco cervical, tests de LH, síntomas, sexo, sueño, etc.
*   **Lógica:** Al guardar, se actualizan los cálculos del ciclo y el FertyScore.

### B. Educación (Módulos)
*   **Estructura:** Curso dividido en Fases (0, 1, 2, 3).
*   **Contenido:** Videos (YouTube/Vimeo) y PDFs.
*   **Progresión:** Se marcan lecciones como completadas.

### C. Consultas y Formularios Médicos
*   **Formularios:** F0, Function, Food, Flora, Flow.
*   **Detalle:** Preguntas muy específicas (ej. niveles hormonales, dieta, estrés) que alimentan el algoritmo del FertyScore.

### D. Perfil
*   **Gestión:** Edición de datos personales.
*   **Historial:** Visualización de logs pasados.
*   **Configuración:** Reiniciar método, cerrar sesión.

## 5. Análisis de Flujo y Posibles Fallos
1.  **Dependencia de F0:** Si el usuario salta el F0, muchos cálculos (ciclo, ventana fértil) fallarán o darán datos erróneos. El sistema actual parece manejar esto bloqueando o advirtiendo, lo cual es correcto.
2.  **Edición de Ciclo:** Si el usuario edita manualmente la fecha de última regla en el perfil, el sistema recalcula todo. Es un punto sensible que debe funcionar perfectamente para no desajustar las predicciones.
3.  **Conexión:** La app depende de Supabase. Si no hay red, la carga inicial fallará. Se maneja con un estado de `loading` y `error`, pero la experiencia offline es limitada.

## 6. Conclusión del Viaje
El usuario ideal entra, completa su F0, inicia el método y diariamente registra sus biomarcadores. La app le devuelve valor inmediato a través del FertyScore y las predicciones de fertilidad, manteniéndolo enganchado con contenido educativo y notificaciones inteligentes.
