# Cálculos del FertyScore

El **FertyScore** es un algoritmo propio que evalúa la fertilidad y salud integral de la usuaria en una escala de 0 a 100. Se recalcula dinámicamente con cada nuevo dato introducido (perfil o registros diarios).

La puntuación se compone de 4 pilares fundamentales, cada uno con un peso del 25% sobre el total.

## Fórmula General
```
FertyScore Total = (Function * 0.25) + (Food * 0.25) + (Flora * 0.25) + (Flow * 0.25)
```

---

## 1. Pilar FUNCTION (Fisiología y Salud Física)
Evalúa la base biológica y hormonal.
**Puntuación Base:** 100 puntos.

### Penalizaciones:
1.  **IMC (Índice de Masa Corporal):**
    *   **Bajo Peso (< 18.5):** Se resta 8 puntos por cada punto de IMC por debajo de 18.5.
    *   **Sobrepeso (> 25):** Se resta 3 puntos por cada punto de IMC por encima de 25.
    *   *Rango Óptimo (18.5 - 25):* Sin penalización (100 pts).
2.  **Edad:**
    *   **> 35 años:** Se restan 2 puntos por cada año extra.
    *   **< 25 años:** Se resta 1 punto por cada año menos (ajuste por madurez del eje hormonal).
3.  **Diagnósticos de Riesgo:**
    *   Si tiene SOP, Endometriosis o PCOS: **-20 puntos**.
4.  **Tabaco:**
    *   Si es fumadora: **-25 puntos**.

---

## 2. Pilar FOOD (Nutrición y Hábitos)
Evalúa la calidad de la alimentación y suplementación.
**Cálculo:** Basado en el promedio de los últimos 14 registros diarios.

### Componentes:
1.  **Vegetales (40% del pilar):**
    *   Objetivo: 5 raciones al día.
    *   Fórmula: `(Promedio Raciones / 5) * 100`. (Máx 100).
2.  **Alcohol (40% del pilar):**
    *   Si consume alcohol más de 2 días en las últimas 2 semanas:
    *   Penalización: `100 - (Días con alcohol * 10)`.
3.  **Suplementación (20% del pilar):**
    *   Valor fijo (Placeholder actual: 80 pts) o basado en F0.

*Si no hay registros recientes, se asume un valor base de 70.*

---

## 3. Pilar FLORA (Microbiota y Descanso)
Evalúa el sueño, digestión y salud inmunológica.
**Cálculo:** Basado en el promedio de los últimos 14 registros.

### Componentes:
1.  **Sueño (50% del pilar):**
    *   **Óptimo (7-9 horas):** 100 puntos.
    *   **Insuficiente (< 7h):** Proporcional `(Horas / 7) * 100`.
    *   **Excesivo (> 9h):** Penalización por letargo `100 - ((Horas - 9) * 10)`.
2.  **Salud Digestiva (30% del pilar):**
    *   Basado en síntomas digestivos (Placeholder actual: 80 pts).
3.  **Salud Intestinal/Probióticos (20% del pilar):**
    *   Basado en suplementación (Placeholder actual: 75 pts).

*Si no hay registros recientes, se asume un valor base de 70.*

---

## 4. Pilar FLOW (Estrés y Ciclo)
Evalúa el bienestar emocional y la regularidad del ciclo.
**Cálculo:** Basado en perfil y últimos 14 registros.

### Componentes:
1.  **Estrés (30% del pilar):**
    *   Escala 1 (Bajo) a 5 (Alto).
    *   Fórmula: `((5 - Nivel Estrés) / 4) * 100`. (Menos estrés = Más puntos).
2.  **Regularidad del Ciclo (30% del pilar):**
    *   **Regular:** 100 puntos.
    *   **Irregular:** 50 puntos.
    *   **Desconocido/Variable:** 75 puntos.
3.  **Estabilidad BBT (20% del pilar):**
    *   Mide la desviación estándar de la temperatura basal.
    *   **Estable (SD ≤ 0.2):** 100 puntos.
    *   **Inestable (SD ≥ 0.5):** 40 puntos.
4.  **Bienestar Emocional (20% del pilar):**
    *   (Placeholder actual: 80 pts).

*Si no hay registros recientes, se asume un valor base de 70.*

---

## Notas de Implementación
*   **Límites:** Ningún pilar puede ser menor a 0 ni mayor a 100.
*   **Datos Faltantes:** Si el usuario es nuevo y no tiene logs, se muestran puntuaciones vacías o basales hasta que empiece a registrar.
*   **Actualización:** El cálculo se ejecuta en tiempo real en el cliente (`App.tsx`) cada vez que cambian los `logs` o el `user` profile.
