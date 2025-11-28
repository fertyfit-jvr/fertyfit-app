/**
 * MedicalReportHelpers.ts
 * 
 * Funciones helper para generar datos del informe médico
 */

import { UserProfile, DailyLog } from '../types';
import {
    calcularIMC,
    calcularPesoIdeal,
    calcularVentanaFertil,
    calcularProbabilidadPorDia,
    analizarEdadFertilidad
} from './CycleCalculations';
import { calcularDiaDelCiclo } from './RuleEngine';

export interface MedicalReportData {
    // Datos básicos
    edad: number;
    imc: {
        valor: string;
        categoria: string;
    };
    pesoActual: number;
    pesoIdeal: {
        minimo: number;
        maximo: number;
    };

    // Datos de ciclo
    diaDelCiclo: number;
    cycleLengthUsado: number;
    usandoValorPorDefecto: boolean;
    diaOvulacion: number;
    ventanaFertil: {
        inicio: number;
        fin: number;
        diasFertiles: number;
    };
    fechaProximaMenstruacion: string;
    fechaInicioCicloActual: string;

    // Días restantes
    diasHastaOvulacion: number;
    diasHastaProximaRegla: number;

    // Probabilidad
    probabilidadEmbarazoHoy: number;

    // Promedios hábitos (últimos 7 días)
    promedios: {
        sueno: string;
        estres: string;
        agua: number;
        vegetales: number;
        diasConAlcohol: number;
    };

    // Análisis edad
    analisisEdad: {
        categoria: string;
        probabilidad: string;
        mensaje: string;
    };
}

// calcularDiaDelCiclo is now imported from RuleEngine to avoid duplication

/**
 * Calcula fecha de próxima menstruación
 */
function calcularFechaProximaMenstruacion(
    lastPeriodDate: string,
    cycleLength: number
): string {
    const fecha = new Date(lastPeriodDate);
    fecha.setDate(fecha.getDate() + cycleLength);

    return fecha.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long'
    });
}

/**
 * Calcula promedios de hábitos de los últimos 7 días
 */
function calcularPromediosHabitos(logs: DailyLog[]) {
    const ultimos7 = logs.slice(0, 7);

    if (ultimos7.length === 0) {
        return {
            sueno: '0.0',
            estres: '0.0',
            agua: 0,
            vegetales: 0,
            diasConAlcohol: 0
        };
    }

    const sumaSueno = ultimos7.reduce((sum, log) => sum + (log.sleepHours || 0), 0);
    const sumaEstres = ultimos7.reduce((sum, log) => sum + (log.stressLevel || 0), 0);
    const sumaAgua = ultimos7.reduce((sum, log) => sum + (log.waterGlasses || 0), 0);
    const sumaVegetales = ultimos7.reduce((sum, log) => sum + (log.veggieServings || 0), 0);
    const diasConAlcohol = ultimos7.filter(log => log.alcohol).length;

    return {
        sueno: (sumaSueno / ultimos7.length).toFixed(1),
        estres: (sumaEstres / ultimos7.length).toFixed(1),
        agua: Math.round(sumaAgua / ultimos7.length),
        vegetales: Math.round(sumaVegetales / ultimos7.length),
        diasConAlcohol
    };
}

/**
 * Genera todos los datos para el informe médico
 */
export function generarDatosInformeMedico(
    user: UserProfile,
    logs: DailyLog[],
    cycleDayOverride?: number
): MedicalReportData | null {
    // Calcular datos básicos
    const resultadoIMC = calcularIMC(user.weight || 0, user.height || 0);
    const pesoIdeal = calcularPesoIdeal(user.height || 0);
    const analisisEdad = analizarEdadFertilidad(user.age || 0);
    const promedios = calcularPromediosHabitos(logs);

    // Valores por defecto
    let diaDelCiclo = 0;
    let diaOvulacion = 0;
    let ventanaFertil = { inicio: 0, fin: 0, diasFertiles: 0 };
    let fechaProximaMenstruacion = "Pendiente";
    let fechaInicioCicloActual = "Pendiente";
    let diasHastaOvulacion = 0;
    let diasHastaProximaRegla = 0;
    let probabilidadEmbarazoHoy = 0;

    // CRITICAL: Calcular datos de ciclo si existen O si tenemos override
    // Si falta lastPeriodDate pero tenemos cycleDayOverride, inferimos lastPeriodDate
    let effectiveLastPeriod = user.lastPeriodDate;
    if (!effectiveLastPeriod && cycleDayOverride) {
        const hoy = new Date();
        const estimatedLastPeriod = new Date(hoy);
        estimatedLastPeriod.setDate(hoy.getDate() - (cycleDayOverride - 1));
        effectiveLastPeriod = estimatedLastPeriod.toISOString().split('T')[0];
        // logger.log('🔄 Inferida lastPeriodDate desde cycleDay:', effectiveLastPeriod);
    }

    // Si falta cycleLength, usamos 28 por defecto si tenemos override, o fallamos
    // logger.log('🔍 DEBUG cycleLength:', {
    //     userCycleLength: user.cycleLength,
    //     type: typeof user.cycleLength,
    //     cycleDayOverride: cycleDayOverride
    // });

    const usandoDefault = !user.cycleLength && cycleDayOverride ? true : false;
    let effectiveCycleLength = user.cycleLength ? Number(user.cycleLength) : (cycleDayOverride ? 28 : 0);

    if (usandoDefault) {
        // logger.warn('⚠️ cycleLength no está definido, usando 28 días por defecto');
    } else {
        // logger.log('✅ Usando cycleLength del usuario:', effectiveCycleLength);
    }

    if (effectiveLastPeriod && effectiveCycleLength) {
        // logger.log('🧮 Datos ciclo efectivos:', {
        //     lastPeriod: effectiveLastPeriod,
        //     cycleLen: effectiveCycleLength,
        //     cycleDayOverride
        // });

        // USAR cycleLength para calcular día del ciclo correctamente
        // Si tenemos override, lo usamos directamente, si no calculamos
        if (cycleDayOverride) {
            diaDelCiclo = cycleDayOverride;
        } else {
            diaDelCiclo = calcularDiaDelCiclo(effectiveLastPeriod, effectiveCycleLength);
        }

        if (diaDelCiclo < 1) diaDelCiclo = 1;

        const ventana = calcularVentanaFertil(effectiveCycleLength);
        ventanaFertil = {
            inicio: ventana.inicio,
            fin: ventana.fin,
            diasFertiles: ventana.diasFertiles
        };
        diaOvulacion = ventana.diaOvulacion;

        // Calcular fecha próxima regla basada en calendario estricto
        // Próxima Regla = Última Regla + (N * Duración Ciclo)
        // Donde N es el número de ciclos necesarios para llegar al futuro
        const diasDesdeInicio = Math.floor((new Date().getTime() - new Date(effectiveLastPeriod).getTime()) / (1000 * 60 * 60 * 24));
        const ciclosCompletados = Math.floor(diasDesdeInicio / effectiveCycleLength);
        // El ciclo actual es ciclosCompletados + 1
        // La próxima regla será al finalizar el ciclo actual
        const diasParaProxima = (ciclosCompletados + 1) * effectiveCycleLength;

        const fechaRegla = new Date(effectiveLastPeriod);
        fechaRegla.setDate(fechaRegla.getDate() + diasParaProxima);

        fechaProximaMenstruacion = fechaRegla.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long'
        });

        // Calcular fecha de inicio del ciclo ACTUAL (puede ser diferente a lastPeriodDate si han pasado varios ciclos)
        // inicioCicloActual ya lo calculamos arriba para la ovulación, lo formateamos aquí
        const inicioCicloActual = new Date(effectiveLastPeriod);
        inicioCicloActual.setDate(inicioCicloActual.getDate() + (ciclosCompletados * effectiveCycleLength));

        fechaInicioCicloActual = inicioCicloActual.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short'
        });

        // Días restantes (diferencia entre esa fecha futura y hoy)
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaRegla.setHours(0, 0, 0, 0);
        const diffTime = fechaRegla.getTime() - hoy.getTime();
        diasHastaProximaRegla = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Días restantes para ovulación
        // Cálculo directo: Día de ovulación - Día actual del ciclo
        diasHastaOvulacion = diaOvulacion - diaDelCiclo;

        // Probabilidad hoy
        const diaRelativoOvulacion = diaDelCiclo - ventana.diaOvulacion;
        probabilidadEmbarazoHoy = calcularProbabilidadPorDia(diaRelativoOvulacion);
    }

    return {
        edad: user.age || 0,
        imc: {
            valor: resultadoIMC.valor.toString(),
            categoria: resultadoIMC.categoria
        },
        pesoActual: user.weight || 0,
        pesoIdeal: {
            minimo: Math.round(pesoIdeal.minimo),
            maximo: Math.round(pesoIdeal.maximo)
        },
        diaDelCiclo,
        cycleLengthUsado: effectiveCycleLength,
        usandoValorPorDefecto: usandoDefault,
        diaOvulacion,
        ventanaFertil,
        fechaProximaMenstruacion,
        fechaInicioCicloActual,
        diasHastaOvulacion,
        diasHastaProximaRegla,
        probabilidadEmbarazoHoy,
        promedios,
        analisisEdad
    };
}
