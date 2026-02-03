/**
 * Normalizador de metadatos de documentos FertyFit para RAG.
 *
 * Uso esperado:
 * 1. Copia tu array de 201 objetos JSON tal y como lo tienes ahora
 *    y pégalo dentro de `rawDocuments` (sustituyendo el array de ejemplo).
 * 2. Ejecuta este script (por ejemplo con ts-node / tsx) para obtener
 *    por consola el JSON normalizado listo para:
 *      - Subirlo a Supabase
 *      - Usarlo desde el script de indexación (index_docs)
 *
 * IMPORTANTE:
 * - Este archivo NO toca la base de datos.
 * - Solo transforma datos en memoria y los imprime como JSON.
 */

type PillarCategory = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

interface RawDocumentMetadata {
  document_title: string;
  document_id: string;
  document_author?: string;
  pillar_category?: string;
  target_audience?: string;
  doc_type?: string;
  chapter?: string | null;
  chunk_id?: string | null;
  summary_short?: string;
  keywords?: string[];
  // Cualquier otro campo extra que puedas tener
  [key: string]: any;
}

interface NormalizedDocumentMetadata extends RawDocumentMetadata {
  pillar_category: PillarCategory;
  chapter: string;
  chunk_id: null; // A nivel de DOCUMENTO siempre null; se rellenará por chunk en index_docs
}

/**
 * PEGAR AQUÍ TUS 201 DOCUMENTOS
 *
 * Nota: tu JSON original ya es un ARRAY de documentos, por eso al pegarlo aquí
 * ha quedado como un array dentro de otro array (`[[ {...}, {...} ]]`).
 * Para no tocar tu JSON, lo tratamos como RawDocumentMetadata[][] y luego lo aplanamos.
 */
const rawDocumentsNested: RawDocumentMetadata[][] = [
  [
    {
      "document_title": "use_of_preimplantation_genetic_testing_for_aneuploidy.pdf",
      "document_id": "FUNC-001",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Mujer",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Opinión del comité de la ASRM sobre el uso de pruebas genéticas preimplantacionales para aneuploidías (PGT-A) en FIV, analizando su eficacia clínica.",
      "keywords": [
        "PGT-A",
        "FIV",
        "aneuploidía",
        "genética",
        "embarazo",
        "aborto"
      ]
    },
    {
      "document_title": "Embarazo_enfermedadesreumaticas.pdf",
      "document_id": "FUNC-002",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Mujer",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de práctica clínica para el manejo y control del embarazo en mujeres con enfermedades reumáticas autoinmunes como Lupus y SAF.",
      "keywords": [
        "Lupus",
        "embarazo",
        "enfermedades_reumáticas",
        "autoinmunidad",
        "SAF"
      ]
    },
    {
      "document_title": "1.Experty-Masterclass-Microbiota-vaginal-endometrial-y-seminal.pdf",
      "document_id": "FLORA-001",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Mujer",
      "doc_type": "Presentación",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Masterclass sobre la composición e influencia de la microbiota vaginal, endometrial y seminal en la fertilidad y salud reproductiva.",
      "keywords": [
        "Microbiota",
        "vaginal",
        "endometrial",
        "seminal",
        "fertilidad",
        "disbiosis"
      ]
    },
    {
      "document_title": "Reproductive Effect by Rheumatoid Arthritis and Related Autoantibodies.pdf",
      "document_id": "FUNC-003",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Mujer",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el impacto de la artritis reumatoide y los autoanticuerpos relacionados en la función reproductiva femenina e infertilidad.",
      "keywords": [
        "Artritis_reumatoide",
        "autoanticuerpos",
        "infertilidad",
        "aborto",
        "inflamación"
      ]
    },
    {
      "document_title": "KIR-HLA en inmunología reproductiva.pdf",
      "document_id": "FLORA-002",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Mujer",
      "doc_type": "Taller",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Taller sobre la interacción KIR-HLA en inmunología reproductiva y su papel en la tolerancia materno-fetal y el fallo de implantación.",
      "keywords": [
        "KIR",
        "HLA",
        "inmunología",
        "implantación",
        "aborto_recurrente",
        "NK_cells"
      ]
    },
    {
      "document_title": "De-protocolos-a-personas.-Masterclass-experty-2-11-23.pptx.pdf",
      "document_id": "FUNC-004",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Masterclass",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Masterclass sobre el abordaje clínico personalizado de patologías digestivas, enfocándose en tratar a la persona más allá de los protocolos.",
      "keywords": [
        "Digestivo",
        "patología",
        "clínica",
        "personalizado",
        "salud_digestiva"
      ]
    },
    {
      "document_title": "6.PAUTAS-FERTILIDAD-1.pdf",
      "document_id": "FOOD-001",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Mujer",
      "doc_type": "Guía_Práctica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Recomendaciones básicas de alimentación, suplementación y estilo de vida para mejorar la fertilidad en hombres y mujeres.",
      "keywords": [
        "Fertilidad",
        "alimentación",
        "suplementos",
        "estilo_de_vida",
        "ovulación",
        "vitaminas"
      ]
    },
    {
      "document_title": "Experty-Verano-2021-version-para-pdf.pdf",
      "document_id": "FLOW-001",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flow",
      "target_audience": "Mujer",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía para afrontar el verano manteniendo hábitos saludables y gestionando el estrés y las emociones tras periodos de tensión.",
      "keywords": [
        "Verano",
        "hábitos",
        "estrés",
        "gestión_emocional",
        "bienestar"
      ]
    },
    {
      "document_title": "100322_120046_3574428481.pdf",
      "document_id": "FUNC-005",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Consenso",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Documento de consenso sobre el manejo, cribado y tratamiento de la disfunción tiroidea durante el embarazo.",
      "keywords": [
        "Tiroides",
        "embarazo",
        "hipotiroidismo",
        "TSH",
        "yodo"
      ]
    },
    {
      "document_title": "BRCA mutations and reproduction.pdf",
      "document_id": "FUNC-006",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Mujer",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el impacto de las mutaciones BRCA en la fertilidad femenina, reserva ovárica y opciones de preservación.",
      "keywords": [
        "BRCA",
        "genética",
        "fertilidad",
        "reserva_ovárica",
        "cáncer"
      ]
    },
    {
      "document_title": "FACTORES 2.pdf",
      "document_id": "FUNC-007",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Diseño del estudio IDEAL para evaluar el impacto de la dieta, el ejercicio y el estilo de vida en la fertilidad de parejas.",
      "keywords": [
        "Dieta",
        "ejercicio",
        "estilo_de_vida",
        "fertilidad",
        "estudio"
      ]
    },
    {
      "document_title": "Protocolos-de-Diagnóstico-Autoinmunidad-GEAI-1.pdf",
      "document_id": "FLORA-003",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Protocolo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Protocolos de diagnóstico inmunológico para enfermedades autoinmunes elaborados por la Sociedad Española de Inmunología.",
      "keywords": [
        "Inmunología",
        "autoinmunidad",
        "diagnóstico",
        "anticuerpos",
        "protocolo"
      ]
    },
    {
      "document_title": "Dialnet-TratamientoDeFalloOvaricoPrematuro-8056955.pdf",
      "document_id": "FUNC-008",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Mujer",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo de revisión sobre el tratamiento y manejo del fallo ovárico prematuro (insuficiencia ovárica primaria).",
      "keywords": [
        "Fallo_ovárico",
        "menopausia_precoz",
        "infertilidad",
        "tratamiento_hormonal"
      ]
    },
    {
      "document_title": "Monitorizacion inmunologica en mujeres con aborto recurrente.pdf",
      "document_id": "FLORA-004",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la prevalencia de alteraciones inmunológicas como anticuerpos y células NK en mujeres con aborto espontáneo recurrente.",
      "keywords": [
        "Inmunología",
        "aborto_recurrente",
        "células_NK",
        "autoanticuerpos"
      ]
    },
    {
      "document_title": "Periconceptional Counselling in Women with Autoimmune Inflammatory Rheumatic Diseases.pdf",
      "document_id": "FLORA-005",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el asesoramiento periconcepcional y manejo de medicación en mujeres con enfermedades reumáticas autoinmunes.",
      "keywords": [
        "Enfermedades_autoinmunes",
        "embarazo",
        "consejo_periconcepcional",
        "reumatología"
      ]
    },
    {
      "document_title": "CLASSIFICATION TERMINOLOGY_REVIEW REPORT.pdf",
      "document_id": "FUNC-009",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Reporte",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Reporte de revisión sobre la terminología internacional estandarizada para la clasificación de la endometriosis.",
      "keywords": [
        "Endometriosis",
        "clasificación",
        "terminología",
        "ginecología"
      ]
    },
    {
      "document_title": "Atlas_Reproduccion_Asistida_MERCK.pptx.pdf",
      "document_id": "FUNC-010",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Atlas",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Atlas visual que ilustra técnicas y conceptos clave en el campo de la reproducción asistida.",
      "keywords": [
        "Reproducción_asistida",
        "FIV",
        "atlas",
        "fertilidad"
      ]
    },
    {
      "document_title": "Experty - DAO  - dieta baja histamina pacientes.pdf",
      "document_id": "FOOD-002",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Mujer",
      "doc_type": "Protocolo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Protocolo dietético para pacientes con intolerancia a la histamina, incluyendo dieta de exclusión y suplementación con DAO.",
      "keywords": [
        "Histamina",
        "dieta",
        "DAO",
        "intolerancia",
        "alimentación"
      ]
    },
    {
      "document_title": "Vitiligo 2.pdf",
      "document_id": "FLORA-006",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Mujer",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la interacción bidireccional entre el vitíligo y el embarazo, abordando efectos y manejo.",
      "keywords": [
        "Vitíligo",
        "embarazo",
        "piel",
        "autoinmunidad"
      ]
    },
    {
      "document_title": "Verano-Experty-1.pdf",
      "document_id": "FLOW-002",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flow",
      "target_audience": "Mujer",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Tips y recomendaciones para mantener buenos hábitos y la motivación durante el verano.",
      "keywords": [
        "Verano",
        "hábitos",
        "rutina",
        "motivación",
        "estilo_de_vida"
      ]
    },
    {
      "document_title": "OPTIMIZACIÓN ESTIMULACION SOP.pdf",
      "document_id": "FUNC-011",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Tesis",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Tesis doctoral sobre la optimización de protocolos de hiperestimulación ovárica controlada para FIV/ICSI en pacientes con SOP.",
      "keywords": [
        "SOP",
        "FIV",
        "estimulación_ovárica",
        "protocolos",
        "infertilidad"
      ]
    },
    {
      "document_title": "ESHRE OS guideline updateNov 2025v22.pdf",
      "document_id": "FUNC-012",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Actualización 2025 de la guía de la ESHRE sobre estimulación ovárica para FIV/ICSI.",
      "keywords": [
        "Estimulación_ovárica",
        "FIV",
        "ICSI",
        "guía_clínica",
        "ESHRE"
      ]
    },
    {
      "document_title": "Stakeholder reviewer report_PGT_2019_FINAL.pdf",
      "document_id": "FUNC-013",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Reporte",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Reporte de revisión de las recomendaciones de buenas prácticas de la ESHRE para el Diagnóstico Genético Preimplantacional (PGT).",
      "keywords": [
        "PGT",
        "genética",
        "biopsia_embrionaria",
        "ESHRE",
        "buenas_prácticas"
      ]
    },
    {
      "document_title": "sitedandectopicpregnancieson ultrasound.pdf",
      "document_id": "FUNC-014",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Recomendaciones de la ESHRE sobre la terminología para describir embarazos normoevolutivos y ectópicos mediante ecografía.",
      "keywords": [
        "Embarazo_ectópico",
        "ecografía",
        "terminología",
        "diagnóstico",
        "ESHRE"
      ]
    },
    {
      "document_title": "DISREGULACION HORMOANL IN PCOS.pdf",
      "document_id": "FUNC-015",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión de las hormonas involucradas en las disfunciones endocrinas del Síndrome de Ovario Poliquístico (SOP) y sus interacciones.",
      "keywords": [
        "SOP",
        "hormonas",
        "disfunción_endocrina",
        "ovario_poliquístico",
        "insulina"
      ]
    },
    {
      "document_title": "fpubh-10-1029469.pdf",
      "document_id": "FUNC-016",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sistemática publicada en Frontiers in Public Health (Tema específico pendiente de verificación detallada por falta de título en vista previa).",
      "keywords": [
        "Salud_pública",
        "revisión_sistemática",
        "estudio",
        "evidencia"
      ]
    },
    {
      "document_title": "Articulo-Incremento-factor-VIII-y-abortos-de-repeticion.pdf",
      "document_id": "FUNC-017",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo sobre la relación entre el incremento del factor VIII de coagulación y los abortos de repetición debido a trombofilia.",
      "keywords": [
        "Factor_VIII",
        "aborto_recurrente",
        "trombofilia",
        "coagulación",
        "embarazo"
      ]
    },
    {
      "document_title": "Experty - Candidiasis, chuleta para historia clínica.pdf",
      "document_id": "FLORA-007",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Guía_Rápida",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía rápida para la historia clínica enfocada en factores de riesgo para candidiasis, incluyendo inmunosupresión y dieta.",
      "keywords": [
        "Candidiasis",
        "factores_de_riesgo",
        "historia_clínica",
        "microbiota",
        "infección"
      ]
    },
    {
      "document_title": "Impacto de los estrogenos en la implantacion y desarrollo fetal.pdf",
      "document_id": "FUNC-018",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre el papel fisiopatológico de los estrógenos en las etapas iniciales del embarazo y su impacto en la implantación y desarrollo fetal.",
      "keywords": [
        "Estrógenos",
        "embarazo",
        "implantación",
        "feto",
        "hormonas"
      ]
    },
    {
      "document_title": "Experty - DAO completo.pdf",
      "document_id": "FUNC-019",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía completa sobre la intolerancia a la histamina y el déficit de DAO, explicando sus causas, síntomas y mecanismos biológicos.",
      "keywords": [
        "Histamina",
        "DAO",
        "intolerancia",
        "déficit_enzimático",
        "inflamación"
      ]
    },
    {
      "document_title": "FH-EUR_Novartis-Lpa_brochure_Spanish.pdf",
      "document_id": "FUNC-020",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Folleto",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Folleto informativo para pacientes sobre la lipoproteína(a) elevada, sus riesgos cardiovasculares y cómo manejarla.",
      "keywords": [
        "Lipoproteína(a)",
        "colesterol",
        "riesgo_cardiovascular",
        "corazón",
        "lípidos"
      ]
    },
    {
      "document_title": "assessment and management of polycystic.pdf",
      "document_id": "FUNC-021",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía internacional basada en evidencia (2023) para la evaluación y manejo del Síndrome de Ovario Poliquístico (SOP).",
      "keywords": [
        "SOP",
        "ovario_poliquístico",
        "infertilidad",
        "guía_clínica",
        "hormonas"
      ]
    },
    {
      "document_title": "trombosiS AAS heparina.pdf",
      "document_id": "FUNC-022",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Presentación",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Documento sobre el uso de ácido acetilsalicílico (AAS) y heparina en el embarazo para la prevención de preeclampsia y complicaciones trombóticas.",
      "keywords": [
        "AAS",
        "heparina",
        "embarazo",
        "trombosis",
        "preeclampsia"
      ]
    },
    {
      "document_title": "LUPUS PARTE 1.pdf",
      "document_id": "FLORA-008",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Consenso",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Documento de consenso sobre el control del embarazo en pacientes con Lupus Eritematoso Sistémico y SAF, enfocándose en infertilidad.",
      "keywords": [
        "Lupus",
        "SAF",
        "embarazo",
        "infertilidad",
        "autoinmunidad"
      ]
    },
    {
      "document_title": "Experty-Mujer-deportista-en-la-consulta-de-nutricion-F-Japon.pdf",
      "document_id": "FUNC-023",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía para la consulta de nutrición enfocada en la mujer deportista, abordando historial de entrenamiento y objetivos de rendimiento.",
      "keywords": [
        "Deporte",
        "mujer",
        "nutrición_deportiva",
        "entrenamiento",
        "rendimiento"
      ]
    },
    {
      "document_title": "Immunologic and rheumatologic causes and treatment of recurrent pregnancy loss- what is the evidence_.pdf",
      "document_id": "FLORA-009",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión de la evidencia sobre las causas inmunológicas y reumatológicas del aborto recurrente y sus tratamientos.",
      "keywords": [
        "Inmunología",
        "aborto_recurrente",
        "reumatología",
        "evidencia",
        "tratamiento"
      ]
    },
    {
      "document_title": "FACTORES.pdf",
      "document_id": "FOOD-003",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el impacto de la dieta y factores nutricionales en la fertilidad e infertilidad masculina.",
      "keywords": [
        "Dieta",
        "nutrición",
        "fertilidad_masculina",
        "esperma",
        "antioxidantes"
      ]
    },
    {
      "document_title": "ANTICUERPOS.pdf",
      "document_id": "FLORA-010",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Apuntes",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Resumen sobre anticuerpos antifosfolípidos y antinucleares (ANAs), y su asociación con enfermedades autoinmunes y abortos.",
      "keywords": [
        "Anticuerpos",
        "SAF",
        "Lupus",
        "autoinmunidad",
        "ANAs"
      ]
    },
    {
      "document_title": "Libro laboratorio clinico y la funcion hormonal.pdf",
      "document_id": "FUNC-024",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Libro",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Libro sobre el laboratorio clínico y la evaluación de la función hormonal.",
      "keywords": [
        "Laboratorio",
        "hormonas",
        "análisis_clínicos",
        "endocrinología"
      ]
    },
    {
      "document_title": "FITOESTROGENOS.pdf",
      "document_id": "FOOD-004",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio de cohorte sobre la ingesta de fitoestrógenos en la dieta y su relación con la fecundabilidad en mujeres.",
      "keywords": [
        "Fitoestrógenos",
        "dieta",
        "fertilidad",
        "fecundabilidad",
        "soja"
      ]
    },
    {
      "document_title": "Changes in intestinal tight junctionpermeability-autoinmune diseasea.pdf",
      "document_id": "FLORA-011",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre cómo los cambios en la permeabilidad intestinal asociados a aditivos alimentarios explican el aumento de enfermedades autoinmunes.",
      "keywords": [
        "Permeabilidad_intestinal",
        "autoinmunidad",
        "aditivos",
        "microbiota",
        "dieta"
      ]
    },
    {
      "document_title": "libro_dieta_cetogenica.pdf",
      "document_id": "FOOD-005",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Libro",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Ebook complementario sobre la dieta cetogénica, explicando la teoría, el metabolismo lipolítico y su aplicación práctica.",
      "keywords": [
        "Dieta_cetogénica",
        "keto",
        "metabolismo",
        "lipólisis",
        "nutrición"
      ]
    },
    {
      "document_title": "PSORIASIS.pdf",
      "document_id": "FLORA-012",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta informativa sobre la psoriasis como trastorno inflamatorio autoinmune y la importancia de bajar el porcentaje de grasa.",
      "keywords": [
        "Psoriasis",
        "autoinmunidad",
        "piel",
        "grasa_corporal",
        "inflamación"
      ]
    },
    {
      "document_title": "J Neuroendocrinology - 2022 - McCartney - The role of gonadotropin‐releasing hormone neurons in polycystic ovary syndrome.pdf",
      "document_id": "FUNC-025",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre el papel de las neuronas liberadoras de gonadotropina (GnRH) en la fisiopatología del Síndrome de Ovario Poliquístico (SOP).",
      "keywords": [
        "SOP",
        "GnRH",
        "neuroendocrinología",
        "hormonas",
        "ovario_poliquístico"
      ]
    },
    {
      "document_title": "Vitiligo 1.pdf",
      "document_id": "FLORA-013",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio de cohorte sobre los resultados del embarazo en mujeres con vitíligo.",
      "keywords": [
        "Vitíligo",
        "embarazo",
        "autoinmunidad",
        "piel",
        "complicaciones"
      ]
    },
    {
      "document_title": "POI GUIDELINE_Patient version_2024dec.pdf",
      "document_id": "FUNC-026",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Guía_Paciente",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Versión para pacientes de la guía de la ESHRE sobre Insuficiencia Ovárica Prematura (POI), explicando diagnóstico y manejo.",
      "keywords": [
        "POI",
        "fallo_ovárico",
        "menopausia_precoz",
        "guía_paciente",
        "fertilidad"
      ]
    },
    {
      "document_title": "Effects of Physical Activity on Fertility Parameters...",
      "document_id": "FUNC-027",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Meta-análisis",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Meta-análisis de ensayos controlados aleatorios sobre los efectos de la actividad física en los parámetros de fertilidad.",
      "keywords": [
        "Actividad_física",
        "fertilidad",
        "ejercicio",
        "meta-análisis",
        "esperma"
      ]
    },
    {
      "document_title": "manejo_patologia_tiroidea.pdf",
      "document_id": "FUNC-028",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía práctica sobre el manejo de la patología tiroidea (hipotiroidismo, hipertiroidismo, nódulos) y su relación con el embarazo.",
      "keywords": [
        "Tiroides",
        "hipotiroidismo",
        "embarazo",
        "endocrinología",
        "nódulo_tiroideo"
      ]
    },
    {
      "document_title": "guia-soycomocomo-4.pdf",
      "document_id": "FOOD-006",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía esencial sobre alimentación saludable y equilibrada, con consejos prácticos para mejorar hábitos dietéticos.",
      "keywords": [
        "Alimentación_saludable",
        "dieta",
        "hábitos",
        "nutrición",
        "equilibrio"
      ]
    },
    {
      "document_title": "TD_PEREZ_NEVOT_Beatriz.pdf",
      "document_id": "FUNC-029",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Tesis_Doctoral",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Tesis doctoral sobre polimorfismos genéticos implicados en el metabolismo de hormonas sexuales y su asociación con abortos espontáneos.",
      "keywords": [
        "Genética",
        "polimorfismos",
        "hormonas",
        "aborto_espontáneo",
        "metabolismo"
      ]
    },
    {
      "document_title": "Surgical Treatment of Endometriosis. Part 1.pdf",
      "document_id": "FUNC-030",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Recomendaciones de la ESHRE/ESGE/WES para el tratamiento quirúrgico de la endometriosis, parte 1: Endometrioma ovárico.",
      "keywords": [
        "Endometriosis",
        "cirugía",
        "endometrioma",
        "ovario",
        "laparoscopia"
      ]
    },
    {
      "document_title": "Immune Checkpoints in Recurrent Pregnancy Loss- New Insights into a Detrimental and Elusive Disorder.pdf",
      "document_id": "FLORA-014",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo sobre el papel de los puntos de control inmunológico (immune checkpoints) en el aborto recurrente y nuevas perspectivas terapéuticas.",
      "keywords": [
        "Inmunología",
        "aborto_recurrente",
        "immune_checkpoints",
        "tolerancia_materno-fetal"
      ]
    },
    {
      "document_title": "AbortosyTrombofilia-Dr-Fariñas.pdf",
      "document_id": "FUNC-031",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Resumen_Conferencia",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Resumen de conferencia sobre la relación entre abortos de repetición y trombofilias hereditarias y adquiridas.",
      "keywords": [
        "Trombofilia",
        "aborto_recurrente",
        "factor_V_Leiden",
        "anticoagulantes",
        "genética"
      ]
    },
    {
      "document_title": "LUPUS PARTE 2.pdf",
      "document_id": "FLORA-015",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Consenso",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Parte 2 del documento de consenso sobre el control del embarazo en pacientes con Lupus y SAF, enfocado en el seguimiento obstétrico.",
      "keywords": [
        "Lupus",
        "SAF",
        "embarazo",
        "seguimiento",
        "complicaciones"
      ]
    },
    {
      "document_title": "ESHRE GUIDELINE ENDOMETRIOSIS 2022_1.pdf",
      "document_id": "FUNC-032",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de práctica clínica de la ESHRE (2022) para el diagnóstico y manejo de la endometriosis.",
      "keywords": [
        "Endometriosis",
        "guía_clínica",
        "dolor_pélvico",
        "infertilidad",
        "tratamiento"
      ]
    },
    {
      "document_title": "LUPUS-FERTILIDAD-COMPLICACIONES OBSTETRICAS.pdf",
      "document_id": "FLORA-016",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la fertilidad y las complicaciones obstétricas y fetales en gestantes con Lupus Eritematoso Sistémico y Síndrome Antifosfolípido.",
      "keywords": [
        "Lupus",
        "SAF",
        "fertilidad",
        "complicaciones_obstétricas",
        "embarazo"
      ]
    },
    {
      "document_title": "Menopause- identification and management.pdf",
      "document_id": "FUNC-033",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía NICE sobre la identificación y manejo de la menopausia, incluyendo diagnóstico y opciones de tratamiento.",
      "keywords": [
        "Menopausia",
        "guía_clínica",
        "NICE",
        "terapia_hormonal",
        "sofocos"
      ]
    },
    {
      "document_title": "Bases-endocrinas-y-fisiologicas-en-salud-hormonal-femenina_comp.pdf",
      "document_id": "FUNC-034",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Material_Docente",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Material docente sobre las bases endocrinas y fisiológicas de la salud hormonal femenina y el ciclo menstrual.",
      "keywords": [
        "Endocrinología",
        "ciclo_menstrual",
        "hormonas",
        "fisiología",
        "salud_femenina"
      ]
    },
    {
      "document_title": "ESHRE Chromosomal mosaicism_REVIEW REPORT.pdf",
      "document_id": "FUNC-035",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Reporte",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Reporte de revisión y recomendaciones de buenas prácticas de la ESHRE sobre el manejo del mosaicismo cromosómico en embriones.",
      "keywords": [
        "Mosaicismo",
        "genética",
        "embriones",
        "PGT",
        "ESHRE"
      ]
    },
    {
      "document_title": "Taller Nutricion Fertilidad - Lista Nutrientes y Suplementos - Laura Balletbo.pdf",
      "document_id": "FOOD-007",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Lista",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Lista visual de nutrientes y suplementos clave para la fertilidad, incluyendo omega-3, folato, vitamina E y sus fuentes alimentarias.",
      "keywords": [
        "Nutrientes",
        "suplementos",
        "fertilidad",
        "omega-3",
        "folato",
        "vitamina_E",
        "antioxidantes"
      ]
    },
    {
      "document_title": "7.DIETA ANTIINFLAMATORIA.pdf",
      "document_id": "FOOD-008",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estrategia dietética antiinflamatoria, introduciendo alimentos que mejoran marcadores inflamatorios para pacientes con patologías asociadas.",
      "keywords": [
        "Dieta_antiinflamatoria",
        "inflamación",
        "alimentos",
        "nutrición",
        "salud"
      ]
    },
    {
      "document_title": "Female Autoimmune Disorders with Infertility- A Narrative Review.pdf",
      "document_id": "FLORA-017",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión narrativa sobre la relación entre trastornos autoinmunes femeninos e infertilidad.",
      "keywords": [
        "Autoinmunidad",
        "infertilidad",
        "mujer",
        "trastornos_autoinmunes",
        "revisión"
      ]
    },
    {
      "document_title": "SUPLEMENTOS.pdf",
      "document_id": "FOOD-009",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la seguridad y eficacia de los suplementos nutricionales durante el embarazo para reducir riesgos y mejorar la salud materna y fetal.",
      "keywords": [
        "Suplementos",
        "embarazo",
        "seguridad",
        "eficacia",
        "nutrición"
      ]
    },
    {
      "document_title": "Immunogenetic contributions to recurrent pregnancy loss.pdf",
      "document_id": "FLORA-018",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre las contribuciones inmunogenéticas al aborto recurrente (RPL), analizando causas idiopáticas y marcadores.",
      "keywords": [
        "Inmunogenética",
        "aborto_recurrente",
        "RPL",
        "inmunología",
        "genética"
      ]
    },
    {
      "document_title": "Directriz para la prevención, el diagnóstico y el tratamiento de la esterilidad Resumen de las  recomendaciones.pdf",
      "document_id": "FUNC-036",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Resumen de las recomendaciones de la directriz para la prevención, diagnóstico y tratamiento de la esterilidad.",
      "keywords": [
        "Esterilidad",
        "infertilidad",
        "diagnóstico",
        "tratamiento",
        "prevención"
      ]
    },
    {
      "document_title": "hoac057_final.pdf",
      "document_id": "FUNC-037",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guías de la ESGO/ESHRE/ESGE para el tratamiento preservador de la fertilidad en pacientes con carcinoma de endometrio.",
      "keywords": [
        "Carcinoma_endometrio",
        "preservación_fertilidad",
        "oncología",
        "guía_clínica",
        "cáncer"
      ]
    },
    {
      "document_title": "Clase_Diabetes_laboratorio_Bioq.-Juan-Carroza_2021.pdf",
      "document_id": "FUNC-038",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Clase",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Material de clase sobre el aporte del laboratorio clínico al diagnóstico y seguimiento de la Diabetes Mellitus.",
      "keywords": [
        "Diabetes",
        "laboratorio",
        "diagnóstico",
        "bioquímica",
        "glucosa"
      ]
    },
    {
      "document_title": "World Health Organisation Guideline Development Group for Infertility",
      "document_id": "FUNC-039",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de la OMS sobre el diagnóstico y tratamiento de la infertilidad, desarrollada por un grupo de expertos internacionales.",
      "keywords": [
        "Infertilidad",
        "OMS",
        "guía_clínica",
        "diagnóstico",
        "tratamiento"
      ]
    },
    {
      "document_title": "A new insight on evaluation of the fertility and pregnancy outcome in patients with primary Sjögren syndrome- a propensity score matched study in multi-IVF centers.pdf",
      "document_id": "FLORA-019",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio multicéntrico sobre los resultados de fertilidad y embarazo en pacientes con Síndrome de Sjögren primario sometidas a FIV.",
      "keywords": [
        "Sjögren",
        "autoinmunidad",
        "FIV",
        "fertilidad",
        "embarazo"
      ]
    },
    {
      "document_title": "dez300.pdf",
      "document_id": "FUNC-040",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio de cohorte poblacional sobre cómo la actividad física, el sedentarismo y el IMC afectan la fertilidad en mujeres a lo largo de 15 años.",
      "keywords": [
        "Actividad_física",
        "IMC",
        "fertilidad",
        "sedentarismo",
        "epidemiología"
      ]
    },
    {
      "document_title": "GENETICA.pdf",
      "document_id": "FUNC-041",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Apuntes",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Material educativo sobre anomalías cromosómicas numéricas y estructurales, mecanismos y nomenclatura.",
      "keywords": [
        "Genética",
        "cromosomas",
        "anomalías",
        "translocaciones",
        "deleciones"
      ]
    },
    {
      "document_title": "Recomendaciones disfuncion reproductiva.pdf",
      "document_id": "FUNC-042",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Consenso",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Documento de consenso con recomendaciones para el estudio genético e inmunológico en parejas con disfunción reproductiva.",
      "keywords": [
        "Genética",
        "inmunología",
        "infertilidad",
        "aborto_recurrente",
        "estudio"
      ]
    },
    {
      "document_title": "SUPLEMENTARIO.pdf",
      "document_id": "FOOD-010",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Lista",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Lista de nutrientes y vitaminas beneficiosos para la fertilidad, describiendo sus fuentes alimentarias y efectos.",
      "keywords": [
        "Nutrientes",
        "suplementos",
        "omega-3",
        "fertilidad",
        "alimentación"
      ]
    },
    {
      "document_title": "315_MICROBIOTA.pdf",
      "document_id": "FLORA-020",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la microbiota del tracto urogenital femenino y su relevancia en la fertilidad y reproducción humana.",
      "keywords": [
        "Microbiota",
        "tracto_urogenital",
        "fertilidad",
        "disbiosis",
        "reproducción"
      ]
    },
    {
      "document_title": "REVIEW REPORT_Add-ons_Final.pdf",
      "document_id": "FUNC-043",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Reporte",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Reporte de revisión de las recomendaciones de buenas prácticas de la ESHRE sobre los 'add-ons' (técnicas complementarias) en medicina reproductiva.",
      "keywords": [
        "Add-ons",
        "FIV",
        "medicina_reproductiva",
        "ESHRE",
        "evidencia"
      ]
    },
    {
      "document_title": "ESHRE ECS ETHICS_review report_230920.pdf",
      "document_id": "FUNC-044",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Reporte",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Reporte de revisión sobre los aspectos éticos del cribado ampliado de portadores (ECS) en solicitantes de reproducción asistida.",
      "keywords": [
        "Ética",
        "cribado_portadores",
        "genética",
        "reproducción_asistida",
        "ESHRE"
      ]
    },
    {
      "document_title": "1- ESHRE ET Guideline - Main document.pdf",
      "document_id": "FUNC-045",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de la ESHRE sobre el número de embriones a transferir durante los ciclos de FIV/ICSI para optimizar resultados y minimizar riesgos.",
      "keywords": [
        "Transferencia_embrionaria",
        "FIV",
        "ICSI",
        "embarazo_múltiple",
        "guía_clínica"
      ]
    },
    {
      "document_title": "FAST-FOOD-SALUDABLE.pdf",
      "document_id": "FOOD-011",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía visual de opciones de 'comida rápida' saludable, enfocada en legumbres, cereales y tubérculos.",
      "keywords": [
        "Comida_rápida",
        "saludable",
        "legumbres",
        "dieta",
        "recetas"
      ]
    },
    {
      "document_title": "SOP a lo largo de la vida de la mujer.pdf",
      "document_id": "FUNC-046",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el Síndrome de Ovario Poliquístico (SOP) y sus manifestaciones a lo largo de las diferentes etapas de la vida de la mujer.",
      "keywords": [
        "SOP",
        "ovario_poliquístico",
        "endocrinología",
        "salud_femenina",
        "ciclo_vital"
      ]
    },
    {
      "document_title": "girls and women with Turner syndrome-.pdf",
      "document_id": "FUNC-047",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guías de práctica clínica internacionales (2023) para el cuidado de niñas y mujeres con Síndrome de Turner.",
      "keywords": [
        "Síndrome_Turner",
        "genética",
        "guía_clínica",
        "salud_femenina",
        "endocrinología"
      ]
    },
    {
      "document_title": "7.DIETA ANTIINFLAMATORIA.pdf",
      "document_id": "FOOD-012",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estrategia dietética antiinflamatoria, introduciendo alimentos que mejoran marcadores inflamatorios para pacientes con patologías asociadas.",
      "keywords": [
        "Dieta_antiinflamatoria",
        "inflamación",
        "alimentos",
        "nutrición",
        "salud"
      ]
    },
    {
      "document_title": "Female Autoimmune Disorders with Infertility- A Narrative Review.pdf",
      "document_id": "FLORA-021",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión narrativa sobre la relación entre trastornos autoinmunes femeninos e infertilidad.",
      "keywords": [
        "Autoinmunidad",
        "infertilidad",
        "mujer",
        "trastornos_autoinmunes",
        "revisión"
      ]
    },
    {
      "document_title": "SUPLEMENTOS.pdf",
      "document_id": "FOOD-013",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la seguridad y eficacia de los suplementos nutricionales durante el embarazo para reducir riesgos y mejorar la salud materna y fetal.",
      "keywords": [
        "Suplementos",
        "embarazo",
        "seguridad",
        "eficacia",
        "nutrición"
      ]
    },
    {
      "document_title": "Immunogenetic contributions to recurrent pregnancy loss.pdf",
      "document_id": "FLORA-022",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre las contribuciones inmunogenéticas al aborto recurrente (RPL), analizando causas idiopáticas y marcadores.",
      "keywords": [
        "Inmunogenética",
        "aborto_recurrente",
        "RPL",
        "inmunología",
        "genética"
      ]
    },
    {
      "document_title": "Directriz para la prevención, el diagnóstico y el tratamiento de la esterilidad Resumen de las  recomendaciones.pdf",
      "document_id": "FUNC-048",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Resumen de las recomendaciones de la directriz para la prevención, diagnóstico y tratamiento de la esterilidad.",
      "keywords": [
        "Esterilidad",
        "infertilidad",
        "diagnóstico",
        "tratamiento",
        "prevención"
      ]
    },
    {
      "document_title": "hoac057_final.pdf",
      "document_id": "FUNC-049",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guías de la ESGO/ESHRE/ESGE para el tratamiento preservador de la fertilidad en pacientes con carcinoma de endometrio.",
      "keywords": [
        "Carcinoma_endometrio",
        "preservación_fertilidad",
        "oncología",
        "guía_clínica",
        "cáncer"
      ]
    },
    {
      "document_title": "Clase_Diabetes_laboratorio_Bioq.-Juan-Carroza_2021.pdf",
      "document_id": "FUNC-050",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Clase",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Material de clase sobre el aporte del laboratorio clínico al diagnóstico y seguimiento de la Diabetes Mellitus.",
      "keywords": [
        "Diabetes",
        "laboratorio",
        "diagnóstico",
        "bioquímica",
        "glucosa"
      ]
    },
    {
      "document_title": "DERMATITIS ATOPICA.pdf",
      "document_id": "FLORA-023",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Manual",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Manual de enfermería para el manejo de la dermatitis atópica, abordando cuidados, tratamiento y aspectos psicológicos.",
      "keywords": [
        "Dermatitis_atópica",
        "piel",
        "enfermería",
        "cuidados",
        "inflamación"
      ]
    },
    {
      "document_title": "Abortos-y-Antifosfolipidos_2020(1).pdf",
      "document_id": "FLORA-024",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Documento sobre la utilidad de la heparina en mujeres con fallo reproductivo recurrente y anticuerpos antifosfolípidos a título bajo.",
      "keywords": [
        "SAF",
        "heparina",
        "aborto_recurrente",
        "anticuerpos",
        "tratamiento"
      ]
    },
    {
      "document_title": "Abordaje-de-la-insati-2.pdf",
      "document_id": "FLOW-003",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flow",
      "target_audience": "Profesional",
      "doc_type": "Presentación",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Abordaje de la insatisfacción corporal desde la consulta de nutrición y psicología, enfocado en Trastornos de la Conducta Alimentaria (TCA).",
      "keywords": [
        "Imagen_corporal",
        "psicología",
        "TCA",
        "nutrición",
        "insatisfacción"
      ]
    },
    {
      "document_title": "ESHRE ESGE Consensus on Diagnosis HUMREP 2016.pdf",
      "document_id": "FUNC-051",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Consenso",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Consenso de la ESHRE/ESGE sobre el diagnóstico de anomalías genitales femeninas (CONUTA).",
      "keywords": [
        "Anomalías_uterinas",
        "diagnóstico",
        "malformaciones",
        "ESHRE",
        "útero"
      ]
    },
    {
      "document_title": "Autoimmune thyroid disease disrupts immune homeostasis in the endometrium of unexplained infertility women—a single-cell RNA transcriptome study during the implantation window.pdf",
      "document_id": "FLORA-025",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio de transcriptoma sobre cómo la enfermedad tiroidea autoinmune altera la homeostasis inmunológica en el endometrio de mujeres con infertilidad inexplicada.",
      "keywords": [
        "Tiroides",
        "autoinmunidad",
        "endometrio",
        "infertilidad",
        "inmunología"
      ]
    },
    {
      "document_title": "Revista_microbiota_WEB.pdf",
      "document_id": "FLORA-026",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Paciente",
      "doc_type": "Revista",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revista de divulgación sobre la microbiota, probióticos y salud intestinal.",
      "keywords": [
        "Microbiota",
        "probióticos",
        "salud_intestinal",
        "disbiosis",
        "divulgación"
      ]
    },
    {
      "document_title": "clinical practice in ART.pdf",
      "document_id": "FUNC-052",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Consenso",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Consenso de Maribor sobre el desarrollo de indicadores de rendimiento (KPIs) para la práctica clínica en Reproducción Asistida (ART).",
      "keywords": [
        "Reproducción_asistida",
        "indicadores",
        "calidad",
        "FIV",
        "laboratorio"
      ]
    },
    {
      "document_title": "OMEGAS-.pdf",
      "document_id": "FOOD-014",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Herramienta",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta informativa sobre la importancia de los ácidos grasos esenciales Omega 3 y Omega 6 para la salud, inflamación e inmunidad.",
      "keywords": [
        "Omega-3",
        "ácidos_grasos",
        "inflamación",
        "nutrición",
        "suplementos"
      ]
    },
    {
      "document_title": "Experty DAO - registros.pdf",
      "document_id": "FOOD-015",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Registro",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Plantilla de registro de síntomas (migraña, digestivos, piel) para el seguimiento de pacientes con déficit de DAO o intolerancia a la histamina.",
      "keywords": [
        "Registro",
        "síntomas",
        "DAO",
        "histamina",
        "seguimiento"
      ]
    },
    {
      "document_title": "Experty - Candidiasis Dietoterapia.pdf",
      "document_id": "FOOD-016",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Abordaje dietoterapéutico para la candidiasis, incluyendo historia clínica, hábitos y registro de alimentos.",
      "keywords": [
        "Candidiasis",
        "dieta",
        "nutrición",
        "tratamiento",
        "hábitos"
      ]
    },
    {
      "document_title": "02_ Inmunologia _ II _ guia.pdf",
      "document_id": "FLORA-027",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía sobre inmunología reproductiva, enfocada en la activación inmune, el sistema KIR-HLA-C y su impacto en la implantación.",
      "keywords": [
        "Inmunología",
        "KIR",
        "HLA",
        "implantación",
        "reproducción"
      ]
    },
    {
      "document_title": "Improving diagnostic precision in primary ovarian insufficiency using comprehensive genetic and autoantibody testing.pdf",
      "document_id": "FUNC-053",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la mejora de la precisión diagnóstica en la Insuficiencia Ovárica Primaria (POI) mediante pruebas genéticas y de autoanticuerpos.",
      "keywords": [
        "POI",
        "genética",
        "autoanticuerpos",
        "diagnóstico",
        "fallo_ovárico"
      ]
    },
    {
      "document_title": "TFG-UrriesRodriguezAlba-2019.pdf",
      "document_id": "FUNC-054",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Tesis",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Trabajo de Fin de Grado en Medicina sobre un tema clínico (Título específico no visible en vista previa).",
      "keywords": [
        "TFG",
        "medicina",
        "tesis",
        "académico",
        "investigación"
      ]
    },
    {
      "document_title": "UI guideline_ Final.pdf",
      "document_id": "FUNC-055",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de la ESHRE (2023) sobre el manejo de la infertilidad inexplicada, desarrollada en colaboración con expertos internacionales.",
      "keywords": [
        "Infertilidad_inexplicada",
        "guía_clínica",
        "ESHRE",
        "diagnóstico",
        "tratamiento"
      ]
    },
    {
      "document_title": "ALTERACION FOSFORILACION RI EN PCOS..pdf",
      "document_id": "FUNC-056",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la alteración de la autofosforilación del receptor de insulina en el ovario de mujeres con Síndrome de Ovario Poliquístico (SOP).",
      "keywords": [
        "SOP",
        "insulina",
        "receptor_insulina",
        "ovario",
        "metabolismo"
      ]
    },
    {
      "document_title": "LUPUS PARTE 3..pdf",
      "document_id": "FLORA-028",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Consenso",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Parte 3 del documento de consenso sobre el control del embarazo en pacientes con Lupus y SAF, enfocado en parto, puerperio y lactancia.",
      "keywords": [
        "Lupus",
        "SAF",
        "parto",
        "lactancia",
        "puerperio"
      ]
    },
    {
      "document_title": "ANAS-CONECTIVOPATIAS SISTEMICAS.pdf",
      "document_id": "FLORA-029",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la asociación entre títulos de anticuerpos antinucleares (ANAs) y conectivopatías sistémicas en una unidad de reumatología.",
      "keywords": [
        "ANAs",
        "conectivopatías",
        "autoinmunidad",
        "reumatología",
        "diagnóstico"
      ]
    },
    {
      "document_title": "ASIGN-2-Disfunciones-y-patologias-del-ciclo-menstrual_compressed.pdf",
      "document_id": "FUNC-057",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Material_Docente",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Material docente sobre las disfunciones y patologías del ciclo menstrual desde la perspectiva de la medicina funcional.",
      "keywords": [
        "Ciclo_menstrual",
        "disfunciones",
        "medicina_funcional",
        "hormonas",
        "salud_femenina"
      ]
    },
    {
      "document_title": "treatment of endometriosis. Part 2.pdf",
      "document_id": "FUNC-058",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Recomendaciones de la ESHRE/ESGE/WES para el tratamiento quirúrgico de la endometriosis, parte 2: Endometriosis profunda.",
      "keywords": [
        "Endometriosis",
        "cirugía",
        "endometriosis_profunda",
        "guía_clínica",
        "laparoscopia"
      ]
    },
    {
      "document_title": "Embarazo_enfermedadesreumáticas2.pdf",
      "document_id": "FLORA-030",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Parte II de las guías de práctica clínica del Colegio Mexicano de Reumatología para la atención del embarazo en mujeres con enfermedades reumáticas autoinmunes.",
      "keywords": [
        "Enfermedades_reumáticas",
        "embarazo",
        "autoinmunidad",
        "guía_clínica",
        "reumatología"
      ]
    },
    {
      "document_title": "Experty - Alcanzar requerimientos proteicos.pdf",
      "document_id": "FOOD-017",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Herramienta",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta educativa sobre macronutrientes y cómo alcanzar los requerimientos proteicos diarios.",
      "keywords": [
        "Proteínas",
        "macronutrientes",
        "nutrición",
        "requerimientos",
        "dieta"
      ]
    },
    {
      "document_title": "Habitos-que-transforman-Experty.pdf",
      "document_id": "FLOW-004",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flow",
      "target_audience": "Paciente",
      "doc_type": "Planificador",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Planificador y guía para construir rutinas saludables y alcanzar metas con claridad y propósito.",
      "keywords": [
        "Hábitos",
        "rutinas",
        "objetivos",
        "motivación",
        "estilo_de_vida"
      ]
    },
    {
      "document_title": "GUIA ETA 2021 TIROIDES E INFERTILIDAD.pdf",
      "document_id": "FUNC-059",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de la Asociación Europea de Tiroides (2021) sobre trastornos tiroideos antes y durante la reproducción asistida.",
      "keywords": [
        "Tiroides",
        "infertilidad",
        "reproducción_asistida",
        "guía_clínica",
        "ETA"
      ]
    },
    {
      "document_title": "Experty - complementariadad proteínas.pdf",
      "document_id": "FOOD-018",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Infografía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Infografía sobre combinaciones de alimentos vegetales para obtener proteínas completas (complementariedad proteica).",
      "keywords": [
        "Proteínas_vegetales",
        "complementariedad",
        "nutrición",
        "dieta_vegetariana",
        "aminoácidos"
      ]
    },
    {
      "document_title": "consensus on oocyte and embryo.pdf",
      "document_id": "FUNC-060",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Consenso",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Actualización del consenso de Estambul de la ESHRE/ALPHA sobre la evaluación morfológica estática y dinámica de ovocitos y embriones.",
      "keywords": [
        "Embriología",
        "ovocitos",
        "embriones",
        "morfología",
        "consenso"
      ]
    },
    {
      "document_title": "MICROBIOTA.pdf",
      "document_id": "FLORA-031",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la caracterización de la microbiota intestinal en mujeres con infertilidad y resultados preliminares de una intervención con fibra dietética.",
      "keywords": [
        "Microbiota_intestinal",
        "infertilidad",
        "fibra",
        "prebióticos",
        "disbiosis"
      ]
    },
    {
      "document_title": "Comparison of the effect of two combinations of myo inositol and D chiro inositol in women with polycystic ovary syndrome undergoing ICSI a.pdf",
      "document_id": "FOOD-019",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Ensayo_Clínico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Ensayo controlado aleatorio comparando dos combinaciones de mio-inositol y D-chiro-inositol en mujeres con SOP sometidas a ICSI.",
      "keywords": [
        "Inositol",
        "SOP",
        "ICSI",
        "suplementos",
        "fertilidad"
      ]
    },
    {
      "document_title": "ZG8UgO3AufMsiGhx_dYJ_OXKO2MgqafFazQ9_BxF83E.pdf",
      "document_id": "FUNC-061",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía clínica de la SEF sobre el estudio y tratamiento de la patología tiroidea e hiperprolactinemia en reproducción.",
      "keywords": [
        "Tiroides",
        "hiperprolactinemia",
        "reproducción",
        "guía_clínica",
        "SEF"
      ]
    },
    {
      "document_title": "SIMPOSIO.pdf",
      "document_id": "FOOD-020",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo sobre nutrición en vacas lecheras (Posible archivo no relacionado o analogía biológica).",
      "keywords": [
        "Nutrición_animal",
        "lácteos",
        "producción",
        "irrelevante"
      ]
    },
    {
      "document_title": "Abortos-y-Antifosfolipidos_2020.pdf",
      "document_id": "FLORA-032",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Documento sobre la utilidad de la heparina en mujeres con fallo reproductivo recurrente y anticuerpos antifosfolípidos.",
      "keywords": [
        "SAF",
        "heparina",
        "aborto_recurrente",
        "anticuerpos",
        "tratamiento"
      ]
    },
    {
      "document_title": "CLASSIFICATION REVIEW_REVIEW REPORT.pdf",
      "document_id": "FUNC-062",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sistemática sobre los sistemas de clasificación y estadificación de la endometriosis hacia un sistema universalmente aceptado.",
      "keywords": [
        "Endometriosis",
        "clasificación",
        "estadificación",
        "revisión_sistemática",
        "ginecología"
      ]
    },
    {
      "document_title": "Itinerario-problemas-digestivos-Experty.pdf",
      "document_id": "FUNC-063",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Itinerario práctico para el abordaje de problemas digestivos en consulta, desde la historia clínica hasta las intervenciones.",
      "keywords": [
        "Digestivo",
        "diagnóstico",
        "consulta",
        "itinerario",
        "salud_intestinal"
      ]
    },
    {
      "document_title": "PROBIOTICOS.pdf",
      "document_id": "FLORA-033",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la suplementación con probióticos para modular la disbiosis de la microbiota endocrina y de fertilidad.",
      "keywords": [
        "Probióticos",
        "microbiota",
        "disbiosis",
        "fertilidad",
        "endocrinología"
      ]
    },
    {
      "document_title": "disfuncionreproductivainmunogen2o18.pdf",
      "document_id": "FUNC-064",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Recomendación",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Recomendaciones para el estudio genético e inmunológico en la disfunción reproductiva.",
      "keywords": [
        "Genética",
        "inmunología",
        "infertilidad",
        "estudio",
        "recomendaciones"
      ]
    },
    {
      "document_title": "PIIS0015028215003799.pdf",
      "document_id": "FUNC-065",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía del Comité de Práctica de la ASRM sobre el tratamiento del hipotiroidismo subclínico en mujeres infértiles.",
      "keywords": [
        "Hipotiroidismo_subclínico",
        "infertilidad",
        "ASRM",
        "guía_clínica",
        "tiroides"
      ]
    },
    {
      "document_title": "Experty - Candidiasis Suplementación.pdf",
      "document_id": "FOOD-021",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía sobre suplementación con probióticos para candidiasis, revisando cepas y mecanismos de acción.",
      "keywords": [
        "Candidiasis",
        "probióticos",
        "suplementos",
        "cepas",
        "tratamiento"
      ]
    },
    {
      "document_title": "Disruptores Endocrinos_ Cómo Afectan tu Fertilidad y Cómo Protegerte.pdf",
      "document_id": "FUNC-066",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Información sobre qué son los disruptores endocrinos, dónde se encuentran y cómo afectan la fertilidad y el equilibrio hormonal.",
      "keywords": [
        "Disruptores_endocrinos",
        "fertilidad",
        "hormonas",
        "tóxicos",
        "prevención"
      ]
    },
    {
      "document_title": "FALLO OVARICO-ENFERMEDADES AUTOINMUNES.pdf",
      "document_id": "FLORA-034",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre las enfermedades autoinmunes en pacientes con Insuficiencia Ovárica Prematura (POI) y el estado actual del conocimiento.",
      "keywords": [
        "POI",
        "autoinmunidad",
        "fallo_ovárico",
        "enfermedades_autoinmunes",
        "revisión"
      ]
    },
    {
      "document_title": "Experty - Candidiasis - completo.pdf",
      "document_id": "FLORA-035",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía completa sobre la candidiasis intestinal, explicando la micobiota y su interacción con el huésped.",
      "keywords": [
        "Candidiasis",
        "micobiota",
        "intestinal",
        "hongos",
        "disbiosis"
      ]
    },
    {
      "document_title": "Experty - Candidiasis, registro síntomas.pdf",
      "document_id": "FLORA-036",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Paciente",
      "doc_type": "Registro",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Plantilla de registro de síntomas (digestivos, energía, ánimo) para el seguimiento de pacientes con candidiasis.",
      "keywords": [
        "Registro",
        "síntomas",
        "candidiasis",
        "seguimiento",
        "escala_Bristol"
      ]
    },
    {
      "document_title": "ESTRES.pdf",
      "document_id": "FLOW-005",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flow",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta para entender qué es el estrés, sus causas (epidemiología) y cómo afrontarlo.",
      "keywords": [
        "Estrés",
        "ansiedad",
        "psicología",
        "afrontamiento",
        "salud_mental"
      ]
    },
    {
      "document_title": "REVIEW REPORT_INFORMATION PROVISION.pdf",
      "document_id": "FUNC-067",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Reporte",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Reporte de revisión de las recomendaciones de buenas prácticas de la ESHRE sobre la provisión de información en donación reproductiva.",
      "keywords": [
        "Donación_reproductiva",
        "información",
        "ética",
        "gametos",
        "ESHRE"
      ]
    },
    {
      "document_title": "MICROBIOTA 2024.pdf",
      "document_id": "FLORA-037",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Documento sobre microbiota y salud intestinal (Contenido inferido).",
      "keywords": [
        "Microbiota",
        "salud_intestinal",
        "flora",
        "2024"
      ]
    },
    {
      "document_title": "WEB_E-Book-Enfermedad-Celiaca.pdf",
      "document_id": "FLORA-038",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Paciente",
      "doc_type": "Ebook",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Ebook resumen con información básica sobre el diagnóstico de la enfermedad celíaca y la dieta sin gluten.",
      "keywords": [
        "Celiaquía",
        "gluten",
        "dieta",
        "diagnóstico",
        "autoinmunidad"
      ]
    },
    {
      "document_title": "S1575092213000302.pdf",
      "document_id": "FUNC-068",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el hipertiroidismo y su manejo durante el embarazo.",
      "keywords": [
        "Hipertiroidismo",
        "embarazo",
        "tiroides",
        "enfermedad_Graves",
        "endocrinología"
      ]
    },
    {
      "document_title": "A new insight into the impact of systemic lupus erythematosus on oocyte and embryo development as well as female fertility.pdf",
      "document_id": "FLORA-039",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre el impacto del Lupus Eritematoso Sistémico (LES) en el desarrollo de ovocitos y embriones, así como en la fertilidad femenina.",
      "keywords": [
        "Lupus",
        "LES",
        "fertilidad",
        "ovocitos",
        "embriones"
      ]
    },
    {
      "document_title": "1-s2.0-S0015028217303515-main.pdf",
      "document_id": "FLORA-040",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo sobre el papel de las células Natural Killer (NK) y la interacción KIR-HLA en el fallo reproductivo recurrente.",
      "keywords": [
        "Células_NK",
        "KIR",
        "HLA",
        "inmunología",
        "fallo_reproductivo"
      ]
    },
    {
      "document_title": "FITOESTROGENOS 2.pdf",
      "document_id": "FOOD-022",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la ingesta de fitoestrógenos y otros factores dietéticos de riesgo para el bajo recuento y mala morfología espermática.",
      "keywords": [
        "Fitoestrógenos",
        "esperma",
        "fertilidad_masculina",
        "dieta",
        "morfología"
      ]
    },
    {
      "document_title": "REDUCIR-ULTRAPROCESADOS.pdf",
      "document_id": "FOOD-023",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta para identificar y reducir el consumo de alimentos ultraprocesados en la dieta.",
      "keywords": [
        "Ultraprocesados",
        "dieta",
        "alimentación_saludable",
        "salud",
        "nutrición"
      ]
    },
    {
      "document_title": "Dialnet-Cortisol-8741556.pdf",
      "document_id": "FUNC-069",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre las mediciones de laboratorio del cortisol y su aplicación clínica en el estudio del eje hipotálamo-hipófisis-adrenal.",
      "keywords": [
        "Cortisol",
        "laboratorio",
        "eje_HHA",
        "síndrome_Cushing",
        "insuficiencia_adrenal",
        "estrés"
      ]
    },
    {
      "document_title": "AUTOINMUNIDAD TIROIDEA Y FOP.pdf",
      "document_id": "FLORA-041",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la asociación entre la autoinmunidad tiroidea y un mayor riesgo de Insuficiencia Ovárica Prematura (POI).",
      "keywords": [
        "Autoinmunidad_tiroidea",
        "POI",
        "fallo_ovárico",
        "tiroides",
        "riesgo"
      ]
    },
    {
      "document_title": "3.Experty-SOP.pdf",
      "document_id": "FUNC-070",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta educativa sobre el Síndrome de Ovario Poliquístico (SOP), su definición y redefinición como Síndrome Metabólico Reproductivo.",
      "keywords": [
        "SOP",
        "ovario_poliquístico",
        "síndrome_metabólico",
        "andrógenos",
        "definición"
      ]
    },
    {
      "document_title": "XENOBIOTICOS.pdf",
      "document_id": "FUNC-071",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el declive de la fertilidad masculina y el impacto de los xenobióticos y toxinas ambientales.",
      "keywords": [
        "Xenobióticos",
        "fertilidad_masculina",
        "toxinas",
        "ambiente",
        "esperma"
      ]
    },
    {
      "document_title": "5.Experty-Endometriosis-definitivo.pdf",
      "document_id": "FUNC-072",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Herramienta",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta educativa definitiva sobre la endometriosis, explicando qué es, su naturaleza inflamatoria y hormono-dependiente.",
      "keywords": [
        "Endometriosis",
        "inflamación",
        "hormonas",
        "dolor",
        "definición"
      ]
    },
    {
      "document_title": "Epidemiological and Immune Profile Analysis of Italian Subjects with Endometriosis and Multiple Sclerosis.pdf",
      "document_id": "FLORA-042",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Análisis epidemiológico y del perfil inmunológico en sujetos italianos con endometriosis y esclerosis múltiple.",
      "keywords": [
        "Endometriosis",
        "esclerosis_múltiple",
        "inmunología",
        "perfil_inmune",
        "epidemiología"
      ]
    },
    {
      "document_title": "SUPLES.pdf",
      "document_id": "FOOD-024",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Evaluación crítica de la composición de suplementos dietéticos para la infertilidad masculina.",
      "keywords": [
        "Suplementos",
        "infertilidad_masculina",
        "nutrición",
        "composición",
        "eficacia"
      ]
    },
    {
      "document_title": "03_Hematologia_guia.pdf",
      "document_id": "FUNC-073",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de hematología sobre trombofilias hereditarias y adquiridas (SAF) y su papel en el fallo de implantación.",
      "keywords": [
        "Hematología",
        "trombofilia",
        "SAF",
        "fallo_implantación",
        "aborto"
      ]
    },
    {
      "document_title": "TIROIDITIS-AR.pdf",
      "document_id": "FLORA-043",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la relación entre la enfermedad tiroidea autoinmune y la artritis reumatoide.",
      "keywords": [
        "Tiroiditis",
        "artritis_reumatoide",
        "autoinmunidad",
        "reumatología",
        "tiroides"
      ]
    },
    {
      "document_title": "GDG and COI_b.pdf",
      "document_id": "FUNC-074",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Información sobre el grupo de desarrollo de la guía ESHRE para el manejo de la reproducción asistida en pacientes con infección viral.",
      "keywords": [
        "Reproducción_asistida",
        "virus",
        "infección",
        "ESHRE",
        "guía"
      ]
    },
    {
      "document_title": "e000840.full.pdf",
      "document_id": "FLORA-044",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo sobre lo que los reumatólogos necesitan saber sobre la infertilidad en el lupus eritematoso sistémico en la era de la reproducción asistida.",
      "keywords": [
        "Lupus",
        "LES",
        "infertilidad",
        "reumatología",
        "reproducción_asistida"
      ]
    },
    {
      "document_title": "Immunological and Metabolic Causes of Infertility in Polycystic Ovary Syndrome.pdf",
      "document_id": "FUNC-075",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo sobre las causas inmunológicas y metabólicas de la infertilidad en el Síndrome de Ovario Poliquístico (SOP).",
      "keywords": [
        "SOP",
        "inmunología",
        "metabolismo",
        "infertilidad",
        "inflamación"
      ]
    },
    {
      "document_title": "Thyroid autoimmunity and its negative impact on female fertility and maternal pregnancy outcomes.pdf",
      "document_id": "FLORA-045",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la autoinmunidad tiroidea y su impacto negativo en la fertilidad femenina y los resultados del embarazo.",
      "keywords": [
        "Autoinmunidad_tiroidea",
        "fertilidad",
        "embarazo",
        "tiroides",
        "anticuerpos"
      ]
    },
    {
      "document_title": "The effect of physical activity on fertility.pdf",
      "document_id": "FUNC-076",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Mini-revisión sobre el efecto de la actividad física en la fertilidad.",
      "keywords": [
        "Actividad_física",
        "fertilidad",
        "ejercicio",
        "estilo_de_vida",
        "revisión"
      ]
    },
    {
      "document_title": "Consejo preconcepcional en mujeres con Enfermedades reumatologicas sistemicas.pdf",
      "document_id": "FLORA-046",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo sobre el consejo preconcepcional en mujeres con enfermedades reumáticas autoinmunes sistémicas.",
      "keywords": [
        "Enfermedades_reumáticas",
        "consejo_preconcepcional",
        "autoinmunidad",
        "embarazo",
        "reumatología"
      ]
    },
    {
      "document_title": "Some aspects of interactivity between endocrine and immune systems required for successful reproduction.pdf",
      "document_id": "FUNC-077",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Investigación sobre la interacción entre los sistemas endocrino e inmune necesaria para una reproducción exitosa.",
      "keywords": [
        "Sistema_endocrino",
        "sistema_inmune",
        "reproducción",
        "interacción",
        "fertilidad"
      ]
    },
    {
      "document_title": "METABOLISMO de la PG.pdf",
      "document_id": "FUNC-078",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la farmacocinética de la progesterona, su historia, síntesis, clasificación y aplicaciones clínicas en ginecología y obstetricia.",
      "keywords": [
        "Progesterona",
        "farmacocinética",
        "gestágenos",
        "hormona",
        "endocrinología",
        "embarazo"
      ]
    },
    {
      "document_title": "EMS176148.pdf",
      "document_id": "FUNC-079",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la relación entre la actividad física y la fertilidad.",
      "keywords": [
        "Actividad_física",
        "fertilidad",
        "ejercicio",
        "salud_reproductiva"
      ]
    },
    {
      "document_title": "09_hiperplasia.pdf",
      "document_id": "FUNC-080",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Protocolo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Protocolo de diagnóstico y tratamiento de la hiperplasia suprarrenal congénita.",
      "keywords": [
        "Hiperplasia_suprarrenal",
        "endocrinología",
        "genética",
        "pediatría",
        "hormonas"
      ]
    },
    {
      "document_title": "GENERAL.pdf",
      "document_id": "FOOD-025",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Original",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre el impacto de la nutrición y el estilo de vida en la fertilidad masculina inexplicada.",
      "keywords": [
        "Nutrición",
        "estilo_de_vida",
        "fertilidad_masculina",
        "dieta",
        "esperma"
      ]
    },
    {
      "document_title": "EBOOK-EQUILIBRIO-HORMONAL-V3_CP.pdf",
      "document_id": "FUNC-081",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Ebook",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Ebook completo sobre el equilibrio hormonal femenino, explicando los cambios en las diferentes etapas de la vida y desórdenes comunes.",
      "keywords": [
        "Equilibrio_hormonal",
        "mujer",
        "ciclo_menstrual",
        "hormonas",
        "salud_femenina"
      ]
    },
    {
      "document_title": "Alimentacion_prebiotica_antiinflamatoria.pdf",
      "document_id": "FOOD-026",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía sobre alimentación prebiótica y antiinflamatoria, destacando el uso de fibra y suplementos para la salud intestinal.",
      "keywords": [
        "Alimentación_prebiótica",
        "antiinflamatoria",
        "fibra",
        "salud_intestinal",
        "dieta"
      ]
    },
    {
      "document_title": "02_ Inmunologia _ I _ guia.pdf",
      "document_id": "FLORA-047",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía introductoria sobre el sistema inmunitario en la reproducción humana y su implicación en técnicas de reproducción asistida.",
      "keywords": [
        "Inmunología",
        "reproducción",
        "sistema_inmune",
        "implantación",
        "embarazo"
      ]
    },
    {
      "document_title": "Immunological Risk Factors.pdf",
      "document_id": "FLORA-048",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre los factores de riesgo inmunológicos en el aborto recurrente, comparando guías clínicas con el estado del arte.",
      "keywords": [
        "Inmunología",
        "aborto_recurrente",
        "factores_riesgo",
        "guías_clínicas",
        "revisión"
      ]
    },
    {
      "document_title": "CARGA GLUCEMICA.pdf",
      "document_id": "FOOD-027",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio observacional sobre la ingesta de carbohidratos, la carga glucémica de la dieta y los resultados de la FIV.",
      "keywords": [
        "Carga_glucémica",
        "carbohidratos",
        "FIV",
        "dieta",
        "fertilidad"
      ]
    },
    {
      "document_title": "PROTOCOLO INMUNOLOGIA REPRODUCTIVA.pdf",
      "document_id": "FLORA-049",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Protocolo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Protocolo detallado de tratamientos en inmunología reproductiva, incluyendo corticosteroides e inmunoglobulinas.",
      "keywords": [
        "Inmunología",
        "protocolo",
        "corticosteroides",
        "inmunoglobulinas",
        "aborto_recurrente"
      ]
    },
    {
      "document_title": "ANTIOXIDANTES.pdf",
      "document_id": "FOOD-028",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el uso de antioxidantes dietéticos en el tratamiento de la infertilidad masculina para contrarrestar el estrés oxidativo.",
      "keywords": [
        "Antioxidantes",
        "infertilidad_masculina",
        "estrés_oxidativo",
        "dieta",
        "suplementos"
      ]
    },
    {
      "document_title": "ImpactofEatingHabits.pdf",
      "document_id": "FOOD-029",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre el impacto de los hábitos alimenticios y la actividad física en la fertilidad femenina.",
      "keywords": [
        "Hábitos_alimenticios",
        "actividad_física",
        "fertilidad_femenina",
        "dieta",
        "estilo_de_vida"
      ]
    },
    {
      "document_title": "Experty - intercambios proteína.pdf",
      "document_id": "FOOD-030",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Herramienta",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de intercambios de proteína vegetal, detallando cantidades y fuentes como legumbres, soja y frutos secos.",
      "keywords": [
        "Proteína_vegetal",
        "intercambios",
        "nutrición",
        "dieta_vegetariana",
        "alimentos"
      ]
    },
    {
      "document_title": "SAFy embarazo.pdf",
      "document_id": "FLORA-050",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Protocolo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Protocolo de medicina fetal sobre el manejo del Síndrome Antifosfolípido (SAF) durante el embarazo.",
      "keywords": [
        "SAF",
        "embarazo",
        "trombosis",
        "autoinmunidad",
        "protocolo"
      ]
    },
    {
      "document_title": "etj-ETJ512790.pdf",
      "document_id": "FUNC-082",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de la Asociación Europea de Tiroides (2021) sobre trastornos tiroideos antes y durante la reproducción asistida.",
      "keywords": [
        "Tiroides",
        "infertilidad",
        "reproducción_asistida",
        "guía_clínica",
        "ETA"
      ]
    },
    {
      "document_title": "Adeleke University...",
      "document_id": "FUNC-083",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Documento académico de la Universidad Adeleke (Contenido específico no visible en vista previa).",
      "keywords": [
        "Salud_pública",
        "académico",
        "investigación"
      ]
    },
    {
      "document_title": "64769-thyroxine-replacement-for-subfertile-females-with-subclinical-hypothyroidism-and-autoimmune-thyroiditis-a-systematic-review.pdf",
      "document_id": "FUNC-084",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Revisión_Sistemática",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sistemática sobre el reemplazo con tiroxina en mujeres subfértiles con hipotiroidismo subclínico y tiroiditis autoinmune.",
      "keywords": [
        "Tiroxina",
        "hipotiroidismo_subclínico",
        "tiroiditis_autoinmune",
        "infertilidad",
        "tratamiento"
      ]
    },
    {
      "document_title": "The Impacts of Inflammatory and Autoimmune Conditions on the Endometrium and Reproductive Outcomes.pdf",
      "document_id": "FLORA-051",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre los impactos de las condiciones inflamatorias y autoinmunes en el endometrio y los resultados reproductivos.",
      "keywords": [
        "Inflamación",
        "autoinmunidad",
        "endometrio",
        "reproducción",
        "fertilidad"
      ]
    },
    {
      "document_title": "Microbiota de la vagina.pdf",
      "document_id": "FLORA-052",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre la microbiota vaginal, su composición y relevancia clínica.",
      "keywords": [
        "Microbiota",
        "vagina",
        "flora_vaginal",
        "ginecología",
        "salud_femenina"
      ]
    },
    {
      "document_title": "Guia-Brenda-Ballell-ComoDisenaTuMenuSemanal.pdf",
      "document_id": "FOOD-031",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Guía",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía práctica para diseñar un menú semanal saludable y equilibrado, facilitando la organización y la compra.",
      "keywords": [
        "Menú_semanal",
        "planificación",
        "alimentación_saludable",
        "recetas",
        "organización"
      ]
    },
    {
      "document_title": "Experty-Recetario-Verano-Regalo.pdf",
      "document_id": "FOOD-032",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Recetario",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Recetario de verano con opciones saludables y refrescantes como gazpachos y ensaladas.",
      "keywords": [
        "Recetas",
        "verano",
        "gazpacho",
        "cocina_saludable",
        "alimentación"
      ]
    },
    {
      "document_title": "ESHRE_IVF_labs_guideline_15122015_FINAL.pdf",
      "document_id": "FUNC-085",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía revisada de la ESHRE (2015) sobre buenas prácticas en laboratorios de fecundación in vitro (FIV).",
      "keywords": [
        "Laboratorio_FIV",
        "buenas_prácticas",
        "embriología",
        "calidad",
        "ESHRE"
      ]
    },
    {
      "document_title": "LACTEOS.pdf",
      "document_id": "FOOD-033",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el impacto de la leche y los productos lácteos en el metabolismo de carbohidratos y la fertilidad en mujeres con SOP.",
      "keywords": [
        "Lácteos",
        "leche",
        "SOP",
        "dieta",
        "metabolismo"
      ]
    },
    {
      "document_title": "RESVERATROL.pdf",
      "document_id": "FOOD-034",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el papel del resveratrol (antioxidante) en la fertilidad masculina.",
      "keywords": [
        "Resveratrol",
        "antioxidantes",
        "fertilidad_masculina",
        "suplementos",
        "esperma"
      ]
    },
    {
      "document_title": "CLASSIFICATION SURVEY_REVIEW REPORT.pdf",
      "document_id": "FUNC-086",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Reporte",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Reporte de encuesta internacional sobre el conocimiento y uso de los sistemas de clasificación de la endometriosis.",
      "keywords": [
        "Endometriosis",
        "clasificación",
        "encuesta",
        "ginecología",
        "ESHRE"
      ]
    },
    {
      "document_title": "PCOS FISIOPATOLOGIA Y OPORTUNIDADES DE TRATAMIENTO.pdf",
      "document_id": "FUNC-087",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión especializada sobre la fisiopatología del Síndrome de Ovario Poliquístico (SOP) y las oportunidades terapéuticas.",
      "keywords": [
        "SOP",
        "fisiopatología",
        "tratamiento",
        "ovario_poliquístico",
        "endocrinología"
      ]
    },
    {
      "document_title": "FEMALE REPRODUCTIVE AXES.pdf",
      "document_id": "FUNC-088",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre los ejes de órganos del tracto reproductivo femenino, integrando microbiología e inmunología.",
      "keywords": [
        "Tracto_reproductivo",
        "ejes_órganos",
        "microbiología",
        "inmunología",
        "fisiología"
      ]
    },
    {
      "document_title": "DENSIDAD ENERGETICA.pdf",
      "document_id": "FOOD-035",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre la relación entre la densidad energética de la dieta y la fertilidad en mujeres.",
      "keywords": [
        "Densidad_energética",
        "dieta",
        "fertilidad",
        "nutrición",
        "epidemiología"
      ]
    },
    {
      "document_title": "CARGA GLUCEMICA.pdf",
      "document_id": "FOOD-036",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio observacional sobre la ingesta de carbohidratos, la carga glucémica de la dieta y los resultados de la FIV.",
      "keywords": [
        "Carga_glucémica",
        "carbohidratos",
        "FIV",
        "dieta",
        "fertilidad"
      ]
    },
    {
      "document_title": "PROTOCOLO INMUNOLOGIA REPRODUCTIVA.pdf",
      "document_id": "FLORA-053",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Protocolo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Protocolo detallado de tratamientos en inmunología reproductiva, incluyendo corticosteroides e inmunoglobulinas.",
      "keywords": [
        "Inmunología",
        "protocolo",
        "corticosteroides",
        "inmunoglobulinas",
        "aborto_recurrente"
      ]
    },
    {
      "document_title": "ANTIOXIDANTES.pdf",
      "document_id": "FOOD-037",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre el uso de antioxidantes dietéticos en el tratamiento de la infertilidad masculina para contrarrestar el estrés oxidativo.",
      "keywords": [
        "Antioxidantes",
        "infertilidad_masculina",
        "estrés_oxidativo",
        "dieta",
        "suplementos"
      ]
    },
    {
      "document_title": "ImpactofEatingHabits.pdf",
      "document_id": "FOOD-038",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre el impacto de los hábitos alimenticios y la actividad física en la fertilidad femenina.",
      "keywords": [
        "Hábitos_alimenticios",
        "actividad_física",
        "fertilidad_femenina",
        "dieta",
        "estilo_de_vida"
      ]
    },
    {
      "document_title": "Experty - intercambios proteína.pdf",
      "document_id": "FOOD-039",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Paciente",
      "doc_type": "Herramienta",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de intercambios de proteína vegetal, detallando cantidades y fuentes como legumbres, soja y frutos secos.",
      "keywords": [
        "Proteína_vegetal",
        "intercambios",
        "nutrición",
        "dieta_vegetariana",
        "alimentos"
      ]
    },
    {
      "document_title": "SAFy embarazo.pdf",
      "document_id": "FLORA-054",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Protocolo",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Protocolo de medicina fetal sobre el manejo del Síndrome Antifosfolípido (SAF) durante el embarazo.",
      "keywords": [
        "SAF",
        "embarazo",
        "trombosis",
        "autoinmunidad",
        "protocolo"
      ]
    },
    {
      "document_title": "etj-ETJ512790.pdf",
      "document_id": "FUNC-089",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de la Asociación Europea de Tiroides (2021) sobre trastornos tiroideos antes y durante la reproducción asistida.",
      "keywords": [
        "Tiroides",
        "infertilidad",
        "reproducción_asistida",
        "guía_clínica",
        "ETA"
      ]
    },
    {
      "document_title": "OBESIDAD.pdf",
      "document_id": "FOOD-040",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Food",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Estudio sobre las repercusiones negativas de la obesidad y la dieta occidental en la fisiología reproductiva masculina.",
      "keywords": [
        "Obesidad",
        "infertilidad_masculina",
        "dieta_occidental",
        "grasas",
        "fisiología"
      ]
    },
    {
      "document_title": "DR PUERMA. TIROIDES, FERTILIDAD Y EMBARAZO. EDICION 1.pdf",
      "document_id": "FUNC-090",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Libro",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Libro práctico para entender el funcionamiento de las hormonas tiroideas y sexuales, y su impacto en la fertilidad y el embarazo.",
      "keywords": [
        "Tiroides",
        "fertilidad",
        "embarazo",
        "hormonas",
        "hipotiroidismo"
      ]
    },
    {
      "document_title": "ESHRE FP patient Guideline_v2020_1.pdf",
      "document_id": "FUNC-091",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Guía_Paciente",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Folleto informativo para pacientes basado en la guía de la ESHRE sobre preservación de la fertilidad femenina.",
      "keywords": [
        "Preservación_fertilidad",
        "vitrificación",
        "ovocitos",
        "cáncer",
        "ESHRE"
      ]
    },
    {
      "document_title": "ABORDAJE-PNIE-EN-TRASTORNOS-DE-HORMONAS-SEXUALES.pdf",
      "document_id": "FUNC-092",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Presentación",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Material sobre el abordaje desde la Psiconeuroinmunoendocrinología (PNIE) de los trastornos de las hormonas sexuales y desórdenes de la fase folicular.",
      "keywords": [
        "PNIE",
        "hormonas_sexuales",
        "ciclo_menstrual",
        "fase_folicular",
        "integrativo"
      ]
    },
    {
      "document_title": "2.Experty-Ciclo-menstrual-definitivo.pdf",
      "document_id": "FUNC-093",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Herramienta",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta educativa definitiva sobre el ciclo menstrual, sus fases, signos de fertilidad y el Síndrome Premenstrual (SPM).",
      "keywords": [
        "Ciclo_menstrual",
        "SPM",
        "fertilidad",
        "hormonas",
        "autoconocimiento"
      ]
    },
    {
      "document_title": "4.Experty-AMENORREA HIPOTALAMICA FUNCIONAL -2.0.pdf",
      "document_id": "FUNC-094",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Paciente",
      "doc_type": "Herramienta",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Herramienta sobre la Amenorrea Hipotalámica Funcional, explicando sus causas, diagnóstico y la importancia del ciclo menstrual como signo vital.",
      "keywords": [
        "Amenorrea_hipotalámica",
        "ciclo_menstrual",
        "salud_femenina",
        "hormonas",
        "energía"
      ]
    },
    {
      "document_title": "Criteria, prevalence, and phenotypes of polycystic ovary sindrome..pdf",
      "document_id": "FUNC-095",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Científico",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo sobre los criterios diagnósticos, prevalencia y diferentes fenotipos del Síndrome de Ovario Poliquístico (SOP).",
      "keywords": [
        "SOP",
        "fenotipos",
        "criterios_Rotterdam",
        "prevalencia",
        "diagnóstico"
      ]
    },
    {
      "document_title": "DISRUPTORES ENDOCRINOS.pdf",
      "document_id": "FUNC-096",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Revisión sobre los disruptores endocrinos y su posible impacto sobre la salud humana, incluyendo la función hormonal.",
      "keywords": [
        "Disruptores_endocrinos",
        "salud_humana",
        "hormonas",
        "tóxicos",
        "revisión"
      ]
    },
    {
      "document_title": "jc.2017-00131.pdf",
      "document_id": "FUNC-097",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de práctica clínica de la Endocrine Society sobre el diagnóstico y tratamiento de la Amenorrea Hipotalámica Funcional.",
      "keywords": [
        "Amenorrea_hipotalámica",
        "guía_clínica",
        "Endocrine_Society",
        "diagnóstico",
        "tratamiento"
      ]
    },
    {
      "document_title": "GUIA LUPUS.pdf",
      "document_id": "FLORA-055",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Guía_Clínica",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Guía de Práctica Clínica del Sistema Nacional de Salud sobre el Lupus Eritematoso Sistémico.",
      "keywords": [
        "Lupus",
        "LES",
        "guía_clínica",
        "autoinmunidad",
        "tratamiento"
      ]
    },
    {
      "document_title": "S012181231830029X (1).pdf",
      "document_id": "FLORA-056",
      "document_author": "FertyFit",
      "pillar_category": "Pilar_Flora",
      "target_audience": "Profesional",
      "doc_type": "Artículo_Revisión",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Artículo de revisión sobre la interpretación de los autoanticuerpos en enfermedades reumatológicas.",
      "keywords": [
        "Autoanticuerpos",
        "reumatología",
        "diagnóstico",
        "autoinmunidad",
        "laboratorio"
      ]
    },
    {
      "document_title": "REVIEW REPORT_RIF_FINAL.pdf",
      "document_id": "FUNC-098",
      "document_author": "FertyFit",
      "pillar_category": "FUNCTION",
      "target_audience": "Profesional",
      "doc_type": "Reporte",
      "chapter": "",
      "chunk_id": null,
      "summary_short": "Reporte de revisión de las recomendaciones de buenas prácticas de la ESHRE sobre el fallo de implantación recurrente (RIF).",
      "keywords": [
        "Fallo_implantación",
        "RIF",
        "FIV",
        "ESHRE",
        "guía_clínica"
      ]
    }
  ]
];

// Aplanamos para obtener RawDocumentMetadata[] limpio
const rawDocuments: RawDocumentMetadata[] = rawDocumentsNested.flat();

/**
 * Mapa de nombres de pilar "humanos" → nombres alineados con el código
 *
 * En el código actual los pilares son:
 *  - FUNCTION | FOOD | FLORA | FLOW
 *
 * Aquí convertimos, por ejemplo:
 *  - "Pilar_Function"  → "FUNCTION"
 *  - "Pilar_Food"      → "FOOD"
 *  - "Pilar_Flora"     → "FLORA"
 *  - "Pilar_Flow"      → "FLOW"
 */
const PILLAR_CATEGORY_MAP: Record<string, PillarCategory> = {
  FUNCTION: 'FUNCTION',
  FOOD: 'FOOD',
  FLORA: 'FLORA',
  FLOW: 'FLOW',
  Pilar_Function: 'FUNCTION',
  Pilar_Food: 'FOOD',
  Pilar_Flora: 'FLORA',
  Pilar_Flow: 'FLOW',
};

function normalizePillarCategory(value: string | undefined, fallbackId: string): PillarCategory {
  if (value && PILLAR_CATEGORY_MAP[value]) {
    return PILLAR_CATEGORY_MAP[value];
  }

  // Si no tenemos un mapeo directo, intentamos inferir por prefijos sencillos
  const lower = (value || '').toLowerCase();
  if (lower.includes('function')) return 'FUNCTION';
  if (lower.includes('food') || lower.includes('nutrition')) return 'FOOD';
  if (lower.includes('flora') || lower.includes('microbiota')) return 'FLORA';
  if (lower.includes('flow') || lower.includes('sueño') || lower.includes('estrés')) return 'FLOW';

  // Fallback final: asignar FUNCTION y avisar por consola
  console.warn(
    `[WARN] pillar_category desconocido para document_id=${fallbackId}, valor="${value}". Asignando "FUNCTION" por defecto.`
  );
  return 'FUNCTION';
}

function normalizeChapter(chapter: string | null | undefined, documentTitle: string): string {
  if (chapter && chapter.trim().length > 0) {
    return chapter.trim();
  }

  // Si no hay chapter definido, usamos el título del documento sin extensión
  const baseTitle = documentTitle.replace(/\.[^.]+$/, '');
  return baseTitle.trim();
}

function normalizeDocuments(documents: RawDocumentMetadata[]): NormalizedDocumentMetadata[] {
  return documents.map((doc) => {
    const normalizedPillar = normalizePillarCategory(doc.pillar_category, doc.document_id);
    const normalizedChapter = normalizeChapter(doc.chapter, doc.document_title);

    const normalized: NormalizedDocumentMetadata = {
      ...doc,
      pillar_category: normalizedPillar,
      chapter: normalizedChapter,
      chunk_id: null, // A nivel de DOCUMENTO siempre null; se usará per-chunk más adelante
    };

    return normalized;
  });
}

function main() {
  const normalized = normalizeDocuments(rawDocuments);

  // Imprimimos el JSON bonito para que lo copies/pegues donde quieras
  const output = JSON.stringify(normalized, null, 2);
  // eslint-disable-next-line no-console
  console.log(output);
}

// Ejecutar solo si se llama directamente desde Node
if (import.meta.url === (typeof document === 'undefined' ? `file://${process.argv[1]}` : '')) {
  main();
}


