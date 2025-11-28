# Datos Recogidos y Cálculos (Documentación Médica)

Este documento describe los datos que recopila la aplicación FertyFit y la lógica matemática utilizada para procesarlos, con un enfoque en la validez médica y los algoritmos de fertilidad.

## 1. Recogida de Datos

### A. Ficha Personal Inicial (F0)
Es la anamnesis principal. Datos críticos:
*   **Ciclo Menstrual:** Fecha de última regla (FUR), duración promedio del ciclo, regularidad.
*   **Antropometría:** Peso, Altura (para cálculo de IMC).
*   **Historia Reproductiva:** Tiempo buscando embarazo, tratamientos previos (FIV, etc.), diagnósticos (SOP, Endometriosis).
*   **Estilo de Vida:** Fumar, Alcohol, Estrés, Sueño.

### B. Registro Diario (Daily Log)
Datos que la paciente introduce día a día:
*   **Biomarcadores:** Temperatura Basal (BBT), Moco Cervical (Tipos: Seco, Cremoso, Clara de Huevo, etc.), Posición/Apertura del Cérvix.
*   **Tests:** LH (Ovulación).
*   **Síntomas:** Dolor ovulatorio, sensibilidad mamaria, cólicos, etc.
*   **Relaciones:** Coito (para correlacionar con ventana fértil).
*   **Hábitos:** Sueño (horas/calidad), Dieta (vegetales, alcohol), Ejercicio, Sol.

### C. Formularios Especializados (4 Pilares)
*   **FUNCTION:** Panel hormonal (FSH, LH, Estradiol, Progesterona, etc.), Metabólico (Glucosa, Insulina), Ecografía (AFC).
*   **FOOD:** Proteína, Fibra, Ultraprocesados, Omega-3.
*   **FLORA:** Historial antibióticos, infecciones vaginales, digestión (Escala Bristol).
*   **FLOW:** Carga mental, ansiedad, libido, soporte emocional.

---

## 2. Lógica y Cálculos Médicos

### A. Predicción del Ciclo y Ovulación
El sistema utiliza el **Método del Calendario** ajustado con biomarcadores.
*   **Ovulación Estimada:** `Duración del Ciclo - 14 días` (Fase lútea estándar).
    *   *Nota:* Se ajusta si hay datos históricos personales.
*   **Ventana Fértil:** Desde 5 días antes de la ovulación hasta 1 día después (Total 7 días).
*   **Detección de Ovulación (BBT):** Se confirma ovulación si la temperatura sube **≥0.2°C** por encima del promedio de los últimos 6 días (Shift térmico).

### B. Probabilidad de Embarazo (Algoritmo Wilcox)
Se asigna una probabilidad diaria basada en el día relativo a la ovulación:
*   **Día -2 (Pico):** 27% (Día más fértil).
*   **Día -1:** 31%.
*   **Día 0 (Ovulación):** 33%.
*   **Día -5 a -3:** 10-16%.
*   **Día +1:** 10%.
*   *Resto del ciclo:* Probabilidad despreciable.

### C. Índice de Masa Corporal (IMC) y Fertilidad
Fórmula: `Peso (kg) / Altura (m)²`.
*   **< 18.5 (Bajo Peso):** Alerta de riesgo de anovulación/amenorrea.
*   **18.5 - 24.9 (Normal):** Óptimo.
*   **25 - 29.9 (Sobrepeso):** Impacto leve-moderado (reducción 8-15% fertilidad).
*   **≥ 30 (Obesidad):** Impacto alto (reducción 25-35% fertilidad, riesgo obstétrico).

### D. FertyScore (Puntuación de Salud)
Algoritmo propio que evalúa la salud integral en 4 pilares (0-100 puntos cada uno, promedio ponderado 25% c/u).

1.  **FUNCTION (Fisiología):**
    *   Penaliza: Edad > 35, IMC fuera de rango, Fumar (-25 pts), Diagnósticos como SOP (-20 pts).
2.  **FOOD (Nutrición):**
    *   Premia: Consumo de vegetales (objetivo 5 raciones).
    *   Penaliza: Alcohol frecuente (>2 días/quincena).
3.  **FLORA (Descanso/Microbiota):**
    *   Premia: Sueño 7-9 horas.
    *   Penaliza: Sueño <7h o >9h.
4.  **FLOW (Emocional/Ciclo):**
    *   Evalúa: Nivel de estrés (1-5), Regularidad del ciclo, Estabilidad de la curva de temperatura (BBT).

### E. Puntuación de Fertilidad Clínica
Cálculo adicional para perfil clínico:
*   Base 100 puntos.
*   **Descuentos:**
    *   Fumar: -30 pts.
    *   Obesidad: -25 pts.
    *   Edad > 35: -2 pts por año.
    *   Ciclos Irregulares: -15 pts.
    *   Alcohol frecuente: -15 pts.
*   **Interpretación:**
    *   >80: Excelente.
    *   60-79: Bueno.
    *   40-59: Regular.
    *   <40: Bajo (Requiere especialista).

## 3. Checks de Políticas y Seguridad
*   **Edad ≥ 50:** El sistema desactiva notificaciones de "Ventana Fértil" y activa alertas de "Programa Menopausia". No genera falsas expectativas de embarazo natural.
*   **Amenorrea:** Si pasan 90 días sin regla (y edad < 45), se genera alerta de "Consulta Ginecológica Urgente".
*   **Límites Diarios:** El sistema de notificaciones tiene un "rate limit" (máx 30/día) para no saturar a la usuaria, aunque las alertas médicas tienen prioridad.
