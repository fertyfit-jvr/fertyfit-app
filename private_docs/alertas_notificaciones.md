# Alertas, Notificaciones y Comunicaciones

Este documento detalla el sistema de notificaciones de FertyFit, incluyendo la lógica de disparo (triggers), prioridades y el uso de Inteligencia Artificial para la personalización.

## 1. Arquitectura del Sistema
El sistema combina un **Motor de Reglas Determinista** (`RuleEngine`) con un **Generador de Contenido por IA** (Gemini).

*   **Tipos de Notificación:**
    *   `alert`: Críticas (Rojo). Salud en riesgo o acción requerida.
    *   `opportunity`: Ventana fértil (Dorado). Momento clave para concebir.
    *   `celebration`: Logros, bienvenida (Verde). Refuerzo positivo.
    *   `insight`: Información educativa basada en datos.
    *   `tip`: Consejos generales.

*   **Gestión de Frecuencia:**
    *   **Cooldown:** Cada regla tiene un tiempo de "enfriamiento" (ej. no avisar de IMC bajo todos los días, sino cada 7 días).
    *   **Límite Diario:** Máximo 30 notificaciones por día para evitar spam.

## 2. Inventario de Reglas y Triggers

### A. Ciclo y Fertilidad (Prioridad Alta)
| ID | Trigger | Condición | Mensaje / Acción |
|----|---------|-----------|------------------|
| **VF-1** | `DAILY_CHECK` | 2 días antes de Ventana Fértil | "Tu ventana fértil se acerca". Prepara a la usuaria. |
| **VF-2** | `DAILY_CHECK` | Día de Ovulación (Estimado) | "Día de máxima fertilidad". (Texto adaptado si edad > 45). |
| **VF-3** | `DAILY_CHECK` | 1 día post-ovulación | "Fin de ventana fértil". Cierre del ciclo de intentos. |
| **PM-1** | `DAILY_CHECK` | 2 días antes de la Regla | "Se acerca tu menstruación". Recordatorio útil. |
| **PM-2** | `DAILY_CHECK` | 3 días de retraso | "¿Llegó tu regla?". Solicita actualizar datos para recalcular. |

### B. Salud y Alertas Médicas
| ID | Trigger | Condición | Mensaje / Acción |
|----|---------|-----------|------------------|
| **IMC-1** | `WEIGHT_UPDATE` | Cambio de categoría IMC | Alerta si baja a "Bajo peso" o sube a "Obesidad". Explica impacto en fertilidad. |
| **EDAD-1** | `AGE_CHECK` | Edad ≥ 50 años | Sugiere "Programa de Menopausia". Desactiva alertas de fertilidad estándar. |

### C. Alertas de Consulta Médica (Lógica Clínica)
Estas alertas se generan al evaluar el perfil completo:
*   **URGENTE:** Amenorrea > 90 días.
*   **ALTA:** >12 meses intentando (<35 años) o >6 meses (35-40 años).
*   **MEDIA:** Ciclos irregulares (variación > 7 días).

## 3. Inteligencia Artificial (Gemini)
La IA se utiliza para "humanizar" la comunicación y hacerla única para cada usuaria. No se usa para diagnósticos médicos, sino para el **tono y la empatía**.

### Casos de Uso de IA:
1.  **Bienvenida / Actualización de Perfil (F0):**
    *   **Trigger:** Al guardar el formulario F0.
    *   **Prompt:** Se envía a Gemini el Nombre, Edad, Objetivo (Concepción/RA) y Diagnósticos.
    *   **Resultado:** Un mensaje de bienvenida que valida su situación específica.
        *   *Ejemplo:* "Hola Ana, veo que tu meta es concebir naturalmente. Con tu diagnóstico de SOP, trabajaremos juntas en tu balance hormonal. 💪"
    *   **Seguridad:** Se usa una semilla aleatoria y temperatura alta (0.9) para variedad, pero con instrucciones estrictas de tono empático y profesional.

2.  **Insights Diarios (Daily Log):**
    *   **Trigger:** Al guardar el registro diario.
    *   **Prompt:** Se envían los síntomas y biomarcadores del día.
    *   **Resultado:** Un consejo corto o feedback sobre lo que acaba de registrar (ej. "Ese dolor ovulatorio es normal en tu día 14, significa que tu cuerpo está trabajando").

## 4. Estado Actual
*   **Ejecutadas:** Las reglas de ciclo (VF, PM) y las alertas de IMC están activas y funcionando.
*   **IA:** La integración está configurada (`App.tsx`) y depende de la API Key de Gemini. Si la key falta, el sistema hace fallback a mensajes genéricos predefinidos.
*   **Notificaciones Push:** Actualmente el sistema es interno (dentro de la app). No hay integración visible con Push Notifications nativas (iOS/Android) en este código, son notificaciones "In-App".
