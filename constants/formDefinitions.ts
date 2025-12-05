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
      {
        id: 'function_hemograma',
        label: 'Hemograma completo',
        type: 'buttons',
        options: ['Normal', 'Alterado', 'No lo sé'],
        defaultValue: 'Normal',
        optional: true
      },
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
      {
        id: 'function_patron',
        label: 'Patrón endometrial (0-20 mm)',
        type: 'number',
        unit: 'mm',
        min: 0,
        max: 20,
        step: 0.1,
        control: 'slider',
        optional: true
      }
    ]
  },
  {
    id: 'function_hsg',
    title: 'Histerosalpingografía (HSG)',
    optional: true,
    fields: [
      { id: 'function_hsg_derecha', label: 'Permeabilidad derecha', type: 'buttons', options: ['Sí', 'No'], optional: true },
      { id: 'function_hsg_izquierda', label: 'Permeabilidad izquierda', type: 'buttons', options: ['Sí', 'No'], optional: true },
      {
        id: 'function_hsg_contorno',
        label: 'Contorno uterino',
        type: 'buttons',
        options: ['Normal', 'Arcuato', 'Septado', 'Bicorne', 'Otro', 'No lo sé'],
        defaultValue: 'Normal',
        optional: true
      },
      {
        id: 'function_hsg_defectos',
        label: 'Defectos',
        type: 'buttons',
        options: ['Ninguno', 'Pólipo', 'Mioma', 'Sinequias', 'Otro'],
        defaultValue: 'Ninguno',
        optional: true
      },
      {
        id: 'function_hsg_observaciones',
        label: 'Observaciones',
        type: 'buttons',
        options: ['Sin hallazgos relevantes', 'Hallazgos leves', 'Hallazgos significativos', 'Otro'],
        defaultValue: 'Sin hallazgos relevantes',
        optional: true
      }
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

export { FUNCTION_SECTIONS };

const FOOD_QUESTIONS = [
  // 1. Patrón de alimentación semanal
  {
    id: 'food_patron',
    text: '¿Cuál describe mejor tu patrón de alimentación semanal?',
    type: 'buttons',
    options: [
      'a) Consumo frecuente de comida rápida, ultraprocesados.',
      'b) Una mezcla de comida casera y procesados.',
      'c) Mayor parte comida real/casera, con consumo ocasional.',
      'd) Alimentos frescos, integrales y sin procesar, estilo mediterráneo.'
    ],
    defaultValue: 'b) Una mezcla de comida casera y procesados.'
  },
  
  // 2. Pescado azul rico en Omega-3 (conteo semanal)
  {
    id: 'food_pescado',
    text: '¿Con qué frecuencia consumes pescado azul rico en Omega-3?',
    type: 'stepper',
    min: 0,
    max: 7,
    unit: 'veces/semana',
    defaultValue: 1
  },
  
  // 3. Raciones de vegetales y hortalizas (conteo diario)
  {
    id: 'food_vege',
    text: '¿Cuántas raciones de vegetales y hortalizas consumes al día?',
    type: 'stepper',
    min: 0,
    max: 10,
    unit: 'raciones',
    defaultValue: 2
  },
  
  // 4. Tipo de grasas en cocina
  {
    id: 'food_grasas',
    text: '¿Qué tipo de grasas predominan en tu cocina?',
    type: 'buttons',
    options: [
      'a) Mantequilla, margarina, aceites refinados.',
      'b) Una mezcla.',
      'c) Principalmente aceite de oliva.',
      'd) Casi exclusivamente aceite de oliva virgen extra (AOVE).'
    ],
    defaultValue: 'b) Una mezcla.'
  },
  
  // 5. Suplementos clave para fertilidad
  {
    id: 'food_suppl',
    text: '¿Tomas suplementos clave para la fertilidad?',
    type: 'buttons',
    options: [
      'a) No tomo ningún suplemento.',
      'b) Tomo solo ácido fólico sintético.',
      'c) Tomo un multivitamínico prenatal general.',
      'd) Protocolo personalizado (folato activo, D, Omega-3, CoQ10).'
    ],
    defaultValue: 'a) No tomo ningún suplemento.'
  },
  
  // 6. Bebidas azucaradas/refrescos (conteo semanal)
  {
    id: 'food_azucar',
    text: '¿Con qué frecuencia consumes bebidas azucaradas/refrescos?',
    type: 'stepper',
    min: 0,
    max: 7,
    unit: 'veces/semana',
    defaultValue: 2
  },
  
  // 7. Fuentes de antioxidantes
  {
    id: 'food_antiox',
    text: '¿Incluyes fuentes de antioxidantes de forma regular?',
    type: 'buttons',
    options: [
      'a) Raramente.',
      'b) Algunas veces por semana.',
      'c) Casi todos los días.',
      'd) Diariamente, de forma consciente y variada.'
    ],
    defaultValue: 'b) Algunas veces por semana.'
  },
  
  // 8. Principal fuente de carbohidratos
  {
    id: 'food_carbos',
    text: '¿Cuál es tu principal fuente de carbohidratos?',
    type: 'buttons',
    options: [
      'a) Pan blanco, pasta blanca, bollería y arroz blanco.',
      'b) Una mezcla de integrales y refinados.',
      'c) Principalmente integrales.',
      'd) Carbohidratos complejos de bajo índice glucémico.'
    ],
    defaultValue: 'b) Una mezcla de integrales y refinados.'
  }
];

const FLORA_QUESTIONS = [
  // 1. Salud digestiva general (slider 0-10)
  {
    id: 'flora_dig',
    text: '¿Cómo describirías tu salud digestiva general?',
    type: 'segmented',
    min: 0,
    max: 10,
    defaultValue: 5
  },
  
  // 2. Salud vaginal
  {
    id: 'flora_vag',
    text: '¿Cómo es tu salud vaginal en general?',
    type: 'buttons',
    options: [
      'a) Síntomas o infecciones recurrentes.',
      'b) Episodios 1-2 veces al año.',
      'c) Muy ocasionalmente molestias leves.',
      'd) Excelente, sin ninguno de estos síntomas.'
    ],
    defaultValue: 'c) Muy ocasionalmente molestias leves.'
  },
  
  // 3. Antibióticos último año
  {
    id: 'flora_atb',
    text: '¿Has tomado antibióticos en el último año?',
    type: 'buttons',
    options: [
      'a) Sí, múltiples ciclos/tratamiento largo.',
      'b) Sí, un ciclo de tratamiento.',
      'c) No, pero sí en los últimos 2-3 años.',
      'd) No, no he tomado antibióticos en los últimos años.'
    ],
    defaultValue: 'd) No, no he tomado antibióticos en los últimos años.'
  },
  
  // 4. Alimentos fermentados (conteo diario/semanal)
  {
    id: 'flora_ferm',
    text: '¿Incluyes alimentos fermentados (kéfir, yogur, chucrut) en tu dieta?',
    type: 'stepper',
    min: 0,
    max: 30,
    unit: 'veces/mes',
    defaultValue: 4
  },
  
  // 5. Intolerancias alimentarias
  {
    id: 'flora_intol',
    text: '¿Sufres de intolerancias o sensibilidades alimentarias?',
    type: 'buttons',
    options: [
      'a) Sí, a múltiples alimentos.',
      'b) Sí, a un alimento en particular.',
      'c) Sospecho que algo no me sienta bien.',
      'd) No, no tengo ninguna intolerancia o sensibilidad conocida.'
    ],
    defaultValue: 'd) No, no tengo ninguna intolerancia o sensibilidad conocida.'
  }
];

const FLOW_QUESTIONS = [
  // 1. Nivel de estrés percibido (slider 0-10)
  {
    id: 'flow_stress',
    text: '¿Cómo calificarías tu nivel de estrés percibido en el día a día?',
    type: 'segmented',
    min: 0,
    max: 10,
    defaultValue: 5
  },
  
  // 2. Horas de sueño de calidad (slider, se mapea a puntos 1-10)
  {
    id: 'flow_sueno',
    text: '¿Cuántas horas de sueño de calidad tienes por noche de media?',
    type: 'slider',
    min: 4,
    max: 10,
    step: 0.5,
    unit: 'horas',
    defaultValue: 7
  },
  
  // 3. Técnicas de relajación (conteo semanal)
  {
    id: 'flow_relax',
    text: '¿Practicas alguna técnica de relajación de forma regular?',
    type: 'stepper',
    min: 0,
    max: 7,
    unit: 'veces/semana',
    defaultValue: 2
  },
  
  // 4. Tipo y frecuencia de ejercicio
  {
    id: 'flow_ejer',
    text: '¿Qué tipo de ejercicio realizas y con qué frecuencia?',
    type: 'buttons',
    options: [
      'a) No hago o hago ejercicio de muy alta intensidad.',
      'b) Hago ejercicio de forma irregular.',
      'c) Realizo ejercicio moderado 2-3 veces por semana.',
      'd) Combino moderado con prácticas restaurativas.'
    ],
    defaultValue: 'b) Hago ejercicio de forma irregular.'
  },
  
  // 5. Exposición a luz solar matutina
  {
    id: 'flow_solar',
    text: '¿Te expones a la luz solar natural por la mañana?',
    type: 'buttons',
    options: [
      'a) No, casi nunca salgo de casa u oficina.',
      'b) A veces, durante el fin de semana.',
      'c) La mayoría de los días, pero por poco tiempo.',
      'd) Sí, intento estar al aire libre al menos 15-20 minutos cada mañana.'
    ],
    defaultValue: 'b) A veces, durante el fin de semana.'
  },
  
  // 6. Medidas para reducir disruptores endocrinos
  {
    id: 'flow_tox',
    text: '¿Has tomado medidas para reducir la exposición a disruptores endocrinos?',
    type: 'buttons',
    options: [
      'a) No, no he hecho ningún cambio.',
      'b) He hecho algunos cambios pequeños.',
      'c) He cambiado varios productos en la cocina y el baño.',
      'd) He realizado una auditoría completa.'
    ],
    defaultValue: 'a) No, no he hecho ningún cambio.'
  },
  
  // 7. Rutina antes de dormir
  {
    id: 'flow_noche',
    text: '¿Cómo es tu rutina antes de dormir?',
    type: 'buttons',
    options: [
      'a) Uso el móvil o veo pantallas hasta el último minuto.',
      'b) Intento apagar las pantallas un poco antes.',
      'c) Tengo una rutina de relajación.',
      'd) Apago las pantallas al menos 1 hora antes y realizo otra actividad.'
    ],
    defaultValue: 'b) Intento apagar las pantallas un poco antes.'
  },
  
  // 8. Estado emocional respecto a búsqueda de embarazo (slider 1-10)
  {
    id: 'flow_emocion',
    text: '¿Cómo te sientes emocionalmente respecto a la búsqueda de embarazo?',
    type: 'segmented',
    min: 1,
    max: 10,
    defaultValue: 5
  }
];

export const FORM_DEFINITIONS = {
  F0: {
    title: 'F0: Ficha Personal Inicial',
    description:
      'Esta información es la base de tu protocolo personalizado.',
    questions: [
      { id: 'q1_birthdate', text: 'Tu fecha de nacimiento:', type: 'date' },
      { id: 'q2_height', text: 'Altura:', type: 'slider', min: 140, max: 200, unit: 'cm' },
      { id: 'q2_weight', text: 'Peso:', type: 'slider', min: 40, max: 150, unit: 'kg' },
      { id: 'q3_time_trying', text: 'Tiempo buscando embarazo:', type: 'stepper', min: 0, max: 60, unit: 'meses' },
      { id: 'q4_objective', text: 'Objetivo principal:', type: 'buttons', options: ['Concepción natural', 'Reproducción Asistida'] },
      { id: 'q5_partner', text: '¿Buscas en pareja o solitario?', type: 'buttons', options: ['Pareja', 'Solitario'] },
      { id: 'q20_fertility_treatments', text: 'Tratamientos de fertilidad previos:', type: 'buttons', options: ['Ninguno', 'FIV', 'Inseminación', 'Ovodonación'] },
      { id: 'q9_diagnoses', text: 'Diagnósticos / Breve Historia Médica:', type: 'textarea', optional: true },
      { id: 'q21_family_history', text: 'Antecedentes familiares relevantes:', type: 'textarea', optional: true }
    ]
  },
  FUNCTION: {
    title: 'Function: Salud Reproductiva',
    description: 'Información sobre tu ciclo menstrual y salud reproductiva.',
    questions: [
      { 
        id: 'function_cycle_length', 
        text: 'Duración ciclo promedio:', 
        type: 'stepper', 
        min: 21, 
        max: 40, 
        unit: 'días',
        defaultValue: 28
      },
      { 
        id: 'function_cycle_regularity', 
        text: '¿Ciclos regulares?', 
        type: 'buttons', 
        options: ['Regulares', 'Irregulares'],
        defaultValue: 'Regulares'
      },
      { 
        id: 'function_regularity_detail', 
        text: 'Regularidad de tus ciclos:', 
        type: 'buttons', 
        options: [
          'Muy irregulares / Amenorrea',
          'Algo irregulares (varían >7 días)',
          'Bastante regulares (varían 3-7 días)',
          'Muy regulares (26-32 días, varían 1-2 días)'
        ],
        defaultValue: 'Bastante regulares (varían 3-7 días)'
      },
      { 
        id: 'function_luteal_phase', 
        text: 'Duración fase lútea (días entre ovulación y regla):', 
        type: 'slider', 
        min: 6, 
        max: 14, 
        step: 1,
        unit: 'días',
        defaultValue: 12,
        optional: true
      },
      { 
        id: 'function_fertile_mucus', 
        text: '¿Identificas moco cervical fértil (clara de huevo)?', 
        type: 'buttons', 
        options: [
          'Nunca o casi nunca',
          'A veces, pero es escaso',
          'Sí, durante 1-2 días',
          'Sí, claramente durante 3+ días'
        ],
        defaultValue: 'A veces, pero es escaso'
      },
      { 
        id: 'function_pms_severity', 
        text: 'Síndrome Premenstrual (SPM):', 
        type: 'segmented', 
        min: 1, 
        max: 10,
        defaultValue: 5
      },
      { 
        id: 'function_fertility_diagnosis', 
        text: '¿Diagnóstico que afecta tu fertilidad?', 
        type: 'buttons', 
        options: [
          'Sí: endometriosis severa, baja reserva severa, FOP',
          'Sí: SOP o endometriosis moderada',
          'Sí: hipotiroidismo subclínico o endometriosis leve',
          'No, no tengo ningún diagnóstico'
        ],
        defaultValue: 'No, no tengo ningún diagnóstico'
      },
      { 
        id: 'function_tsh_last', 
        text: 'TSH en última analítica:', 
        type: 'buttons', 
        options: [
          'No me he hecho una analítica reciente',
          'Por encima de 4.0 mUI/L',
          'Entre 2.5 y 4.0 mUI/L',
          'Por debajo de 2.5 mUI/L (óptimo)'
        ],
        defaultValue: 'No me he hecho una analítica reciente'
      },
      { 
        id: 'function_ovulation_tracking', 
        text: '¿Utilizas métodos para confirmar ovulación?', 
        type: 'buttons', 
        options: [
          'No, no utilizo ningún método',
          'Lo intento a veces, pero no consistente',
          'Sí, tests LH o temperatura ocasional',
          'Sí, temperatura basal diaria y/o tests LH cada ciclo'
        ],
        defaultValue: 'No, no utilizo ningún método'
      },
      { 
        id: 'function_menstrual_bleeding', 
        text: '¿Tu sangrado menstrual es saludable?', 
        type: 'buttons', 
        options: [
          'Muy abundante o muy escaso',
          'Coágulos o color muy oscuro/marrón',
          'Moderado, con algo de spotting',
          'Flujo moderado (3-5 días) sin spotting ni coágulos grandes'
        ],
        defaultValue: 'Moderado, con algo de spotting'
      }
    ]
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
