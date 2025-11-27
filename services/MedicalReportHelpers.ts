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
    pesoActual: number;
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

    console.log('🧮 Calculando día ciclo con:', lastPeriodDate);

    // Intentar parsear fecha de varias formas
    let ultimaRegla = new Date(lastPeriodDate);

    // Si es inválida, intentar formato DD/MM/YYYY si aplica (común en inputs manuales)
    if (isNaN(ultimaRegla.getTime())) {
        console.warn('⚠️ Fecha inválida, intentando parsear manual:', lastPeriodDate);
        // Aquí podrías agregar lógica extra si fuera necesario
        return 0;
    }

    const hoy = new Date();
    // Resetear horas para cálculo de días puro
    ultimaRegla.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const diferencia = hoy.getTime() - ultimaRegla.getTime();
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));

    console.log('🧮 Resultado día ciclo:', dias + 1);
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
    // Calcular datos básicos (siempre posibles si hay peso/altura/edad)
    const resultadoIMC = calcularIMC(user.weight || 0, user.height || 0);
    const pesoIdeal = calcularPesoIdeal(user.height || 0);
    const analisisEdad = analizarEdadFertilidad(user.age || 0);
    const promedios = calcularPromediosHabitos(logs);

    // Valores por defecto para ciclo si faltan datos
    let diaDelCiclo = 0;
    let diaOvulacion = 0;
    let ventanaFertil = { inicio: 0, fin: 0, diasFertiles: 0 };
    let fechaProximaMenstruacion = "Pendiente";
    let diasHastaOvulacion = 0;
    let diasHastaProximaRegla = 0;
    let probabilidadEmbarazoHoy = 0;

    // Calcular datos de ciclo solo si existen los datos necesarios
    if (user.lastPeriodDate && user.cycleLength) {
        const cycleLen = Number(user.cycleLength); // Asegurar número
        console.log('🧮 Datos ciclo:', { lastPeriod: user.lastPeriodDate, cycleLen });

        diaDelCiclo = calcularDiaDelCiclo(user.lastPeriodDate);

        // Si el día del ciclo es negativo (fecha futura) o muy alto, manejarlo
        if (diaDelCiclo < 1) diaDelCiclo = 1;

        // Ajustar día del ciclo si excede la duración (reiniciar visualmente o mantener acumulado?)
        // Para fertilidad, nos interesa el día relativo al inicio del ciclo actual.
        // Si diaDelCiclo > cycleLen, significa que debería haber empezado uno nuevo.
        // Por ahora, mostraremos el día acumulado para que la usuaria vea el retraso.

        const ventana = calcularVentanaFertil(cycleLen);
        ventanaFertil = {
            inicio: ventana.inicio,
            fin: ventana.fin,
            diasFertiles: ventana.diasFertiles
        };
        diaOvulacion = ventana.diaOvulacion;

        fechaProximaMenstruacion = calcularFechaProximaMenstruacion(
            user.lastPeriodDate,
            cycleLen
        );

        // Días restantes (pueden ser negativos si ya pasó)
        diasHastaOvulacion = ventana.diaOvulacion - diaDelCiclo;
        diasHastaProximaRegla = cycleLen - diaDelCiclo;

        // Probabilidad hoy
        const diaRelativoOvulacion = diaDelCiclo - ventana.diaOvulacion;
        probabilidadEmbarazoHoy = calcularProbabilidadPorDia(diaRelativoOvulacion);
    }

    return {
        edad: user.age || 0,
        imc: {
            valor: resultadoIMC.valor,
            categoria: resultadoIMC.categoria
        },
        pesoActual: user.weight || 0,
        pesoIdeal,
        diaDelCiclo,
        diaOvulacion,
        ventanaFertil,
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
