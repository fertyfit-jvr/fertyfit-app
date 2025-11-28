export const FORM_DEFINITIONS = {
  F0: {
    title: "F0: Ficha Personal Inicial",
    description: "Esta información es la base de tu protocolo personalizado. Tus datos de ciclo son vitales para calcular tus predicciones de fertilidad.",
    questions: [
      { id: 'q8_last_period', text: "Fecha última regla:", type: 'date' },
      { id: 'q6_cycle', text: "Duración ciclo promedio:", type: 'stepper', min: 21, max: 40, unit: 'días' },
      { id: 'q7_regularity', text: "¿Ciclos regulares?", type: 'buttons', options: ['Regulares', 'Irregulares'] },
      { id: 'q1_birthdate', text: "Tu fecha de nacimiento:", type: 'date' },
      { id: 'q2_height', text: "Altura:", type: 'slider', min: 140, max: 200, unit: 'cm' },
      { id: 'q2_weight', text: "Peso:", type: 'slider', min: 40, max: 150, unit: 'kg' },
      { id: 'q3_time_trying', text: "Tiempo buscando embarazo:", type: 'stepper', min: 0, max: 60, unit: 'meses' },
      { id: 'q4_objective', text: "Objetivo principal:", type: 'buttons', options: ['Concepción natural', 'Reproducción Asistida'] },
      { id: 'q5_partner', text: "¿Buscas en pareja o solitario?", type: 'buttons', options: ['Pareja', 'Solitario'] },
      { id: 'q15_stress', text: "Nivel de Estrés:", type: 'segmented', min: 1, max: 5 },
      { id: 'q16_sleep', text: "Horas de sueño promedio:", type: 'slider', min: 0, max: 12, step: 0.5, unit: 'h' },
      { id: 'q17_smoker', text: "¿Fumas?", type: 'buttons', options: ['No', 'Sí, ocasional', 'Sí, diario'] },
      { id: 'q18_alcohol', text: "¿Consumo de alcohol?", type: 'buttons', options: ['No', 'Ocasional', 'Frecuente'] },
      { id: 'q19_supplements', text: "¿Tomas suplementos actualmente?", type: 'yesno' },
      { id: 'q20_fertility_treatments', text: "Tratamientos de fertilidad previos:", type: 'buttons', options: ['Ninguno', 'FIV', 'Inseminación', 'Ovodonación'] },
      { id: 'q9_diagnoses', text: "Diagnósticos / Breve Historia Médica:", type: 'textarea', optional: true },
      { id: 'q21_family_history', text: "Antecedentes familiares relevantes:", type: 'textarea', optional: true }
    ]
  },
  F1: {
    title: "F1: Analíticas Médicas",
    description: "Completa tus resultados de laboratorio para tu evaluación personalizada. Todos los valores aceptan decimales.",
    questions: [
      { id: 'section_hormonal', text: "📊 Panel Hormonal Femenino (Día 3)", type: 'section' },
      { id: 'q1_fsh', text: "FSH", type: 'number', unit: 'mUI/mL', min: 0, max: 40, step: 0.1 },
      { id: 'q1_lh', text: "LH", type: 'number', unit: 'mUI/mL', min: 0, max: 40, step: 0.1 },
      { id: 'q1_estradiol', text: "Estradiol (E2)", type: 'number', unit: 'pg/mL', min: 0, max: 1000, step: 0.1 },
      { id: 'q1_prolactina', text: "Prolactina", type: 'number', unit: 'ng/mL', step: 0.1 },
      { id: 'q1_tsh', text: "TSH", type: 'number', unit: 'µUI/mL', step: 0.01 },
      { id: 'q1_t4_libre', text: "T4 Libre", type: 'number', unit: 'ng/dL', step: 0.01 },
      { id: 'q1_dia_ciclo', text: "Día del ciclo", type: 'number', defaultValue: 3, disabled: true },
      { id: 'section_metabolico', text: "🩸 Panel Metabólico", type: 'section' },
      { id: 'q2_glucosa', text: "Glucosa", type: 'number', unit: 'mg/dL', min: 40, max: 300, step: 0.1 },
      { id: 'q2_insulina', text: "Insulina", type: 'number', unit: 'µUI/mL', min: 0, max: 100, step: 0.1 },
      { id: 'q2_ferritina', text: "Ferritina", type: 'number', unit: 'ng/mL', min: 1, max: 500, step: 0.1 },
      { id: 'q2_hierro', text: "Hierro", type: 'number', unit: 'µg/dL', step: 0.1 },
      { id: 'q2_transferrina', text: "Transferrina", type: 'number', unit: 'mg/dL', step: 0.1 },
      { id: 'q2_saturacion_transferrina', text: "Saturación de transferrina", type: 'number', unit: '%', step: 0.1 },
      { id: 'q2_pcr', text: "PCR ultrasensible", type: 'number', unit: 'mg/L', min: 0, max: 20, step: 0.01 },
      { id: 'q2_colesterol', text: "Colesterol total", type: 'number', unit: 'mg/dL', step: 0.1 },
      { id: 'q2_trigliceridos', text: "Triglicéridos", type: 'number', unit: 'mg/dL', step: 0.1 },
      { id: 'section_vitamina_d', text: "☀️ Vitamina D", type: 'section' },
      { id: 'q3_vitamina_d', text: "Vitamina D 25-OH", type: 'number', unit: 'ng/mL', min: 1, max: 150, step: 0.1 },
      { id: 'section_ecografia', text: "🔬 Ecografía Transvaginal + AFC", type: 'section' },
      { id: 'q4_afc_total', text: "AFC Total", type: 'number', min: 0, max: 50 },
      { id: 'q4_afc_derecho', text: "AFC Ovario Derecho", type: 'number', min: 0, max: 50 },
      { id: 'q4_afc_izquierdo', text: "AFC Ovario Izquierdo", type: 'number', min: 0, max: 50 },
      { id: 'q4_grosor_endometrial', text: "Grosor Endometrial", type: 'number', unit: 'mm', min: 1, max: 20, step: 0.1 },
      { id: 'q4_patron_endometrial', text: "Patrón Endometrial", type: 'text', optional: true },
      { id: 'section_espermiograma', text: "👥 Espermiograma Básico (Pareja)", type: 'section', optional: true },
      { id: 'q5_volumen', text: "Volumen", type: 'number', unit: 'mL', step: 0.1, optional: true },
      { id: 'q5_concentracion', text: "Concentración", type: 'number', unit: 'millones/mL', step: 0.1, optional: true },
      { id: 'q5_movilidad_total', text: "Movilidad Total", type: 'number', unit: '%', step: 0.1, optional: true },
      { id: 'q5_movilidad_progresiva', text: "Movilidad Progresiva", type: 'number', unit: '%', step: 0.1, optional: true },
      { id: 'q5_morfologia', text: "Morfología Normal", type: 'number', unit: '%', step: 0.1, optional: true },
      { id: 'q5_vitalidad', text: "Vitalidad", type: 'number', unit: '%', step: 0.1, optional: true }
    ]
  },
  F2: {
    title: "F2: Resultados Clínicos (Semana 8)",
    questions: [
      { id: 'q1_amh', text: "Valor AMH y fecha:", type: 'text' },
      { id: 'q2_tsh', text: "Valor TSH y T4 libre:", type: 'text' },
      { id: 'q3_fsh_e2', text: "Valores FSH y Estradiol (Día 3-5):", type: 'text' },
      { id: 'q4_prog', text: "Valor Progesterona (Fase Lútea):", type: 'text' },
      { id: 'q5_vitd', text: "Valor Vitamina D:", type: 'text' },
      { id: 'q6_afc', text: "Recuento Folículos Antrales:", type: 'text' },
      { id: 'q7_male', text: "Resumen Seminograma Pareja:", type: 'textarea', optional: true },
      { id: 'q8_microbiota', text: "Resumen Test Microbiota (si aplica):", type: 'textarea', optional: true },
      { id: 'q9_nutrition', text: "% Adherencia Nutricional estimada (0-100):", type: 'number' },
      { id: 'q10_supp_adj', text: "¿Ajustaste suplementación tras analíticas?", type: 'yesno' },
      { id: 'q11_emotional', text: "Práctica emocional y frecuencia:", type: 'text' },
      { id: 'q12_changes', text: "¿Cambios en bienestar tras protocolos?", type: 'textarea', optional: true },
      { id: 'q13_doubt', text: "Duda principal tras resultados:", type: 'textarea' }
    ]
  },
  F3: {
    title: "F3: Hoja de Ruta Final (Semana 12)",
    questions: [
      { id: 'q1_value', text: "¿Qué ha sido lo más valioso del método?", type: 'textarea' },
      { id: 'q2_improvements', text: "Mejoras en Estrés/Sueño/Ciclo vs Semana 1:", type: 'textarea' },
      { id: 'q3_final_labs', text: "¿Mejoraron valores VitD/Ferritina/TSH?", type: 'text' },
      { id: 'q4_masterplan', text: "Confirma completado 'Plan Maestro':", type: 'yesno' },
      { id: 'q5_route', text: "Ruta Estratégica Decidida:", type: 'select', options: ['Concepción Natural', 'Reproducción Asistida', 'Pausa'] },
      { id: 'q6_next_action', text: "Fecha y detalle próxima acción clave:", type: 'text' },
      { id: 'q7_needs', text: "¿Qué necesitas de FertyFit a futuro?", type: 'textarea' },
      { id: 'q8_testimonial', text: "Testimonio / Feedback (Opcional):", type: 'textarea', optional: true }
    ]
  }
};

