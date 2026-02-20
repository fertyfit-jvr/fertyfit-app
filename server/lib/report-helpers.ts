import type { UserProfile, DailyLog, ConsultationForm, AppNotification } from '../../types.js';

export type ReportType = '360' | 'BASIC' | 'DAILY' | 'LABS';

export interface ReportContext {
  perfil: any;
  registros_diarios?: DailyLog[];
  formularios?: ConsultationForm[];
  informes_previos?: Array<{ fecha: string; contenido: string }>;
  fecha_informe: string;
}

/**
 * Construye el contexto del informe según el tipo seleccionado
 */
export function buildReportContext(
  reportType: ReportType,
  userProfile: UserProfile,
  logs: DailyLog[],
  forms: ConsultationForm[],
  previousReports?: AppNotification[]
): ReportContext {
  const baseProfile = {
    id: userProfile.id,
    nombre: userProfile.name,
    edad: userProfile.age,
    peso: userProfile.weight,
    altura: userProfile.height,
    objetivo: userProfile.mainObjective,
    estado_pareja: userProfile.partnerStatus,
    ciclo: {
      longitud: userProfile.cycleLength,
      regularidad: userProfile.cycleRegularity,
      ultima_regla: userProfile.lastPeriodDate,
      historial_reglas: userProfile.periodHistory,
    },
    diagnosticos: userProfile.diagnoses,
    tratamientos_fertilidad: userProfile.fertilityTreatments,
    suplementos: userProfile.supplements,
    consumo_alcohol: userProfile.alcoholConsumption,
    fumadora: userProfile.smoker,
  };

  switch (reportType) {
    case '360': {
      // Informe completo: todos los datos
      const f0Forms = forms.filter(f => f.form_type === 'F0');
      const pillarForms = forms.filter(f =>
        ['FUNCTION', 'FOOD', 'FLORA', 'FLOW'].includes(f.form_type || '')
      );
      const examForms = forms.filter(f => {
        // Exámenes: form_type EXAM o legacy (exam_type en answers)
        return f.form_type === 'EXAM' || f.answers?.some((a: any) => a.questionId === 'exam_type');
      });

      const context: ReportContext = {
        perfil: baseProfile,
        registros_diarios: logs,
        formularios: [...f0Forms, ...pillarForms, ...examForms],
        fecha_informe: new Date().toISOString(),
      };

      // Si hay informes previos, incluir todos los filtrados por el endpoint
      if (previousReports && previousReports.length > 0) {
        context.informes_previos = previousReports.map(r => ({
          tipo: r.metadata?.report_type || 'Historial',
          fecha: r.created_at,
          contenido: r.message,
        }));
      }

      return context;
    }

    case 'BASIC': {
      // Solo F0 y formularios de pilares
      const f0Forms = forms.filter(f => f.form_type === 'F0');
      const pillarForms = forms.filter(f =>
        ['FUNCTION', 'FOOD', 'FLORA', 'FLOW'].includes(f.form_type || '')
      );

      return {
        perfil: baseProfile,
        formularios: [...f0Forms, ...pillarForms],
        fecha_informe: new Date().toISOString(),
      };
    }

    case 'DAILY': {
      // Solo registros diarios con perfil mínimo
      return {
        perfil: {
          id: userProfile.id,
          nombre: userProfile.name,
          edad: userProfile.age,
          ciclo: {
            longitud: userProfile.cycleLength,
            regularidad: userProfile.cycleRegularity,
            ultima_regla: userProfile.lastPeriodDate,
            historial_reglas: userProfile.periodHistory,
          },
        },
        registros_diarios: logs,
        fecha_informe: new Date().toISOString(),
      };
    }

    case 'LABS': {
      // Informe centrado en analíticas:
      // - Incluye siempre el perfil completo
      // - Los formularios ya deben venir filtrados desde el handler:
      //   F0 + pilares + analíticas (según alcance: última o todas)
      return {
        perfil: baseProfile,
        formularios: forms,
        fecha_informe: new Date().toISOString(),
      };
    }

    default:
      throw new Error(`Tipo de informe desconocido: ${reportType}`);
  }
}

/**
 * Genera el prompt especializado según el tipo de informe
 */
export function getPromptForReportType(
  reportType: ReportType,
  ragContext: string,
  ragChunksCount: number,
  hasPreviousReports: boolean,
  ragChunksMetadata?: Array<{ document_id?: string; document_title?: string; chunk_index?: number }>
): string {
  const maxCitations = Math.min(ragChunksCount, 8);
  const ragSection = ragContext ? `
MARCO METODOLÓGICO FERTYFIT:
La metodología FertyFit se basa en 4 pilares (Function, Food, Flora, Flow) y la siguiente documentación científica autorizada.
USA ESTA INFORMACIÓN COMO TU FUENTE PRINCIPAL. 

CONTEXTO METODOLÓGICO FERTYFIT (${ragChunksCount} fragmentos de documentación):
${ragContext}

IMPORTANTE - REGLAS DE CITACIÓN Y BIBLIOGRAFÍA:
- DEBES citar al menos ${maxCitations > 0 ? maxCitations : 1} fuentes de la lista anterior si son relevantes.
- PROHIBICIÓN ESTRICTA: NO inventes ni cites autores externos (ej. Lara Briden, Jorge Chavarro, etc.) como si fueran parte de la metodología FertyFit.
- Si un tema NO está cubierto en el contexto FertyFit arriba proporcionado, usa conocimiento médico general pero acláralo: "Según evidencia médica general...". 
- Al final, en la sección de Bibliografía, lista ÚNICAMENTE las fuentes del contexto FertyFit que están arriba (con sus Documento ID). NO incluyas fuentes externas ni conocimientos generales en la lista de bibliografía.
- Si no hay fragmentos disponibles, indica: "No hay bibliografía de FertyFit disponible para este punto específico."
` : '';

  switch (reportType) {
    case '360':
      return `
Eres un experto en fertilidad y salud integral femenina siguiendo la metodología FertyFit.

IMPORTANTE: El informe DEBE estar formateado en Markdown válido. Usa:
- # Título para secciones principales
- ## Subtítulo para subsecciones
- - Lista para listas con viñetas
- 1. Lista para listas numeradas
- **texto** para negritas
- *texto* para cursivas

${ragSection}DATOS DE LA PACIENTE:
Recibirás un JSON con:
- Perfil completo de la usuaria.
- Historial completo de registros diarios (temperatura, moco, sueño, estrés, hábitos).
- Formulario F0 y todos los formularios de pilares (Function, Food, Flora, Flow).
- Todos los exámenes médicos guardados (analíticas y ecografías).
${hasPreviousReports ? '- **Informes previos**: Verás el último Informe Básico, informes de Analíticas (Labs) y de Registros (Daily) recientes. Tu tarea es cruzarlos para evaluar el progreso global.\n' : ''}
TAREA:
Construye un INFORME 360º MENSUAL COMPLETO (máximo 1800 palabras) formateado en Markdown. Este es un informe superior de META-ANÁLISIS; tu trabajo es sintetizar la evolución de la usuaria durante este mes utilizando todos los informes previos como base y señalando cualquier tendencia detectada.

Esquema obligatorio:

## 1. Resumen de Evolución Mensual (máximo 200 palabras)
   - Síntesis clara de la situación reproductiva de la paciente tras el último mes de método FertyFit.
   - Destaca 3-5 ideas clave o cambios respecto a su Informe Básico o mediciones recientes.

## 2. Análisis Integral 360º
   - Analiza en conjunto el impacto del último mes en sus pilares biológicos (Function, Food, Flora, Flow).
   ${hasPreviousReports ? '- Integra las observaciones de los Informes Diarios (DAILY) y Analíticas (LABS) si los hay, detectando tendencias y cruces (ej: cómo su ciclo se relacionó con su nutrición y descanso).' : '- Ciclo y biomarcadores: comenta los patrones (regularidad, posibles ovulaciones, etc.).'}
   - Evolución respecto a sus prioridades establecidas en el Informe Básico.

## 3. Aspectos destacados y Alertas (máximo 300 palabras)
   - Lista numerada de 5-7 aspectos detectados en los datos de este mes.
   - Mezcla factores de riesgo/alerta a corregir con fortalezas importantes a mantener.
   - Cada punto debe ser específico y accionable.

## 4. Preguntas para el equipo médico (máximo 200 palabras)
   - Lista de 4-6 preguntas muy concretas para llevar a la siguiente consulta médica.
   - Basado en los patrones del mes y los analíticos que presenten discrepancias.

## 5. Próximos Pasos Recomendados (máximo 300 palabras)
   - Lista numerada de 5-7 recomendaciones estratégicas para el siguiente mes de su recorrido fertil.
   - Priorizadas según su impacto potencial.

## 6. Bibliografía consultada
   ${ragContext && ragChunksMetadata && ragChunksMetadata.length > 0
          ? `
   DEBES utilizar información de los ${ragChunksCount} fragmentos del contexto FertyFit proporcionado.
   Metadatos de las fuentes disponibles:
   ${ragChunksMetadata
            .map(
              (meta, idx) =>
                `   - Fragmento ${idx + 1}: Documento ID "${meta.document_id || 'N/A'}" | Título: "${meta.document_title || 'Sin título'
                }" | Índice del fragmento: ${meta.chunk_index}`
            )
            .join('\n')}
   
   Al final del informe, incluye una lista numerada SOLO con las fuentes de la base de conocimiento FertyFit que REALMENTE hayas usado (no incluyas \"conocimientos generales\" ni \"formularios\" como fuentes), con este formato:
   "[Número]. [Título del documento] | Documento ID: [document_id] | Fragmento: cita breve del contenido relevante usado"
   `
          : ''
        }

INSTRUCCIONES IMPORTANTES:
- Prioriza SIEMPRE la información del contexto FertyFit cuando esté disponible. Solo usa conocimiento médico general para complementar, indicando expresiones como "Según evidencia médica general...".
- No inventes diagnósticos; utiliza expresiones como "podría sugerir", "es compatible con", "recomendaría valorar...".
- Escribe TODO en español y dirigido en segunda persona ("tú").
- Sé CONCISO: evita repeticiones y ve directo al punto.
- El informe completo NO debe exceder 1800 palabras.
- IMPORTANTE: Usa solo sintaxis Markdown estándar. No uses HTML. Formatea cada sección con los encabezados Markdown correspondientes (# y ##).

A continuación tienes el JSON de contexto de la paciente:
`;

    case 'BASIC':
      return `
Eres un experto en fertilidad y salud integral femenina siguiendo la metodología FertyFit.

IMPORTANTE: El informe DEBE estar formateado en Markdown válido. Usa:
- # Título para secciones principales
- ## Subtítulo para subsecciones
- - Lista para listas con viñetas
- 1. Lista para listas numeradas
- **texto** para negritas
- *texto* para cursivas

${ragSection}DATOS DE LA PACIENTE:
Recibirás un JSON con:
- Perfil básico de la usuaria.
- Formulario F0 (formulario inicial).
- Formularios de pilares (Function, Food, Flora, Flow).

TAREA:
Construye un INFORME NARRATIVO MUY CONCRETO (máximo 1000 palabras) formateado en Markdown, con el siguiente esquema obligatorio:

## 1. Descripción de la paciente (máximo 150 palabras)
   - Explica brevemente quién es la usuaria: edad, contexto reproductivo (tiempo intentando, si está en pareja o en solitario), objetivo principal (concepción natural, RA, etc.).
   - Menciona solo los diagnósticos o antecedentes realmente relevantes para la fertilidad (ej: SOP, endometriosis, antecedentes familiares).
   - Si NO hay datos de ciclo suficientes (no hay última regla o duración de ciclo en el JSON), indícalo suavemente y recomienda que registre esos datos en la app para mejorar la precisión.

## 2. Aspectos prioritarios que atender (máximo 250 palabras)
   - Lista numerada con 3-5 puntos clave, ordenados de más a menos prioritario.
   - Cada punto debe describir:
     - Qué se ha detectado (ej: sueño insuficiente, consumo alto de ultraprocesados, sospecha de SOP, edad avanzada para concepción, etc.).
     - Por qué es relevante para la fertilidad.
   - Evita repetir información y sé muy específico.

## 3. Preguntas para el médico (máximo 150 palabras)
   - Lista numerada de 2-4 preguntas muy concretas que la usuaria debería plantear a su ginecólogo/a o especialista en fertilidad.
   - Las preguntas deben salir directamente de los problemas detectados (ej: posibles diagnósticos, necesidad de pruebas adicionales, ajustes de medicación, etc.).

## 4. Cómo puede ayudarte la metodología FertyFit en tu caso (máximo 250 palabras)
   - Explica de forma personalizada (NO genérica) cómo la metodología FertyFit puede ayudar a mejorar los puntos de dolor concretos de esta paciente.
   - Relaciona los pilares Function, Food, Flora y Flow SOLO con los problemas que realmente aparecen en el JSON.
   - Evita frases comerciales vacías; enfócate en qué cambios concretos podría trabajar con la app (ej: mejorar sueño, reducir café, trabajar el estrés, mejorar alimentación, etc.).

## 5. Bibliografía consultada
   ${ragContext && ragChunksMetadata && ragChunksMetadata.length > 0
          ? `
   DEBES utilizar información de los ${ragChunksCount} fragmentos del contexto FertyFit proporcionado.
   Metadatos de las fuentes disponibles:
   ${ragChunksMetadata
            .map(
              (meta, idx) =>
                `   - Fragmento ${idx + 1}: Documento ID "${meta.document_id || 'N/A'}" | Título: "${meta.document_title || 'Sin título'
                }" | Índice del fragmento: ${meta.chunk_index}`
            )
            .join('\n')}
   
   Al final del informe, incluye una lista numerada SOLO con las fuentes de la base de conocimiento FertyFit que REALMENTE hayas usado (no incluyas \"conocimientos generales\" ni \"formularios\" como fuentes), con este formato:
   "[Número]. [Título del documento] | Documento ID: [document_id] | Fragmento: cita breve del contenido relevante usado"
   `
          : ''
        }

INSTRUCCIONES IMPORTANTES:
- Prioriza la información del contexto FertyFit, pero complementa con conocimiento médico general cuando sea necesario. Usa un tono empático, claro y educativo.
- Sé MUY CONCISO: evita repeticiones y ve directo al punto.
- Escribe TODO en español y dirigido en segunda persona ("tú").
- El informe completo NO debe exceder 1000 palabras.
- IMPORTANTE: Usa solo sintaxis Markdown estándar. No uses HTML. Formatea cada sección con los encabezados Markdown correspondientes (# y ##).

A continuación tienes el JSON de contexto de la paciente:
`;

    case 'DAILY':
      return `
Eres un experto en fertilidad y salud integral femenina siguiendo la metodología FertyFit.

IMPORTANTE: El informe DEBE estar formateado en Markdown válido. Usa:
- # Título para secciones principales
- ## Subtítulo para subsecciones
- - Lista para listas con viñetas
- 1. Lista para listas numeradas
- **texto** para negritas
- *texto* para cursivas

${ragSection}DATOS DE LA PACIENTE:
Recibirás un JSON con:
- Perfil básico de la usuaria (edad, ciclo).
- Historial completo de registros diarios (temperatura basal, moco cervical, síntomas, hábitos de sueño, estrés, actividad física, alimentación).

TAREA:
Construye un INFORME NARRATIVO CONCISO (máximo 1200 palabras) formateado en Markdown enfocado en el análisis de patrones temporales. El informe DEBE incluir exactamente estas secciones:

## 1. RESUMEN EJECUTIVO (máximo 150 palabras)
   - Período analizado
   - Patrones principales identificados
   - Hallazgos más relevantes sobre el ciclo y biomarcadores

## 2. ANÁLISIS DE PATRONES
   - Análisis de temperatura basal (patrones, ovulación detectada) - breve
   - Análisis de moco cervical y biomarcadores de fertilidad - breve
   - Patrones de ciclo y regularidad - breve
   - Análisis de hábitos de estilo de vida (sueño, estrés, actividad, alimentación) - solo correlaciones significativas
   - Correlaciones entre diferentes biomarcadores (solo las más relevantes)

## 3. PUNTUALIZACIÓN DE ASPECTOS DESTACADOS (máximo 200 palabras)
   - Lista numerada de los 4-5 patrones o hallazgos más relevantes
   - Enfócate en los patrones más significativos y sus implicaciones
   - Incluir tanto patrones positivos como áreas de atención

## 4. PREGUNTAS PARA EL MÉDICO (máximo 150 palabras)
   - Lista de 2-3 preguntas específicas sobre los patrones observados
   - Basadas en los hallazgos del análisis de registros
   - Formuladas de manera clara y profesional

## 5. RECOMENDACIONES PRÁCTICAS (máximo 200 palabras)
   - Lista numerada de 3-4 recomendaciones basadas en los patrones observados
   - Específicas para mejorar el seguimiento y la interpretación de biomarcadores
   - Concretas y accionables

## 6. Bibliografía consultada
   ${ragContext && ragChunksMetadata && ragChunksMetadata.length > 0
          ? `
   DEBES utilizar información de los ${ragChunksCount} fragmentos del contexto FertyFit proporcionado.
   Metadatos de las fuentes disponibles:
   ${ragChunksMetadata
            .map(
              (meta, idx) =>
                `   - Fragmento ${idx + 1}: Documento ID "${meta.document_id || 'N/A'}" | Título: "${meta.document_title || 'Sin título'
                }" | Índice del fragmento: ${meta.chunk_index}`
            )
            .join('\n')}
   
   Al final del informe, incluye una lista numerada SOLO con las fuentes de la base de conocimiento FertyFit que REALMENTE hayas usado (no incluyas "conocimientos generales" ni "formularios" como fuentes), con este formato:
   "[Número]. [Título del documento] | Documento ID: [document_id] | Fragmento: cita breve del contenido relevante usado"
   `
          : ''
        }

INSTRUCCIONES IMPORTANTES:
- Prioriza la información del contexto FertyFit, pero complementa con conocimiento médico general cuando sea necesario. Usa un tono empático, claro y educativo.
- Identifica patrones, tendencias y correlaciones en los datos de manera específica.
- Sé CONCISO: evita repeticiones y ve directo al punto.
- Escribe TODO en español y dirigido en segunda persona ("tú").
- El informe completo NO debe exceder 1200 palabras.
- IMPORTANTE: Usa solo sintaxis Markdown estándar. No uses HTML. Formatea cada sección con los encabezados Markdown correspondientes (# y ##).

A continuación tienes el JSON de contexto de la paciente:
`;

    default:
      throw new Error(`Tipo de informe desconocido: ${reportType}`);
  }
}

/**
 * Genera la query RAG según el tipo de informe
 */
export function getRAGQueryForReportType(
  reportType: ReportType,
  userAge: number
): string {
  switch (reportType) {
    case '360':
      return `contexto metodológico FertyFit para un informe integral de fertilidad de una paciente de ${userAge} años`;
    case 'BASIC':
      return `contexto metodológico FertyFit sobre los pilares Function, Food, Flora y Flow para evaluación de fertilidad`;
    case 'DAILY':
      return `contexto metodológico FertyFit para análisis de registros diarios y biomarcadores de fertilidad`;
    case 'LABS':
      return `contexto metodológico FertyFit para interpretación de analíticas de fertilidad y exámenes médicos de una paciente de ${userAge} años`;
    default:
      return `contexto metodológico FertyFit para análisis de fertilidad`;
  }
}

/**
 * Obtiene el título del informe según el tipo
 */
export function getReportTitle(reportType: ReportType): string {
  switch (reportType) {
    case '360':
      return 'Informe 360º';
    case 'BASIC':
      return 'Informe Básico';
    case 'DAILY':
      return 'Informe de Registros Diarios';
    case 'LABS':
      return 'Informe de Analíticas';
    default:
      return 'Informe';
  }
}

