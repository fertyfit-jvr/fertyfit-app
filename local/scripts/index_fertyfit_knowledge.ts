/**
 * Indexador RAG FertyFit
 *
 * Lee metadatos normalizados de documentos, extrae texto de los PDFs,
 * genera embeddings con Gemini (text-embedding-004) e inserta los chunks
 * en la tabla fertyfit_knowledge de Supabase.
 *
 * NOTAS IMPORTANTES PARA EJECUTAR:
 * - Necesitas:
 *   - GEMINI_API_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - VITE_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL
 * - Debes tener instalado pdf-parse:
 *   npm install pdf-parse
 *
 * - Antes de ejecutar este script:
 *   1) Genera el JSON normalizado de documentos:
 *      npx ts-node local/scripts/normalize_documents_metadata.ts > local/documents_metadata.normalized.json
 *   2) Ajusta la constante PDF_BASE_DIR a la ruta real donde están los PDFs.
 *
 * - Para ejecutar (ejemplo con ts-node):
 *   npx ts-node local/scripts/index_fertyfit_knowledge.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// ------------------------------------------------------------
// Configuración básica
// ------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio base donde están los PDFs (AJUSTAR a tu estructura real)
// En tu caso, los PDFs están en: /Users/javiermkt/Documents/docs_fertyfit
// Usamos la ruta absoluta para evitar dudas con el cwd.
const PDF_BASE_DIR = '/Users/javiermkt/Documents/docs_fertyfit';

// Ruta al JSON de metadatos normalizados
const METADATA_JSON_PATH = path.join(process.cwd(), 'local', 'documents_metadata.normalized.json');

// Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY no está definida en las variables de entorno');
}

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// Supabase (usar SERVICE ROLE como en api/analysis/report-extended.ts)
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

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

type PillarCategory = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

type NormalizedDocumentMetadata = {
  document_title: string;
  document_id: string;
  document_author: string;
  pillar_category: PillarCategory;
  target_audience: string;
  doc_type: string;
  chapter: string;
  chunk_id: number | null;
  summary_short: string;
  keywords: string[];
  // Campos opcionales añadibles sin romper nada
  file_path?: string;
  language?: string;
  [key: string]: any;
};

type KnowledgeRow = {
  document_id: string;
  chunk_id: number;
  content_chunk: string;
  embedding: number[];
  metadata_json: Record<string, any>;
};

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

async function loadDocumentsMetadata(): Promise<NormalizedDocumentMetadata[]> {
  const raw = await fs.readFile(METADATA_JSON_PATH, 'utf8');
  const data = JSON.parse(raw) as NormalizedDocumentMetadata[];
  return data;
}

async function extractTextFromPdf(pdfPath: string): Promise<string> {
  const buffer = await fs.readFile(pdfPath);
  // Carga dinámica para funcionar bien con CJS + ESM
  const pdfParseModule = (await import('pdf-parse')) as any;
  const candidates = [
    pdfParseModule,
    pdfParseModule.default,
    pdfParseModule.default?.default,
  ];
  const pdfParseFn = candidates.find((c) => typeof c === 'function');
  if (!pdfParseFn) {
    throw new Error('No se pudo resolver la función pdf-parse');
  }
  const data = await (pdfParseFn as (buf: Buffer) => Promise<{ text: string }>)(buffer);
  // Normalizamos saltos de línea para facilitar el chunking
  return data.text.replace(/\r\n/g, '\n');
}

/**
 * Divide un texto largo en chunks de tamaño aproximado en palabras,
 * con un porcentaje de solape entre chunks consecutivos.
 */
function splitIntoChunks(
  fullText: string,
  maxWords = 800,
  overlapWords = 150
): string[] {
  const words = fullText
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  if (words.length === 0) {
    return chunks;
  }

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push(chunkWords.join(' '));

    if (end === words.length) {
      break;
    }

    // Retrocedemos overlapWords para mantener solape
    start = Math.max(0, end - overlapWords);
  }

  return chunks;
}

async function embedTextWithGemini(text: string): Promise<number[]> {
  const resp = await genAI.models.embedContent({
    model: 'text-embedding-004',
    content: text,
  } as any);

  const embedding = (resp as any).embedding?.values as number[] | undefined;
  if (!embedding || embedding.length === 0) {
    throw new Error('Embedding vacío devuelto por Gemini');
  }
  return embedding;
}

async function insertRowsInBatches(rows: KnowledgeRow[], batchSize = 100) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { error } = await supabase
      .from('fertyfit_knowledge')
      .insert(
        batch.map((r) => ({
          document_id: r.document_id,
          chunk_id: r.chunk_id,
          content_chunk: r.content_chunk,
          embedding: r.embedding,
          metadata_json: r.metadata_json,
        }))
      );

    if (error) {
      console.error('Error al insertar batch en fertyfit_knowledge:', error);
      throw error;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[OK] Insertado batch de ${batch.length} filas (progreso: ${Math.min(
        rows.length,
        i + batch.length
      )}/${rows.length})`
    );
  }
}

// ------------------------------------------------------------
// Proceso principal
// ------------------------------------------------------------

async function indexDocument(doc: NormalizedDocumentMetadata): Promise<void> {
  // Usamos document_title como nombre de archivo principal,
  // y dejamos file_path como override opcional si en el futuro lo añadimos al JSON.
  const pdfFileName = doc.file_path || doc.document_title;
  const pdfPath = path.join(PDF_BASE_DIR, pdfFileName);

  // eslint-disable-next-line no-console
  console.log(`\n[Indexando] ${doc.document_id} → ${pdfPath}`);

  const fullText = await extractTextFromPdf(pdfPath);

  if (!fullText || fullText.trim().length === 0) {
    console.warn(`[WARN] Documento sin texto extraíble: ${doc.document_id}`);
    return;
  }

  const chunks = splitIntoChunks(fullText, 800, 150);

  // eslint-disable-next-line no-console
  console.log(
    `[Chunks] Documento ${doc.document_id}: ${chunks.length} chunks generados`
  );

  const rows: KnowledgeRow[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const content_chunk = chunks[i];

    // Pequeña protección para textos demasiado cortos
    if (content_chunk.split(/\s+/).length < 20) {
      continue;
    }

    const embedding = await embedTextWithGemini(content_chunk);

    rows.push({
      document_id: doc.document_id,
      chunk_id: i + 1,
      content_chunk,
      metadata_json: {
        ...doc,
        chunk_index: i + 1,
        chunk_length_chars: content_chunk.length,
        chunk_length_words: content_chunk.split(/\s+/).length,
      },
      embedding,
    });
  }

  if (rows.length === 0) {
    console.warn(
      `[WARN] No se generaron filas válidas para document_id=${doc.document_id}`
    );
    return;
  }

  await insertRowsInBatches(rows, 100);
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Cargando metadatos normalizados...');
  const docs = await loadDocumentsMetadata();

  // eslint-disable-next-line no-console
  console.log(`Total de documentos a indexar: ${docs.length}`);

  // Para pruebas iniciales, puedes limitar a los primeros N
  const limitEnv = process.env.RAG_INDEX_LIMIT
    ? parseInt(process.env.RAG_INDEX_LIMIT, 10)
    : undefined;

  const docsToProcess = limitEnv ? docs.slice(0, limitEnv) : docs;

  for (const doc of docsToProcess) {
    try {
      await indexDocument(doc);
    } catch (err) {
      console.error(
        `[ERROR] Fallo al indexar document_id=${doc.document_id}:`,
        err
      );
      // Decisión: seguimos con el siguiente documento en vez de abortar todo
    }
  }

  // eslint-disable-next-line no-console
  console.log('Indexación completada');
}

// Ejecutar solo si se llama directamente desde Node / ts-node
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}


