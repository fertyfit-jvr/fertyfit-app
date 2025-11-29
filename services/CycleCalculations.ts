/**
 * CycleCalculations.ts
 * 
 * Funciones de cálculo para ciclo menstrual y fertilidad
 * Todas las fórmulas están validadas médicamente por el equipo
 * Basadas en guidelines de ASRM, ACOG, OMS y estudios científicos
 */

// ============================================================================
// 1. CÁLCULO DE OVULACIÓN
// ============================================================================

/**
 * Calcula el día estimado de ovulación
 * Fórmula validada: Ciclo - 14 días (fase lútea estándar)
 * Precisión: ~70-80% en ciclos regulares
 */
export function calcularDiaOvulacion(duracionCiclo: number): number {
    return duracionCiclo - 14;
}

// ============================================================================
// 2. VENTANA FÉRTIL
// ============================================================================

export interface VentanaFertil {
    inicio: number;
    fin: number;
    diasFertiles: number;
    diaOvulacion: number;
}

/**
 * Calcula la ventana fértil
 * Fórmula validada: 5 días antes + día ovulación + 1 día después = 7 días
 * Basado en: Wilcox et al. (1995) y ASRM guidelines
 */
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

// ============================================================================
// 3. PROBABILIDAD DE EMBARAZO POR DÍA
// ============================================================================

/**
 * Tabla de probabilidades de embarazo por día relativo a ovulación
 * Basado en: Wilcox et al. (1995) - Estudio clínico publicado
 * Nota: El día MÁS fértil es 1-2 días ANTES de ovulación
 */
const PROBABILIDAD_POR_DIA: Record<string, number> = {
    '-5': 10,   // 5 días antes: 10%
    '-4': 16,   // 4 días antes: 16%
    '-3': 14,   // 3 días antes: 14%
    '-2': 27,   // 2 días antes: 27% ← DÍA MÁS FÉRTIL
    '-1': 31,   // 1 día antes: 31%
    '0': 33,    // Día ovulación: 33%
    '1': 10     // 1 día después: 10%
};

export function calcularProbabilidadPorDia(diaRelativoOvulacion: number): number {
    const key = diaRelativoOvulacion.toString();
    return PROBABILIDAD_POR_DIA[key] || 0;
}

// ============================================================================
// 4. IMC (ÍNDICE DE MASA CORPORAL)
// ============================================================================

export interface ResultadoIMC {
    valor: string;
    categoria: string;
    impactoFertilidad: string;
}

/**
 * Calcula IMC según fórmula OMS
 * Clasificación: Organización Mundial de la Salud
 */
export function calcularIMC(pesoKg: number, alturaCm: number): ResultadoIMC {
    const alturaM = alturaCm / 100;
    const imc = pesoKg / (alturaM * alturaM);

    let categoria: string;
    let impactoFertilidad: string;

    if (imc < 18.5) {
        categoria = "Bajo peso";
        impactoFertilidad = "El bajo peso puede causar ciclos irregulares o ausencia de ovulación";
    } else if (imc < 25) {
        categoria = "Peso normal";
        impactoFertilidad = "Tu peso está en el rango óptimo para fertilidad";
    } else if (imc < 30) {
        categoria = "Sobrepeso";
        impactoFertilidad = "El sobrepeso puede afectar la ovulación y regularidad menstrual";
    } else if (imc < 35) {
        categoria = "Obesidad clase I";
        impactoFertilidad = "La obesidad está asociada con ciclos irregulares y menor fertilidad";
    } else if (imc < 40) {
        categoria = "Obesidad clase II";
        impactoFertilidad = "Esta categoría de obesidad afecta significativamente la fertilidad";
    } else {
        categoria = "Obesidad clase III";
        impactoFertilidad = "Esta categoría requiere atención médica antes de intentar concebir";
    }

    return {
        valor: imc.toFixed(1),
        categoria,
        impactoFertilidad
    };
}

// ============================================================================
// 5. PESO IDEAL
// ============================================================================

export interface PesoIdeal {
    minimo: number;
    maximo: number;
}

/**
 * Calcula rango de peso ideal para fertilidad
 * Basado en IMC saludable (18.5-24.9)
 */
export function calcularPesoIdeal(alturaCm: number): PesoIdeal {
    const alturaM = alturaCm / 100;
    const pesoMin = 18.5 * (alturaM * alturaM);
    const pesoMax = 24.9 * (alturaM * alturaM);

    return {
        minimo: Math.round(pesoMin * 10) / 10,
        maximo: Math.round(pesoMax * 10) / 10
    };
}

// ============================================================================
// 6. REGULARIDAD DEL CICLO
// ============================================================================

export interface ResultadoRegularidad {
    regular: boolean | null;
    variacion: number;
    mensaje: string;
}

/**
 * Analiza regularidad del ciclo menstrual
 * Criterio ACOG: Regular si variación ≤7 días
 */
export function analizarRegularidad(listaCiclos: number[]): ResultadoRegularidad {
    if (listaCiclos.length < 2) {
        return {
            regular: null,
            variacion: 0,
            mensaje: "Necesitas más ciclos registrados"
        };
    }

    const maximo = Math.max(...listaCiclos);
    const minimo = Math.min(...listaCiclos);
    const variacion = maximo - minimo;

    return {
        regular: variacion <= 7,
        variacion,
        mensaje: variacion <= 7 ? "Tus ciclos son regulares" : "Tus ciclos son irregulares"
    };
}

// ============================================================================
// 7. DETECCIÓN DE OVULACIÓN POR TEMPERATURA
// ============================================================================

export interface ResultadoOvulacion {
    detectada: boolean;
    aumento: string;
    mensaje: string;
}

/**
 * Detecta ovulación por aumento de temperatura basal
 * Criterio: Aumento ≥0.2°C respecto a promedio fase folicular
 * Requiere: 6 días de temperaturas pre-ovulatorias
 */
export function detectarOvulacion(temperaturas: number[]): ResultadoOvulacion {
    if (temperaturas.length < 7) {
        return {
            detectada: false,
            aumento: "0.0",
            mensaje: "Necesitas más días de registro"
        };
    }

    const ultimos6 = temperaturas.slice(0, 6);
    const promedio = ultimos6.reduce((a, b) => a + b) / 6;
    const tempHoy = temperaturas[6];
    const aumento = tempHoy - promedio;

    return {
        detectada: aumento >= 0.2,
        aumento: aumento.toFixed(2),
        mensaje: aumento >= 0.2
            ? `Posible ovulación detectada (temperatura subió ${aumento.toFixed(1)}°C)`
            : "No se detectó ovulación aún"
    };
}

// ============================================================================
// 8. EDAD Y FERTILIDAD
// ============================================================================

export interface ResultadoEdadFertilidad {
    categoria: string;
    probabilidad: string;
    consultarDespuesDe: number;
    mensaje: string;
}

/**
 * Analiza fertilidad según edad
 * Basado en: ASRM (American Society for Reproductive Medicine)
 */
export function analizarEdadFertilidad(edad: number): ResultadoEdadFertilidad {
    if (edad < 35) {
        return {
            categoria: "Fertilidad normal",
            probabilidad: "15-20% por ciclo",
            consultarDespuesDe: 12,
            mensaje: "Tu edad es favorable para la concepción natural"
        };
    } else if (edad < 40) {
        return {
            categoria: "Fertilidad disminuida",
            probabilidad: "8-15% por ciclo",
            consultarDespuesDe: 6,
            mensaje: "Tu fertilidad ha comenzado a disminuir. Considera consultar después de 6 meses"
        };
    } else if (edad < 45) {
        return {
            categoria: "Fertilidad baja",
            probabilidad: "3-8% por ciclo",
            consultarDespuesDe: 0,
            mensaje: "Se recomienda consultar con especialista en fertilidad desde el inicio"
        };
    } else if (edad < 50) {
        return {
            categoria: "Fertilidad muy baja",
            probabilidad: "<2% por ciclo",
            consultarDespuesDe: 0,
            mensaje: "El embarazo natural es muy improbable. Consulta con especialista en reproducción asistida"
        };
    } else {
        return {
            categoria: "Post-reproductiva",
            probabilidad: "<1% por ciclo",
            consultarDespuesDe: 0,
            mensaje: "A esta edad, el embarazo natural es extremadamente raro y conlleva riesgos significativos"
        };
    }
}

/**
 * Determina si se deben enviar notificaciones de ventana fértil
 * Criterio: No enviar si edad ≥50 años
 */
export function debeEnviarNotificacionFertilidad(edad: number): boolean {
    return edad < 50;
}

// ============================================================================
// 9. CUÁNDO RECOMENDAR CONSULTA MÉDICA
// ============================================================================

export interface AlertaConsulta {
    prioridad: 'URGENTE' | 'ALTA' | 'MEDIA';
    mensaje: string;
}

export interface DatosConsulta {
    edad: number;
    mesesIntentando: number;
    variacionCiclo: number;
    imc: number;
    diasSinMenstruacion: number;
}

/**
 * Evalúa necesidad de consulta médica
 * Basado en: Guidelines ASRM/ACOG
 */
export function evaluarNecesidadConsulta(datos: DatosConsulta): AlertaConsulta[] {
    const alertas: AlertaConsulta[] = [];

    // Edad y tiempo intentando
    if (datos.edad < 35 && datos.mesesIntentando >= 12) {
        alertas.push({
            prioridad: "ALTA",
            mensaje: "Has estado intentando por 12+ meses. Te recomendamos consultar con un especialista en fertilidad"
        });
    }

    if (datos.edad >= 35 && datos.edad < 40 && datos.mesesIntentando >= 6) {
        alertas.push({
            prioridad: "ALTA",
            mensaje: "A tu edad, se recomienda consultar después de 6 meses intentando. Es momento de buscar apoyo especializado"
        });
    }

    if (datos.edad >= 40) {
        alertas.push({
            prioridad: "ALTA",
            mensaje: "Dada tu edad, te recomendamos consultar con un especialista en fertilidad desde el inicio"
        });
    }

    // Ciclos irregulares
    if (datos.variacionCiclo > 7) {
        alertas.push({
            prioridad: "MEDIA",
            mensaje: "Tus ciclos son irregulares. Esto puede indicar problemas de ovulación. Considera consultar con ginecólogo"
        });
    }

    // IMC extremo
    if (datos.imc < 17 || datos.imc > 35) {
        alertas.push({
            prioridad: "MEDIA",
            mensaje: "Tu IMC está fuera del rango que favorece la fertilidad. Consulta con nutricionista o endocrinólogo"
        });
    }

    // Amenorrea (ausencia de menstruación)
    if (datos.diasSinMenstruacion >= 90 && datos.edad < 45) {
        alertas.push({
            prioridad: "URGENTE",
            mensaje: "No has tenido menstruación en 3+ meses. Te recomendamos consultar con ginecólogo pronto"
        });
    }

    return alertas;
}

// ============================================================================
// 10. PUNTUACIÓN DE FERTILIDAD
// ============================================================================

export interface FactorFertilidad {
    factor: string;
    impacto: number;
    gravedad: 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO';
}

export interface InterpretacionPuntuacion {
    nivel: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'BAJO';
    mensaje: string;
    color: 'green' | 'lightgreen' | 'orange' | 'red';
}

export interface ResultadoPuntuacion {
    puntuacion: number;
    factores: FactorFertilidad[];
    interpretacion: InterpretacionPuntuacion;
}

export interface DatosPuntuacion {
    edad: number;
    imc: number;
    fuma: boolean;
    alcoholFrecuente: boolean;
    ciclosIrregulares: boolean;
    estresAlto: boolean;
    suenoInsuficiente: boolean;
}

/**
 * Calcula puntuación global de fertilidad
 * Sistema basado en evidencia científica
 */
export function calcularPuntuacionFertilidad(datos: DatosPuntuacion): ResultadoPuntuacion {
    let puntos = 100;
    const factores: FactorFertilidad[] = [];

    // FUMAR: -30 puntos (mayor impacto)
    // Evidencia: Reduce fertilidad 30-40%, acelera menopausia 1-4 años
    if (datos.fuma) {
        puntos -= 30;
        factores.push({ factor: "Fumar", impacto: -30, gravedad: "CRÍTICO" });
    }

    // EDAD >35: -2 puntos por año
    // Evidencia: Fertilidad disminuye ~3-5% por año después de 35
    if (datos.edad > 35) {
        const penalizacion = (datos.edad - 35) * 2;
        puntos -= penalizacion;
        factores.push({ factor: `Edad >${datos.edad}`, impacto: -penalizacion, gravedad: "ALTO" });
    }

    // OBESIDAD (IMC≥30): -25 puntos
    // Evidencia: Reduce fertilidad 25-35%, causa anovulación
    if (datos.imc >= 30) {
        puntos -= 25;
        factores.push({ factor: "Obesidad", impacto: -25, gravedad: "ALTO" });
    }
    // SOBREPESO (IMC 25-29.9): -15 puntos
    // Evidencia: Reduce fertilidad 8-15%
    else if (datos.imc >= 25) {
        puntos -= 15;
        factores.push({ factor: "Sobrepeso", impacto: -15, gravedad: "MEDIO" });
    }

    // BAJO PESO (IMC<18.5): -15 puntos
    // Evidencia: Causa anovulación, amenorrea
    if (datos.imc < 18.5) {
        puntos -= 15;
        factores.push({ factor: "Bajo peso", impacto: -15, gravedad: "MEDIO" });
    }

    // ALCOHOL FRECUENTE: -15 puntos
    // Evidencia: >4 bebidas/semana reduce fertilidad ~20%
    if (datos.alcoholFrecuente) {
        puntos -= 15;
        factores.push({ factor: "Consumo frecuente de alcohol", impacto: -15, gravedad: "MEDIO" });
    }

    // CICLOS IRREGULARES: -15 puntos
    // Evidencia: Indica posible anovulación
    if (datos.ciclosIrregulares) {
        puntos -= 15;
        factores.push({ factor: "Ciclos irregulares", impacto: -15, gravedad: "MEDIO" });
    }

    // ESTRÉS CRÓNICO ALTO: -10 puntos
    // Evidencia: Estrés severo puede alterar ovulación
    if (datos.estresAlto) {
        puntos -= 10;
        factores.push({ factor: "Estrés crónico alto", impacto: -10, gravedad: "BAJO" });
    }

    // SUEÑO INSUFICIENTE: -5 puntos
    // Evidencia: <6h afecta hormonas reproductivas
    if (datos.suenoInsuficiente) {
        puntos -= 5;
        factores.push({ factor: "Sueño insuficiente", impacto: -5, gravedad: "BAJO" });
    }

    puntos = Math.max(0, puntos);

    return {
        puntuacion: puntos,
        factores,
        interpretacion: interpretarPuntuacion(puntos)
    };
}

function interpretarPuntuacion(puntos: number): InterpretacionPuntuacion {
    if (puntos >= 80) {
        return {
            nivel: "EXCELENTE",
            mensaje: "Tu perfil de fertilidad está optimizado",
            color: "green"
        };
    }
    if (puntos >= 60) {
        return {
            nivel: "BUENO",
            mensaje: "Buenas condiciones, algunos aspectos mejorables",
            color: "lightgreen"
        };
    }
    if (puntos >= 40) {
        return {
            nivel: "REGULAR",
            mensaje: "Varios factores están afectando tu fertilidad",
            color: "orange"
        };
    }
    return {
        nivel: "BAJO",
        mensaje: "Múltiples factores comprometen tu fertilidad. Consulta especialista",
        color: "red"
    };
}

// ============================================================================
// CONSTANTES Y DISCLAIMERS
// ============================================================================

export const DISCLAIMERS = {
    ovulacion: "Estimación basada en promedio de 14 días de fase lútea. La ovulación real puede variar ±2 días.",
    ventanaFertil: "Las predicciones de fertilidad son estimaciones basadas en tus datos y promedios estadísticos. La fertilidad varía entre personas.",
    imc: "El IMC es solo un indicador general. No considera masa muscular, composición corporal ni otros factores de salud. Consulta con un profesional de la salud para una evaluación completa.",
    edad: "Esta información es general. Tu situación específica debe ser evaluada por un especialista en medicina reproductiva.",
    general: "Esta aplicación proporciona estimaciones educativas basadas en promedios generales. NO sustituye el consejo médico profesional. Para decisiones sobre tu salud reproductiva, siempre consulta con un médico especialista."
};

export const IMPACTO_HABITOS = {
    fumar: "Reduce fertilidad 30-40% y acelera menopausia 1-4 años",
    alcohol: "Más de 4 bebidas/semana reduce fertilidad ~20%",
    obesidad: "IMC≥30 reduce fertilidad 25-35% y causa ciclos anovulatorios",
    sobrepeso: "IMC 25-30 reduce fertilidad 8-15%",
    bajoPeso: "IMC<18.5 puede causar ausencia de ovulación y menstruación",
    estres: "Estrés severo crónico puede inhibir ovulación",
    ejercicioExtremo: "Más de 7h/semana de ejercicio intenso puede afectar ovulación"
};
