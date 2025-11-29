/**
 * Cycle Calculations
 * Funciones para calcular datos relacionados con el ciclo menstrual
 */

export interface VentanaFertil {
    inicio: number;
    fin: number;
    diasFertiles: number;
    diaOvulacion: number;
}

/**
 * Calcula el día de ovulación basado en la duración del ciclo
 * Fórmula estándar: día de ovulación = duración del ciclo - 14 días
 */
export function calcularDiaOvulacion(duracionCiclo: number): number {
    return duracionCiclo - 14;
}

export function calcularVentanaFertil(duracionCiclo: number): VentanaFertil {
    const diaOvulacion = calcularDiaOvulacion(duracionCiclo);

    return {
        inicio: diaOvulacion - 5,
        fin: diaOvulacion + 1,
        diasFertiles: 7,
        diaOvulacion
    };
}

/**
 * Calcula la fecha de inicio del ciclo ACTUAL
 * Esto puede ser diferente a lastPeriodDate si han pasado varios ciclos
 * 
 * @param lastPeriodDate - Fecha de la última regla registrada (formato YYYY-MM-DD)
 * @param cycleLength - Duración del ciclo en días
 * @returns Fecha de inicio del ciclo actual (formato YYYY-MM-DD) o null si faltan datos
 */
export function calcularFechaInicioCicloActual(
    lastPeriodDate: string | undefined,
    cycleLength: number | undefined
): string | null {
    if (!lastPeriodDate || !cycleLength) return null;

    const lastPeriod = new Date(lastPeriodDate);
    const hoy = new Date();
    lastPeriod.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const diasDesdeInicio = Math.floor((hoy.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24));
    const ciclosCompletados = Math.floor(diasDesdeInicio / cycleLength);

    const inicioCicloActual = new Date(lastPeriod);
    inicioCicloActual.setDate(lastPeriod.getDate() + (ciclosCompletados * cycleLength));

    // Formatear como YYYY-MM-DD
    const year = inicioCicloActual.getFullYear();
    const month = String(inicioCicloActual.getMonth() + 1).padStart(2, '0');
    const day = String(inicioCicloActual.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}
