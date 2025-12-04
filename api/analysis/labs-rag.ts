import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ai } from '../lib/ai.js';
import { applySecurityHeaders } from '../lib/security.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';

type PillarCategory = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

type LabsRagRequest = {
  userId: string;
  labs: {
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

    const { userId, labs, filters }: LabsRagRequest = req.body || {};

    if (!userId) {
      throw createError('Falta el userId en la solicitud', 400, 'BAD_REQUEST');
    }

    if (!labs || Object.keys(labs).length === 0) {
      throw createError('Faltan los valores de analítica en la solicitud', 400, 'BAD_REQUEST');
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
      console.warn('No se pudo cargar la edad del perfil:', profileError);
    }

    // Obtener contexto RAG sobre analíticas
    let ragContext = '';
    let ragChunks: Array<{ content: string; metadata: Record<string, any> }> = [];
    let ragUsed = false;
    let ragChunksCount = 0;

    try {
      const vercelUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      // Construir query para RAG basada en los valores de analítica
      const labValues = Object.entries(labs)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      const ragQuery = `contexto sobre interpretación general de analíticas de fertilidad (${labValues}) para una mujer de ${age || 'edad no especificada'} años`;

      const ragResponse = await fetch(`${vercelUrl}/api/knowledge/search-rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: ragQuery,
          filters: {
            doc_type: 'Analitica',
            pillar_category: filters?.pillar_category || 'FUNCTION',
          },
          limit: 5,
        }),
      });

      if (ragResponse.ok) {
        const ragData = (await ragResponse.json()) as {
          chunks?: Array<{ content: string; metadata: Record<string, any> }>;
        };
        if (ragData.chunks && ragData.chunks.length > 0) {
          ragChunks = ragData.chunks;
          ragChunksCount = ragData.chunks.length;
          ragContext = ragData.chunks.map((c) => c.content).join('\n\n');
          ragUsed = ragContext.length > 0;
          
          if (ragUsed) {
            console.log(`✅ RAG usado en analíticas: ${ragChunksCount} chunks encontrados para labs: ${labValues.substring(0, 100)}...`);
          }
        } else {
          console.warn(`⚠️ RAG NO disponible en analíticas: No se encontraron chunks para labs: ${labValues.substring(0, 100)}...`);
        }
      } else {
        console.warn(`⚠️ RAG NO disponible en analíticas: Error en respuesta RAG (status: ${ragResponse.status})`);
      }
    } catch (ragError) {
      // Si falla el RAG, continuamos sin él
      console.warn('⚠️ RAG NO disponible en analíticas - Error al obtener contexto RAG:', ragError);
    }

    // Construir prompt para Gemini
    const prompt = `
Eres experto en fertilidad siguiendo la metodología FertyFit.

${ragContext ? `IMPORTANTE: Solo puedes usar la información del siguiente contexto, que proviene de la metodología FertyFit.
NO uses conocimiento general que no esté en este contexto.
Si la información no está en este contexto, dilo explícitamente.

CONTEXTO MÉDICO FERTYFIT (${ragChunksCount} fragmentos de documentación):
${ragContext}

` : ''}RESULTADOS ANALÍTICOS DE LA PACIENTE:
${JSON.stringify({ labs, age: age || undefined }, null, 2)}

TAREA:
- Explica qué significan los valores de forma general (no es un diagnóstico médico individualizado).
- Comenta posibles implicaciones en fertilidad a nivel educativo.
- Sugiere preguntas que la paciente puede hacer a su médico.
- No hagas recomendaciones médicas directas ni ajustes de medicación.
- ${ragContext ? 'Recuerda: Solo usa la información del contexto FertyFit proporcionado arriba.' : 'Sé claro y educativo.'}
- Escribe TODO en español y dirigido en segunda persona ("tú").
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
      ],
    } as any);

    const explanation = (response as any).text ?? 'No se pudo generar la explicación.';

    // Guardar la explicación en notifications
    try {
      const labNames = Object.keys(labs).join(', ');
      const { error: saveError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'LABS',
          title: `Análisis de analíticas - ${labNames}`,
          message: explanation,
          priority: 1,
          is_read: false,
          metadata: {
            input: { userId, labs, age: age || undefined },
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
        console.warn('No se pudo guardar la explicación en notifications:', saveError);
        // No fallamos la request si falla el guardado
      }
    } catch (saveError) {
      console.warn('Error al guardar explicación en notifications:', saveError);
      // No fallamos la request si falla el guardado
    }

    const responseData: LabsRagResponse = {
      explanation,
      rawLabs: labs,
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

