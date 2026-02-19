/**
 * Local cycle utils for API to avoid ESM import issues with shared code
 */

function parseLocalDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function calcularDiaDelCiclo(lastPeriodDate: string | undefined, cycleLength?: number): number {
    if (!lastPeriodDate) return 0;

    const ultimaRegla = parseLocalDate(lastPeriodDate) ?? new Date();
    const hoy = new Date();
    ultimaRegla.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const diferencia = hoy.getTime() - ultimaRegla.getTime();
    const diasDesdeUltimaRegla = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    const diaEnCiclo = diasDesdeUltimaRegla + 1;

    if (cycleLength && diaEnCiclo > cycleLength) {
        const ciclosCompletos = Math.floor((diaEnCiclo - 1) / cycleLength);
        return diaEnCiclo - (ciclosCompletos * cycleLength);
    }

    return diaEnCiclo;
}

export function calcularDiaOvulacion(duracionCiclo: number): number {
    return duracionCiclo - 14;
}

export interface VentanaFertil {
    inicio: number;
    fin: number;
    diasFertiles: number;
    diaOvulacion: number;
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
