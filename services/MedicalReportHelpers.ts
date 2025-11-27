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

export interface MedicalReportData {
    // Datos básicos
    edad: number;
    imc: {
        valor: string;
        categoria: string;
    };
    pesoIdeal: {
        minimo: number;
        maximo: number;
    };

    // Datos de ciclo
    diaDelCiclo: number;
    diaOvulacion: number;
    ventanaFertil: {
        inicio: number;
        fin: number;
        diasFertiles: number;
    };
    fechaProximaMenstruacion: string;

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

/**
 * Calcula el día actual del ciclo
 */
function calcularDiaDelCiclo(lastPeriodDate: string | undefined): number {
    if (!lastPeriodDate) return 0;

    const ultimaRegla = new Date(lastPeriodDate);
    const hoy = new Date();
    const diferencia = hoy.getTime() - ultimaRegla.getTime();
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));

    return dias + 1;
}

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
    logs: DailyLog[]
): MedicalReportData | null {
    // Validar datos mínimos
    if (!user.lastPeriodDate || !user.cycleLength) {
        return null;
    }

    // Calcular datos básicos
    const resultadoIMC = calcularIMC(user.weight, user.height);
    const pesoIdeal = calcularPesoIdeal(user.height);

    // Calcular datos de ciclo
    const diaDelCiclo = calcularDiaDelCiclo(user.lastPeriodDate);
    const ventanaFertil = calcularVentanaFertil(user.cycleLength);
    const fechaProximaMenstruacion = calcularFechaProximaMenstruacion(
        user.lastPeriodDate,
        user.cycleLength
    );

    // Calcular días restantes
    const diasHastaOvulacion = ventanaFertil.diaOvulacion - diaDelCiclo;
    const diasHastaProximaRegla = user.cycleLength - diaDelCiclo;

    // Calcular probabilidad de embarazo hoy
    const diaRelativoOvulacion = diaDelCiclo - ventanaFertil.diaOvulacion;
    const probabilidadEmbarazoHoy = calcularProbabilidadPorDia(diaRelativoOvulacion);

    // Calcular promedios de hábitos
    const promedios = calcularPromediosHabitos(logs);

    // Análisis de edad
    const analisisEdad = analizarEdadFertilidad(user.age);

    return {
        edad: user.age,
        imc: {
            valor: resultadoIMC.valor,
            categoria: resultadoIMC.categoria
        },
        pesoIdeal,
        diaDelCiclo,
        diaOvulacion: ventanaFertil.diaOvulacion,
        ventanaFertil: {
            inicio: ventanaFertil.inicio,
            fin: ventanaFertil.fin,
            diasFertiles: ventanaFertil.diasFertiles
        },
        fechaProximaMenstruacion,
        diasHastaOvulacion,
        diasHastaProximaRegla,
        probabilidadEmbarazoHoy,
        promedios,
        analisisEdad: {
            categoria: analisisEdad.categoria,
            probabilidad: analisisEdad.probabilidad,
            mensaje: analisisEdad.mensaje
        }
    };
}
