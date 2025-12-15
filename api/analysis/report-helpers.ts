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
        // Exámenes tienen exam_type en answers
        return f.answers?.some((a: any) => a.questionId === 'exam_type');
      });

      const context: ReportContext = {
        perfil: baseProfile,
        registros_diarios: logs,
        formularios: [...f0Forms, ...pillarForms, ...examForms],
        fecha_informe: new Date().toISOString(),
      };

      // Si hay informes previos, incluir los últimos 3
      if (previousReports && previousReports.length > 0) {
        context.informes_previos = previousReports
          .slice(0, 3)
          .map(r => ({
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
  const ragSection = ragContext ? `
IMPORTANTE: Solo puedes usar la información del siguiente contexto, que proviene de la metodología FertyFit.
NO uses conocimiento general que no esté en este contexto.
PRIORIZA SIEMPRE el contexto metodológico FertyFit sobre cualquier conocimiento general.
Si la información no está en este contexto, dilo explícitamente.

CONTEXTO METODOLÓGICO FERTYFIT (${ragChunksCount} fragmentos de documentación - fuente autorizada):
${ragContext}

` : '';

  switch (reportType) {
    case '360':
      return `
Eres un experto en fertilidad y salud integral femenina siguiendo la metodología FertyFit.

${ragSection}DATOS DE LA PACIENTE:
Recibirás un JSON con:
- Perfil completo de la usuaria.
- Historial completo de registros diarios (temperatura, moco, sueño, estrés, hábitos).
- Formulario F0 y todos los formularios de pilares (Function, Food, Flora, Flow).
- Todos los exámenes médicos guardados (analíticas y ecografías).
${hasPreviousReports ? '- Informes previos generados anteriormente (para contexto histórico).' : ''}

TAREA:
Construye un INFORME NARRATIVO COMPLETO pero CONCISO (máximo 2000 palabras). El informe DEBE incluir exactamente estas secciones en este orden:

1. RESUMEN EJECUTIVO (máximo 200 palabras)
   - Síntesis de los hallazgos más relevantes
   - Estado general de salud reproductiva
   - Principales áreas de atención

2. ANÁLISIS INTEGRAL
   - Perfil general y contexto (breve)
   - Análisis de exámenes y datos médicos relevantes (solo lo más importante)
   - Análisis de pilares (Function, Food, Flora, Flow) - resumen por pilar
   - Patrones y tendencias en registros diarios (solo patrones significativos)
   ${hasPreviousReports ? '- Evolución desde informes anteriores (solo cambios significativos)' : ''}

3. PUNTUALIZACIÓN DE ASPECTOS DESTACADOS (máximo 300 palabras)
   - Lista numerada de los 5-7 aspectos más relevantes encontrados
   - Cada aspecto debe ser claro, específico y accionable
   - Incluir tanto fortalezas como áreas de mejora

4. PREGUNTAS PARA EL MÉDICO (máximo 200 palabras)
   - Lista de 3-5 preguntas específicas que la usuaria debería plantear a su médico
   - Basadas en los hallazgos del análisis
   - Formuladas de manera clara y profesional

5. RECOMENDACIONES PRÁCTICAS (máximo 300 palabras)
   - Lista numerada de 5-7 recomendaciones concretas y accionables
   - Priorizadas por impacto en la salud reproductiva
   - Específicas y medibles cuando sea posible

6. BIBLIOGRAFÍA CONSULTADA
   ${ragContext && ragChunksMetadata && ragChunksMetadata.length > 0 ? `
   DEBES incluir referencias exactas de los ${ragChunksCount} fragmentos utilizados del contexto FertyFit.
   Metadatos de las fuentes consultadas:
   ${ragChunksMetadata.map((meta, idx) => 
     `   - Fragmento ${idx + 1}: Documento ID "${meta.document_id || 'N/A'}" | Título: "${meta.document_title || 'Sin título'}" | Índice del fragmento: ${meta.chunk_index}`
   ).join('\n')}
   
   Formato para cada referencia:
   "[Número]. [Título del documento] | Documento ID: [document_id] | Fragmento: [cita breve del contenido relevante usado]"
   ` : '- Si no hay contexto FertyFit, indica claramente: "No se utilizó bibliografía específica de FertyFit en este informe."'}

INSTRUCCIONES IMPORTANTES:
- ${ragContext ? 'SOLO usa información del contexto FertyFit proporcionado. ' : ''}Usa un tono empático, claro y no alarmista.
- No inventes diagnósticos médicos; describe riesgos y patrones como "sugiere", "podría indicar".
- Escribe TODO en español y dirigido en segunda persona ("tú").
- Sé CONCISO: evita repeticiones y ve directo al punto.
- El informe completo NO debe exceder 2000 palabras.

A continuación tienes el JSON de contexto de la paciente:
`;

    case 'BASIC':
      return `
Eres un experto en fertilidad y salud integral femenina siguiendo la metodología FertyFit.

${ragSection}DATOS DE LA PACIENTE:
Recibirás un JSON con:
- Perfil básico de la usuaria.
- Formulario F0 (formulario inicial).
- Formularios de pilares (Function, Food, Flora, Flow).

TAREA:
Construye un INFORME NARRATIVO CONCISO (máximo 1500 palabras) enfocado en los pilares FertyFit. El informe DEBE incluir exactamente estas secciones:

1. RESUMEN EJECUTIVO (máximo 150 palabras)
   - Síntesis del estado de los 4 pilares
   - Fortalezas principales identificadas
   - Áreas de mejora prioritarias

2. ANÁLISIS POR PILAR
   - Pilar Function (funcionalidad reproductiva) - análisis breve
   - Pilar Food (nutrición pro-fértil) - análisis breve
   - Pilar Flora (microbiota y salud digestiva) - análisis breve
   - Pilar Flow (estilo de vida y bienestar) - análisis breve
   - Explica cómo cada pilar impacta la fertilidad de manera específica

3. PUNTUALIZACIÓN DE ASPECTOS DESTACADOS (máximo 250 palabras)
   - Lista numerada de los 4-5 aspectos más relevantes por pilar
   - Enfócate en los hallazgos más significativos
   - Incluir tanto fortalezas como áreas de mejora

4. PREGUNTAS PARA EL MÉDICO (máximo 150 palabras)
   - Lista de 2-3 preguntas específicas relacionadas con los pilares
   - Basadas en los hallazgos del análisis
   - Formuladas de manera clara y profesional

5. RECOMENDACIONES PRÁCTICAS (máximo 250 palabras)
   - Lista numerada de 4-5 recomendaciones específicas por pilar
   - Priorizadas por impacto en la fertilidad
   - Concretas y accionables

6. BIBLIOGRAFÍA CONSULTADA
   ${ragContext && ragChunksMetadata && ragChunksMetadata.length > 0 ? `
   DEBES incluir referencias exactas de los ${ragChunksCount} fragmentos utilizados del contexto FertyFit.
   Metadatos de las fuentes consultadas:
   ${ragChunksMetadata.map((meta, idx) => 
     `   - Fragmento ${idx + 1}: Documento ID "${meta.document_id || 'N/A'}" | Título: "${meta.document_title || 'Sin título'}" | Índice del fragmento: ${meta.chunk_index}`
   ).join('\n')}
   
   Formato para cada referencia:
   "[Número]. [Título del documento] | Documento ID: [document_id] | Fragmento: [cita breve del contenido relevante usado]"
   ` : '- Si no hay contexto FertyFit, indica claramente: "No se utilizó bibliografía específica de FertyFit en este informe."'}

INSTRUCCIONES IMPORTANTES:
- ${ragContext ? 'SOLO usa información del contexto FertyFit proporcionado. ' : ''}Usa un tono empático, claro y educativo.
- Sé CONCISO: evita repeticiones y ve directo al punto.
- Escribe TODO en español y dirigido en segunda persona ("tú").
- El informe completo NO debe exceder 1500 palabras.

A continuación tienes el JSON de contexto de la paciente:
`;

    case 'DAILY':
      return `
Eres un experto en fertilidad y salud integral femenina siguiendo la metodología FertyFit.

${ragSection}DATOS DE LA PACIENTE:
Recibirás un JSON con:
- Perfil básico de la usuaria (edad, ciclo).
- Historial completo de registros diarios (temperatura basal, moco cervical, síntomas, hábitos de sueño, estrés, actividad física, alimentación).

TAREA:
Construye un INFORME NARRATIVO CONCISO (máximo 1200 palabras) enfocado en el análisis de patrones temporales. El informe DEBE incluir exactamente estas secciones:

1. RESUMEN EJECUTIVO (máximo 150 palabras)
   - Período analizado
   - Patrones principales identificados
   - Hallazgos más relevantes sobre el ciclo y biomarcadores

2. ANÁLISIS DE PATRONES
   - Análisis de temperatura basal (patrones, ovulación detectada) - breve
   - Análisis de moco cervical y biomarcadores de fertilidad - breve
   - Patrones de ciclo y regularidad - breve
   - Análisis de hábitos de estilo de vida (sueño, estrés, actividad, alimentación) - solo correlaciones significativas
   - Correlaciones entre diferentes biomarcadores (solo las más relevantes)

3. PUNTUALIZACIÓN DE ASPECTOS DESTACADOS (máximo 200 palabras)
   - Lista numerada de los 4-5 patrones o hallazgos más relevantes
   - Enfócate en los patrones más significativos y sus implicaciones
   - Incluir tanto patrones positivos como áreas de atención

4. PREGUNTAS PARA EL MÉDICO (máximo 150 palabras)
   - Lista de 2-3 preguntas específicas sobre los patrones observados
   - Basadas en los hallazgos del análisis de registros
   - Formuladas de manera clara y profesional

5. RECOMENDACIONES PRÁCTICAS (máximo 200 palabras)
   - Lista numerada de 3-4 recomendaciones basadas en los patrones observados
   - Específicas para mejorar el seguimiento y la interpretación de biomarcadores
   - Concretas y accionables

6. BIBLIOGRAFÍA CONSULTADA
   ${ragContext && ragChunksMetadata && ragChunksMetadata.length > 0 ? `
   DEBES incluir referencias exactas de los ${ragChunksCount} fragmentos utilizados del contexto FertyFit.
   Metadatos de las fuentes consultadas:
   ${ragChunksMetadata.map((meta, idx) => 
     `   - Fragmento ${idx + 1}: Documento ID "${meta.document_id || 'N/A'}" | Título: "${meta.document_title || 'Sin título'}" | Índice del fragmento: ${meta.chunk_index}`
   ).join('\n')}
   
   Formato para cada referencia:
   "[Número]. [Título del documento] | Documento ID: [document_id] | Fragmento: [cita breve del contenido relevante usado]"
   ` : '- Si no hay contexto FertyFit, indica claramente: "No se utilizó bibliografía específica de FertyFit en este informe."'}

INSTRUCCIONES IMPORTANTES:
- ${ragContext ? 'SOLO usa información del contexto FertyFit proporcionado. ' : ''}Usa un tono empático, claro y educativo.
- Identifica patrones, tendencias y correlaciones en los datos de manera específica.
- Sé CONCISO: evita repeticiones y ve directo al punto.
- Escribe TODO en español y dirigido en segunda persona ("tú").
- El informe completo NO debe exceder 1200 palabras.

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

