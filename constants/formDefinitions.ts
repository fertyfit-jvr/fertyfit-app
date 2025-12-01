const flattenSectionQuestions = (sections) =>
  sections.flatMap((section) =>
    section.fields.map((field) => ({
      id: field.id,
      text: field.label,
      type: field.type,
      unit: field.unit,
      min: field.min,
      max: field.max,
      step: field.step,
      defaultValue: field.defaultValue,
      optional: field.optional ?? section.optional,
      control: field.control,
      recommendedValue: field.recommendedValue,
      averageValue: field.averageValue
    }))
  );

const FUNCTION_SECTIONS = [
  {
    id: 'function_panel_hormonal',
    title: 'Panel hormonal femenino (día 3)',
    fields: [
      { id: 'function_fsh', label: 'FSH', type: 'number', unit: 'mUI/mL', min: 0, max: 40, step: 0.1, control: 'slider', recommendedValue: '3-10', defaultValue: 6.5 },
      { id: 'function_lh', label: 'LH', type: 'number', unit: 'mUI/mL', min: 0, max: 40, step: 0.1, control: 'slider', recommendedValue: '2-8', defaultValue: 5 },
      { id: 'function_estradiol', label: 'Estradiol (E2)', type: 'number', unit: 'pg/mL', min: 0, max: 1000, step: 1, control: 'slider', recommendedValue: '30-100', defaultValue: 65 },
      { id: 'function_prolactina', label: 'Prolactina', type: 'number', unit: 'ng/mL', min: 0, max: 100, step: 0.1, control: 'slider', recommendedValue: '5-25', defaultValue: 15 },
      { id: 'function_tsh', label: 'TSH', type: 'number', unit: 'µUI/mL', min: 0, max: 10, step: 0.01, control: 'slider', recommendedValue: '0.5-2.5', defaultValue: 1.5 },
      { id: 'function_t4', label: 'T4 libre', type: 'number', unit: 'ng/dL', min: 0, max: 5, step: 0.01, control: 'slider', recommendedValue: '0.8-1.8', defaultValue: 1.3 },
      { id: 'function_cycle_day', label: 'Día del ciclo', type: 'number', unit: 'día', min: 1, max: 40, step: 1, defaultValue: 3, control: 'stepper' }
    ]
  },
  {
    id: 'function_panel_metabolico',
    title: 'Panel metabólico + analítica general',
    fields: [
      { id: 'function_glucosa', label: 'Glucosa', type: 'number', unit: 'mg/dL', min: 40, max: 300, step: 1, control: 'slider', recommendedValue: '70-100', defaultValue: 85 },
      { id: 'function_insulina', label: 'Insulina', type: 'number', unit: 'µUI/mL', min: 0, max: 100, step: 0.5, control: 'slider', recommendedValue: '2-25', defaultValue: 13.5 },
      { id: 'function_hemograma', label: 'Hemograma completo', type: 'text', optional: true },
      { id: 'function_ferritina', label: 'Ferritina', type: 'number', unit: 'ng/mL', min: 1, max: 500, step: 1, control: 'slider', recommendedValue: '40-150', defaultValue: 95 },
      { id: 'function_hierro', label: 'Hierro', type: 'number', unit: 'µg/dL', min: 0, max: 300, step: 1, control: 'slider', recommendedValue: '50-170', defaultValue: 110 },
      { id: 'function_transferrina', label: 'Transferrina', type: 'number', unit: 'mg/dL', min: 0, max: 600, step: 1, optional: true },
      { id: 'function_saturacion', label: 'Sat. transferrina', type: 'number', unit: '%', min: 0, max: 100, step: 1, control: 'slider', recommendedValue: '20-50', defaultValue: 35 },
      { id: 'function_pcr', label: 'PCR-us', type: 'number', unit: 'mg/L', min: 0, max: 20, step: 0.1, control: 'slider', recommendedValue: '<1', defaultValue: 0.5 },
      { id: 'function_colesterol', label: 'Colesterol total', type: 'number', unit: 'mg/dL', min: 0, max: 400, step: 1, control: 'slider', recommendedValue: '<200', defaultValue: 150 },
      { id: 'function_trigliceridos', label: 'Triglicéridos', type: 'number', unit: 'mg/dL', min: 0, max: 500, step: 1, control: 'slider', recommendedValue: '<150', defaultValue: 100 }
    ]
  },
  {
    id: 'function_vitamina_d',
    title: 'Vitamina D (25-OH)',
    optional: true,
    fields: [{ id: 'function_vitamina_d_valor', label: 'Vitamina D 25-OH', type: 'number', unit: 'ng/mL', min: 1, max: 150, step: 1, control: 'slider', recommendedValue: '30-60', defaultValue: 45 }]
  },
  {
    id: 'function_ecografia',
    title: 'Ecografía transvaginal + AFC',
    optional: true,
    fields: [
      { id: 'function_afc_total', label: 'AFC total', type: 'number', unit: 'folículos', min: 0, max: 50, step: 1, control: 'stepper', optional: true },
      { id: 'function_afc_derecho', label: 'AFC derecho', type: 'number', unit: 'folículos', min: 0, max: 50, step: 1, control: 'stepper', optional: true },
      { id: 'function_afc_izquierdo', label: 'AFC izquierdo', type: 'number', unit: 'folículos', min: 0, max: 50, step: 1, control: 'stepper', optional: true },
      { id: 'function_endometrio', label: 'Grosor endometrial', type: 'number', unit: 'mm', min: 1, max: 20, step: 0.1, control: 'slider', optional: true },
      { id: 'function_patron', label: 'Patrón endometrial', type: 'text', optional: true }
    ]
  },
  {
    id: 'function_hsg',
    title: 'Histerosalpingografía (HSG)',
    optional: true,
    fields: [
      { id: 'function_hsg_derecha', label: 'Permeabilidad derecha', type: 'buttons', options: ['Sí', 'No'], optional: true },
      { id: 'function_hsg_izquierda', label: 'Permeabilidad izquierda', type: 'buttons', options: ['Sí', 'No'], optional: true },
      { id: 'function_hsg_contorno', label: 'Contorno uterino', type: 'text', optional: true },
      { id: 'function_hsg_defectos', label: 'Defectos', type: 'text', optional: true },
      { id: 'function_hsg_observaciones', label: 'Observaciones', type: 'text', optional: true }
    ]
  },
  {
    id: 'function_espermio',
    title: 'Espermiograma básico',
    optional: true,
    fields: [
      { id: 'function_espermio_volumen', label: 'Volumen', type: 'number', unit: 'mL', min: 0, max: 10, step: 0.1, control: 'stepper', recommendedValue: '1.5-5', defaultValue: 3.25 },
      { id: 'function_espermio_concentracion', label: 'Concentración', type: 'number', unit: 'millones/mL', min: 0, max: 300, step: 1, control: 'slider', recommendedValue: '15-200', defaultValue: 107.5 },
      { id: 'function_espermio_mov_total', label: 'Movilidad total', type: 'number', unit: '%', min: 0, max: 100, step: 1, control: 'slider', recommendedValue: '>40', defaultValue: 50 },
      { id: 'function_espermio_mov_prog', label: 'Movilidad progresiva', type: 'number', unit: '%', min: 0, max: 100, step: 1, control: 'slider', recommendedValue: '>32', defaultValue: 40 },
      { id: 'function_espermio_morfologia', label: 'Morfología', type: 'number', unit: '%', min: 0, max: 100, step: 1, control: 'slider', recommendedValue: '>4', defaultValue: 6 },
      { id: 'function_espermio_vitalidad', label: 'Vitalidad', type: 'number', unit: '%', min: 0, max: 100, step: 1, control: 'slider', recommendedValue: '>58', defaultValue: 65 }
    ]
  }
];

const FOOD_QUESTIONS = [
  { id: 'food_proteina', text: 'Proteína diaria (g)', type: 'number', min: 0, max: 200, step: 5, unit: 'g', control: 'slider', defaultValue: 80 },
  { id: 'food_fibra', text: 'Fibra total diaria (g)', type: 'number', min: 0, max: 80, step: 5, unit: 'g', control: 'slider', defaultValue: 30 },
  { id: 'food_diversidad', text: 'Diversidad vegetal semanal', type: 'segmented', min: 0, max: 7, defaultValue: 4 },
  { id: 'food_ultraprocesados', text: 'Consumo de ultraprocesados', type: 'buttons', options: ['Nunca', '1-2', '3-4', '5+ veces'], defaultValue: 'Nunca' },
  { id: 'food_omega', text: 'Omega-3 en dieta', type: 'buttons', options: ['Bajo', 'Moderado', 'Alto'], defaultValue: 'Moderado' },
  { id: 'food_horarios', text: 'Horarios de comida', type: 'buttons', options: ['Regulares', 'Irregulares'], defaultValue: 'Regulares' },
  { id: 'food_digestivo', text: 'Sintomatología digestiva', type: 'textarea', optional: true },
  { id: 'food_bristol', text: 'Escala de Bristol', type: 'segmented', min: 1, max: 7, defaultValue: 4 },
  { id: 'food_entrenamiento', text: 'Entrenamiento semanal', type: 'buttons', options: ['0', '1-2', '3-4', '5+'], defaultValue: '3-4' },
  { id: 'food_cintura', text: 'Perímetro cintura (cm)', type: 'number', min: 50, max: 140, step: 1, unit: 'cm', control: 'slider', defaultValue: 75 },
  { id: 'food_alcohol', text: '¿Consumo de alcohol?', type: 'buttons', options: ['No', 'Ocasional', 'Frecuente'], defaultValue: 'No' },
  { id: 'food_supplements', text: '¿Tomas suplementos actualmente?', type: 'yesno', defaultValue: 'No' }
];

const FLORA_QUESTIONS = [
  { id: 'flora_antibioticos', text: 'Antibióticos últimos 12 meses', type: 'buttons', options: ['No', '1 vez', '2+ veces'], defaultValue: 'No' },
  { id: 'flora_infecciones', text: 'Infecciones vaginales repetidas', type: 'yesno', defaultValue: 'No' },
  { id: 'flora_ph', text: 'pH vaginal alterado', type: 'yesno', defaultValue: 'No' },
  { id: 'flora_probio', text: 'Probióticos previos', type: 'yesno', defaultValue: 'No' },
  { id: 'flora_parto', text: 'Parto/lactancia', type: 'buttons', options: ['No', 'Sí'], defaultValue: 'No' },
  { id: 'flora_bristol', text: 'Heces Bristol', type: 'segmented', min: 1, max: 7, defaultValue: 4 },
  { id: 'flora_pruebas', text: 'Pruebas microbioma realizadas', type: 'buttons', options: ['Ninguna', 'Test vaginal', 'Test intestinal', 'Ambas', 'Otra'], defaultValue: 'Ninguna' },
  { id: 'flora_suplementos', text: 'Suplementos recomendados/uso', type: 'buttons', options: ['Ninguno', 'Probióticos', 'Prebióticos', 'Probióticos + Prebióticos', 'Otro'], defaultValue: 'Ninguno' }
];

const FLOW_QUESTIONS = [
  { id: 'flow_stress_level', text: 'Nivel de estrés:', type: 'segmented', min: 1, max: 5, defaultValue: 3 },
  { id: 'flow_sleep_hours_avg', text: 'Horas de sueño promedio:', type: 'slider', min: 0, max: 12, step: 0.5, unit: 'h', defaultValue: 7 },
  { id: 'flow_smoker', text: '¿Fumas?', type: 'buttons', options: ['No', 'Sí, ocasional', 'Sí, diario'], defaultValue: 'No' },
  { id: 'flow_carga_mental', text: 'Sobrecarga mental (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 2 },
  { id: 'flow_rumiacion', text: 'Rumiación mental (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 1 },
  { id: 'flow_ansiedad', text: 'Ansiedad física', type: 'yesno', defaultValue: 'No' },
  { id: 'flow_alerta', text: 'Sensación de alerta continua (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 1 },
  { id: 'flow_regulacion', text: 'Herramientas de regulación emocional', type: 'yesno', defaultValue: 'Sí' },
  { id: 'flow_presion_social', text: 'Presión social/familiar (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 2 },
  { id: 'flow_soporte', text: 'Soporte emocional real', type: 'yesno', defaultValue: 'Sí' },
  { id: 'flow_soledad', text: 'Sensación de soledad (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 1 },
  { id: 'flow_conflictos', text: 'Conflictos frecuentes', type: 'yesno', defaultValue: 'No' },
  { id: 'flow_sueno_calidad', text: 'Calidad del sueño (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 3 },
  { id: 'flow_despertares', text: 'Despertares nocturnos', type: 'buttons', options: ['0', '1', '2+'], defaultValue: '0' },
  { id: 'flow_pantallas', text: 'Uso de pantallas nocturno (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 1 },
  { id: 'flow_snacks', text: 'Snacks fuera de horario', type: 'buttons', options: ['Nunca', 'Pocas veces', 'Muchas veces'], defaultValue: 'Pocas veces' },
  { id: 'flow_siesta', text: 'Siesta', type: 'buttons', options: ['No', 'Sí <20m', 'Sí >20m'], defaultValue: 'No' },
  { id: 'flow_energia_manana', text: 'Energía por la mañana (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 3 },
  { id: 'flow_energia_tarde', text: 'Energía por la tarde (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 2 },
  { id: 'flow_cafe', text: 'Tazas de café al día', type: 'segmented', min: 0, max: 6, defaultValue: 1 },
  { id: 'flow_libido', text: 'Libido (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 3 },
  { id: 'flow_conexion', text: 'Conexión emocional con la pareja (0-4)', type: 'segmented', min: 0, max: 4, defaultValue: 3 },
  { id: 'flow_dolor', text: 'Dolor o sequedad en relaciones', type: 'yesno', defaultValue: 'No' },
  { id: 'flow_ansiedad_relaciones', text: 'Ansiedad ligada a fertilidad en relaciones', type: 'yesno', defaultValue: 'No' }
];

export const FORM_DEFINITIONS = {
  F0: {
    title: 'F0: Ficha Personal Inicial',
    description:
      'Esta información es la base de tu protocolo personalizado. Tus datos de ciclo son vitales para calcular tus predicciones de fertilidad.',
    questions: [
      { id: 'q1_birthdate', text: 'Tu fecha de nacimiento:', type: 'date' },
      { id: 'q2_height', text: 'Altura:', type: 'slider', min: 140, max: 200, unit: 'cm' },
      { id: 'q2_weight', text: 'Peso:', type: 'slider', min: 40, max: 150, unit: 'kg' },
      { id: 'q6_cycle', text: 'Duración ciclo promedio:', type: 'stepper', min: 21, max: 40, unit: 'días' },
      { id: 'q7_regularity', text: '¿Ciclos regulares?', type: 'buttons', options: ['Regulares', 'Irregulares'] },
      { id: 'q3_time_trying', text: 'Tiempo buscando embarazo:', type: 'stepper', min: 0, max: 60, unit: 'meses' },
      { id: 'q4_objective', text: 'Objetivo principal:', type: 'buttons', options: ['Concepción natural', 'Reproducción Asistida'] },
      { id: 'q5_partner', text: '¿Buscas en pareja o solitario?', type: 'buttons', options: ['Pareja', 'Solitario'] },
      { id: 'q20_fertility_treatments', text: 'Tratamientos de fertilidad previos:', type: 'buttons', options: ['Ninguno', 'FIV', 'Inseminación', 'Ovodonación'] },
      { id: 'q9_diagnoses', text: 'Diagnósticos / Breve Historia Médica:', type: 'textarea', optional: true },
      { id: 'q21_family_history', text: 'Antecedentes familiares relevantes:', type: 'textarea', optional: true }
    ]
  },
  FUNCTION: {
    title: 'Exámenes clínicos imprescindibles',
    description: 'Registra los resultados de tus pruebas médicas para calibrar tu FunctionScore.',
    sections: FUNCTION_SECTIONS,
    questions: flattenSectionQuestions(FUNCTION_SECTIONS)
  },
  FOOD: {
    title: 'Nutrición y hábitos',
    description: 'Hábitos alimentarios, síntomas digestivos y estilo de vida.',
    questions: FOOD_QUESTIONS
  },
  FLORA: {
    title: 'Microbiota e historial',
    description: 'Historial de antibióticos, infecciones y pruebas de microbiota.',
    questions: FLORA_QUESTIONS
  },
  FLOW: {
    title: 'Ritmos y psico-emocional',
    description: 'Estrés, sueño, ritmos circadianos y conexión emocional.',
    questions: FLOW_QUESTIONS
  }
};
