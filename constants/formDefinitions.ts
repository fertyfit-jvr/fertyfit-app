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


// FUNCTION_SECTIONS eliminadas por solicitud del cliente
// const FUNCTION_SECTIONS = [...];

// export { FUNCTION_SECTIONS };


const FOOD_QUESTIONS = [
  // 1. Patrón de alimentación semanal
  {
    id: 'food_patron',
    text: '¿Cuál describe mejor tu patrón de alimentación semanal?',
    type: 'buttons',
    options: [
      'a) Consumo frecuente de comida rápida, ultraprocesados.',
      'b) Una mezcla de comida casera y procesados.',
      'c) Mayor parte comida real/casera, con consumo ocasional de ultraprocesados.',
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
      'd) Diariamente, de forma consciente y variada.',
      'e) No estoy segura.'
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
  // 1. Salud digestiva general (iconos minimalistas 1-7, sin números)
  {
    id: 'flora_dig',
    text: '¿Cómo describirías tu salud digestiva general?',
    type: 'flow_faces',
    min: 1,
    max: 7,
    variant: 'digestive',
    defaultValue: 4
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

  // 4. Alimentos fermentados (conteo semanal)
  {
    id: 'flora_ferm',
    text: '¿Incluyes alimentos fermentados (kéfir, yogur, chucrut) en tu dieta?',
    type: 'stepper',
    min: 0,
    max: 7,
    unit: 'veces/semana',
    defaultValue: 2
  },

  // 5. Intolerancias alimentarias (con campo de texto si marca Sí)
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
  },

  // 6. Síntomas digestivos (multi-selección)
  {
    id: 'flora_sintomas',
    text: '¿Tienes alguno de estos síntomas?',
    type: 'checkboxes',
    options: [
      'Distensión abdominal',
      'Diarrea',
      'Estreñimiento',
      'Reflujo-acidez',
      'Digestiones lentas'
    ],
    defaultValue: []
  },

  // 7. Diagnóstico SIBO
  {
    id: 'flora_sibo',
    text: '¿Te han diagnosticado alguna vez de SIBO?',
    type: 'yesno',
    defaultValue: 'No'
  },

  // 8. Diagnóstico H. Pylori
  {
    id: 'flora_hpylori',
    text: '¿Te han diagnosticado alguna vez de H. Pylori?',
    type: 'yesno',
    defaultValue: 'No'
  },

  // 9. Problemas de piel (Sí/No, si Sí: dermatitis, eczema, psoriasis, otra)
  {
    id: 'flora_piel',
    text: '¿Tienes algún problema de piel?',
    type: 'buttons',
    options: [
      'No',
      'Sí - dermatitis',
      'Sí - eczema',
      'Sí - psoriasis',
      'Sí - otra (especificar)'
    ],
    defaultValue: 'No'
  },

  // 10. Problemas de cabello (caída, pelo fino, otra con campo texto)
  {
    id: 'flora_cabello',
    text: '¿Tienes algún problema de cabello?',
    type: 'buttons',
    options: [
      'No',
      'Caída',
      'Pelo fino',
      'Otra (especificar)'
    ],
    defaultValue: 'No'
  }
];

const FLOW_QUESTIONS = [
  // 1. Nivel de estrés percibido (1-7, iconos visuales sin número)
  {
    id: 'flow_stress',
    text: '¿Cómo calificarías tu nivel de estrés percibido en el día a día?',
    type: 'flow_faces',
    min: 1,
    max: 7,
    variant: 'stress',
    defaultValue: 4
  },

  // 2. Horas de sueño de calidad (slider con step 0.5 para 5.5, 6.5, etc.)
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

  // 4. Tipo y frecuencia de ejercicio (Cardiovascular y Fuerza con Cantidad e Intensidad)
  {
    id: 'flow_ejer',
    text: '¿Qué tipo de ejercicio realizas y con qué frecuencia?',
    type: 'exercise_type',
    options: ['Cardiovascular', 'Fuerza'],
    defaultValue: {}
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
      'd) He realizado una auditoría completa.',
      'e) No sé qué es eso.'
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

  // 8. Entorno Social (solo una opción, color marrón)
  {
    id: 'flow_entorno_social',
    text: '¿Cómo describirías tu entorno social?',
    type: 'buttons',
    options: [
      'Relación familiar estable',
      'Soledad',
      'Otra (especificar)'
    ],
    defaultValue: 'Relación familiar estable'
  },

  // 9. Relaciones Saludables
  {
    id: 'flow_relaciones_saludables',
    text: '¿Tienes relaciones saludables en tu vida?',
    type: 'yesno',
    defaultValue: 'Sí'
  },

  // 10. Estado emocional respecto a búsqueda de embarazo (iconos visuales 1-7, sin número)
  {
    id: 'flow_emocion',
    text: '¿Cómo te sientes emocionalmente respecto a la búsqueda de embarazo?',
    type: 'flow_faces',
    min: 1,
    max: 7,
    variant: 'emotion',
    defaultValue: 4
  },

  // 11. Calidad del sueño (escala 0-4)
  {
    id: 'flow_calidad_sueno',
    text: '¿Cómo calificarías la calidad de tu sueño?',
    type: 'segmented',
    min: 0,
    max: 4,
    options: [0, 1, 2, 3, 4],
    defaultValue: 2
  },

  // 12. Líbido (escala 0-4)
  {
    id: 'flow_libido',
    text: '¿Cómo describirías tu nivel de líbido o deseo sexual?',
    type: 'segmented',
    min: 0,
    max: 4,
    options: [0, 1, 2, 3, 4],
    defaultValue: 2
  },

  // 13. ¿Fumadora?
  {
    id: 'flow_fumadora',
    text: '¿Eres fumadora?',
    type: 'buttons',
    options: [
      'No, nunca he fumado',
      'No, pero fumé en el pasado',
      'Sí, ocasionalmente',
      'Sí, fumo regularmente'
    ],
    defaultValue: 'No, nunca he fumado'
  },

  // 14. Consumo de drogas en el último año (Sí/No + detalle condicional)
  {
    id: 'flow_drogas',
    text: '¿Has consumido drogas en el último año?',
    type: 'yesno',
    defaultValue: 'No'
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
        max: 45,
        unit: 'días',
        defaultValue: 28
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
        id: 'function_knows_fertile_days',
        text: '¿Sabes identificar tus días fértiles?',
        type: 'yesno',
        defaultValue: 'No'
      },
      {
        id: 'function_luteal_phase',
        text: 'Duración fase lútea (días entre ovulación y regla):',
        type: 'slider',
        min: 6,
        max: 16,
        step: 1,
        unit: 'días',
        defaultValue: 12,
        optional: true,
        description: 'Depende de la pregunta anterior'
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
        type: 'faces',
        min: 0,
        max: 4,
        defaultValue: 2
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
