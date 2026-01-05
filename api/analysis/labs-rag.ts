import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ai } from '../../server/lib/ai.js';
import { applySecurityHeaders } from '../../server/lib/security.js';
import { sendErrorResponse, createError } from '../../server/lib/errorHandler.js';
import { searchRagDirect } from '../../server/lib/ragUtils.js';
import { logger } from '../../server/lib/logger.js';

type PillarCategory = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

type LabsRagRequest = {
  userId: string;
  labs?: {
    amh?: number;
    fsh?: number;
    lh?: number;
    estradiol?: number;
    prolactina?: number;
    tsh?: number;
    t4?: number;
    t3?: number;
    [key: string]: number | undefined;
  };
  image?: string; // Imagen base64 opcional para ecografías
  examType?: string; // Tipo de examen detectado
  filters?: {
    pillar_category?: PillarCategory;
  };
};

type LabsRagResponse = {
  explanation: string;
  rawLabs: Record<string, number | undefined>;
  rag_used: boolean;
  rag_chunks_count: number;
  context_used?: {
    chunks: Array<{ content: string; metadata: Record<string, any> }>;
  };
};

// Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL o SERVICE ROLE KEY no están configuradas en las variables de entorno');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Helper CORS
function setCORSHeaders(res: VercelResponse, origin: string): string {
  const isLocalhost =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('0.0.0.0');

  const allowedOrigins = [
    'https://method.fertyfit.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
  ];

  let allowedOrigin: string;
  if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
  } else if (isLocalhost) {
    allowedOrigin = origin;
  } else {
    allowedOrigin = 'https://method.fertyfit.com';
  }

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  return allowedOrigin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS primero
  const origin = (req.headers.origin as string) || '';
  setCORSHeaders(res, origin);

  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.setHeader('Content-Length', '0');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.end();
  }

  try {
    // Seguridad después de CORS
    applySecurityHeaders(res);
    setCORSHeaders(res, origin);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, labs, image, examType, filters }: LabsRagRequest = req.body || {};

    if (!userId) {
      throw createError('Falta el userId en la solicitud', 400, 'BAD_REQUEST');
    }

    // Validar que haya labs o imagen
    if ((!labs || Object.keys(labs).length === 0) && !image) {
      throw createError('Faltan los valores de analítica o imagen en la solicitud', 400, 'BAD_REQUEST');
    }

    // (Opcional) Cargar perfil básico para contexto (edad)
    let age = 0;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('age')
        .eq('id', userId)
        .single();

      if (profile?.age) {
        age = profile.age;
      }
    } catch (profileError) {
      // Si falla, continuamos sin edad
      logger.warn('No se pudo cargar la edad del perfil:', profileError);
    }

    // Obtener contexto RAG sobre analíticas
    let ragContext = '';
    let ragChunks: Array<{ content: string; metadata: Record<string, any> }> = [];
    let ragUsed = false;
    let ragChunksCount = 0;

    try {
      // Construir query para RAG
      let ragQuery: string;
      if (image && examType) {
        // Si hay imagen, buscar contexto sobre ese tipo de examen
        ragQuery = `contexto sobre interpretación de ${examType} y análisis de imágenes médicas de fertilidad para una mujer de ${age || 'edad no especificada'} años`;
      } else if (labs && Object.keys(labs).length > 0) {
        // Si hay valores de laboratorio
        const labValues = Object.entries(labs)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        ragQuery = `contexto sobre interpretación general de analíticas de fertilidad (${labValues}) para una mujer de ${age || 'edad no especificada'} años`;
      } else {
        // Fallback genérico
        ragQuery = `contexto sobre interpretación de exámenes médicos de fertilidad para una mujer de ${age || 'edad no especificada'} años`;
      }

      logger.log(`[RAG] Buscando contexto para ${examType || 'examen médico'} de paciente ${age || 'edad no especificada'} años`);
      logger.log(`[RAG] Query: "${ragQuery.substring(0, 100)}..."`);
      logger.log(`[RAG] Buscando sin filtros restrictivos (todos los documentos)`);

      // Buscar sin filtros restrictivos - los documentos no tienen doc_type='Analitica' exacto
      // Solo aplicar pillar_category si se especifica explícitamente
      ragChunks = await searchRagDirect(ragQuery, 
        filters?.pillar_category ? { pillar_category: filters.pillar_category } : undefined, 
        5
      );
      
      logger.log(`[RAG] Chunks recibidos: ${ragChunks.length}`);
      
      if (ragChunks.length > 0) {
        ragChunksCount = ragChunks.length;
        ragContext = ragChunks.map((c) => c.content).join('\n\n');
        ragUsed = ragContext.length > 0;
        
        if (ragUsed) {
          logger.log(`✅ RAG usado en analíticas: ${ragChunksCount} chunks encontrados para labs: ${labValues.substring(0, 100)}...`);
        }
      } else {
        logger.warn(`⚠️ RAG NO disponible en analíticas: No se encontraron chunks para labs: ${labValues.substring(0, 100)}...`);
      }
    } catch (ragError: any) {
      // Si falla el RAG, continuamos sin él
      logger.error('❌ RAG EXCEPTION en analíticas:', ragError?.message || ragError);
      logger.error('Stack:', ragError?.stack);
    }

    // Construir prompt para Gemini
    const prompt = `
Eres experto en fertilidad siguiendo la metodología FertyFit.

IMPORTANTE: Escribe la explicación en formato Markdown. Usa:
- **texto** para negritas y énfasis
- *texto* para cursivas
- Formatea los párrafos de manera clara

${ragContext ? `IMPORTANTE: Solo puedes usar la información del siguiente contexto, que proviene de la metodología FertyFit.
NO uses conocimiento general que no esté en este contexto.
Si la información no está en este contexto, dilo explícitamente.

CONTEXTO MÉDICO FERTYFIT (${ragChunksCount} fragmentos de documentación):
${ragContext}

FUENTES CONSULTADAS:
${ragChunks.map((c, idx) => 
  `${idx + 1}. ${c.metadata?.document_title || 'Documento sin título'} (ID: ${c.metadata?.document_id || 'N/A'})`
).join('\n')}

` : ''}${image ? `
IMAGEN DEL EXAMEN:
Analiza la imagen proporcionada. Si es una ecografía o imagen médica:
- Describe los hallazgos visuales más relevantes (estructuras visibles, medidas, características)
- Interpreta según la metodología FertyFit
- Explica las implicaciones para la fertilidad
- Si hay texto en la imagen, inclúyelo en el análisis

` : ''}${labs && Object.keys(labs).length > 0 ? `
RESULTADOS ANALÍTICOS DE LA PACIENTE:
${JSON.stringify({ labs, age: age || undefined }, null, 2)}

` : ''}TAREA:
Escribe una explicación CONCISA en formato Markdown (máximo 3 párrafos breves, cada uno máximo 4-5 líneas) que incluya:

**1. Interpretación de los resultados/imagen**
   - Qué significan los valores o hallazgos visuales
   - Implicaciones en fertilidad según metodología FertyFit

**2. Contexto y relevancia**
   - Por qué estos resultados son importantes
   - Cómo se relacionan con la salud reproductiva

**3. Próximos pasos**
   - Qué preguntas puede hacer a su médico
   - Qué aspectos debe comentar en su próxima consulta

${ragContext ? `\nIMPORTANTE: Al final de la explicación, incluye una línea breve con las fuentes consultadas:
"Fuentes: ${ragChunks.map(c => c.metadata?.document_title || 'Documento').join(', ')}"` : ''}

INSTRUCCIONES:
- Máximo 3 párrafos breves (cada párrafo máximo 4-5 líneas)
- Sé CONCISO y ve directo al punto
- No hagas recomendaciones médicas directas ni ajustes de medicación
- ${ragContext ? 'Solo usa información del contexto FertyFit proporcionado.' : 'Sé claro y educativo.'}
- Escribe TODO en español y dirigido en segunda persona ("tú")
- Si es una ecografía o imagen médica, enfócate en los hallazgos visuales más relevantes
- Si el tipo de examen no está en el contexto FertyFit, explica de forma general pero educativa
- IMPORTANTE: Usa solo sintaxis Markdown estándar. No uses HTML.
`;

    // Si hay imagen, incluirla en el contenido
    const contents = image 
      ? [
          { text: prompt },
          {
            inlineData: {
              data: image.split(',')[1], // Remover data URL prefix
              mimeType: 'image/jpeg',
            },
          },
        ]
      : [{ text: prompt }];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    } as any);

    // Validar respuesta de Gemini de forma segura (preservar contexto RAG)
    let explanation: string;
    if (response && typeof response === 'object') {
      const responseText = (response as { text?: string }).text;
      if (typeof responseText === 'string' && responseText.length > 0) {
        explanation = responseText;
      } else {
        logger.error('❌ Respuesta de Gemini sin texto válido:', {
          hasText: 'text' in response,
          textType: typeof (response as { text?: unknown }).text,
          responseKeys: Object.keys(response),
        });
        explanation = 'No se pudo generar la explicación. Por favor, intenta de nuevo.';
      }
    } else {
      logger.error('❌ Respuesta de Gemini inválida:', typeof response);
      explanation = 'No se pudo generar la explicación. Por favor, intenta de nuevo.';
    }

    // Guardar la explicación en notifications
    try {
      const labNames = labs && Object.keys(labs).length > 0 
        ? Object.keys(labs).join(', ')
        : examType || 'examen médico';
      const { error: saveError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'LABS',
          title: `Análisis de ${labNames}`,
          message: explanation,
          priority: 1,
          is_read: false,
          metadata: {
            format: 'markdown',
            input: { userId, labs, image: image ? 'provided' : undefined, examType, age: age || undefined },
            sources: ragChunks.map((c) => ({
              document_id: c.metadata?.document_id || '',
              document_title: c.metadata?.document_title || '',
              chunk_index: c.metadata?.chunk_index || 0,
            })),
            rag_used: ragUsed,
            rag_chunks_count: ragChunksCount,
            rag_context_length: ragContext.length,
            generated_at: new Date().toISOString(),
          },
        });

      if (saveError) {
        logger.warn('No se pudo guardar la explicación en notifications:', saveError);
        // No fallamos la request si falla el guardado
      }
    } catch (saveError) {
      logger.warn('Error al guardar explicación en notifications:', saveError);
      // No fallamos la request si falla el guardado
    }

    const responseData: LabsRagResponse = {
      explanation,
      rawLabs: labs || {},
      rag_used: ragUsed,
      rag_chunks_count: ragChunksCount,
      ...(ragChunks.length > 0 && {
        context_used: {
          chunks: ragChunks.map((c) => ({
            content: c.content,
            metadata: c.metadata || {},
          })),
        },
      }),
    };

    return res.status(200).json(responseData);
  } catch (error) {
    setCORSHeaders(res, origin);
    sendErrorResponse(res, error, req);
  }
}

