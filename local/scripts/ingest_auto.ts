/**
 * Ingestor Automático FertyFit (Full Gemini Version)
 * 
 * ESTRATEGIA:
 * 1. Gemini (1.5 Flash) -> Análisis y Metadatos (JSON).
 * 2. Gemini (text-embedding-004) -> Embeddings (768d).
 * 
 * - Pausa de 20s entre archivos para estabilidad total.
 * - Fuerza carga de .env para evitar conflictos de terminal.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- SETUP ENV ----
const envPath = path.resolve(process.cwd(), '.env');
// override: true es CRITICO para ignorar variables de entorno basura en la terminal
dotenv.config({ path: envPath, override: true });

// Keys
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API)?.trim();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error("❌ Faltan variables en .env (GEMINI_API_KEY, SUPABASE_URL, o SUPABASE_KEY)");
    process.exit(1);
}

// Configs
const INGEST_DIR = path.join(process.cwd(), 'local/ingest');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Models
const MODEL_GEN = 'gemini-2.0-flash';
const MODEL_EMBED = 'text-embedding-004';

// Types
type Pillar = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

interface AnalyzedMetadata {
    semantic_filename: string;
    document_title: string;
    document_author: string;
    pillar_category: Pillar;
    doc_type: string;
    target_audience: string;
    summary_short: string;
    keywords: string[];
}

// ---- UTILS ----

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function generateContentGemini(prompt: string, retryCount = 0): Promise<string> {
    const maxRetries = 10;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_GEN}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
        })
    });

    if (response.status === 429 && retryCount < maxRetries) {
        const waitTime = Math.pow(2, retryCount + 1) * 15000; // 30s, 60s, 120s...
        console.log(`      ⚠️ Gemini Gen Limit (429). Reintentando en ${waitTime / 1000}s...`);
        await sleep(waitTime);
        return generateContentGemini(prompt, retryCount + 1);
    }

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Gemini Gen Error ${response.status}: ${txt}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function embedContentREST(text: string, retryCount = 0): Promise<number[]> {
    const maxRetries = 3;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_EMBED}:embedContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: { parts: [{ text: text }] }
        })
    });

    if (response.status === 429 && retryCount < maxRetries) {
        const waitTime = Math.pow(2, retryCount + 1) * 10000; // 20s, 40s, 80s...
        console.log(`      ⚠️ Gemini Embed Limit (429). Esperando ${waitTime / 1000}s...`);
        await sleep(waitTime);
        return embedContentREST(text, retryCount + 1);
    }

    if (!response.ok) {
        throw new Error(`Gemini Embed Error ${response.status}`);
    }

    const data = await response.json();
    const values = data.embedding?.values;
    if (!values) throw new Error("No embedding returned");
    return values;
}

async function testConnection() {
    console.log("➡️  Probando conexión centralizada Gemini...");
    try {
        await generateContentGemini('Responde JSON: {"status":"OK"}');
        await embedContentREST("test");
        console.log(`   ✅ Gemini OK (Análisis y Embeddings).`);
    } catch (e: any) {
        console.error(`   ❌ FALLO CONEXIÓN: ${e.message}`);
        process.exit(1);
    }
}

// ---- ANALIZADOR ----

async function extractTextFromPdf(pdfPath: string): Promise<string> {
    const buffer = await fs.readFile(pdfPath);
    try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        return data.text.replace(/\r\n/g, '\n');
    } catch (e) {
        const require = createRequire(import.meta.url);
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text.replace(/\r\n/g, '\n');
    }
}

async function analyzeDocument(text: string, originalFilename: string): Promise<AnalyzedMetadata> {
    const contextText = text.substring(0, 15000);

    const prompt = `
    Analiza este texto médico extraído de un PDF y extrae los metadatos requeridos EN FORMATO JSON.
    Si no encuentras un valor claro, usa "Desconocido" o el nombre original.

    CAMPOS REQUERIDOS:
    - semantic_filename: Nombre descriptivo en 'snake_case', sin extensión (.pdf), basado en el tema.
    - document_title: Título formal del documento.
    - pillar_category: ESTRICTAMENTE uno de: FUNCTION, FOOD, FLORA o FLOW.
    - document_author: Autor o Institución.
    - summary_short: Resumen de 1-2 frases en español.

    Nombre de archivo original: "${originalFilename}"
    
    TEXTO PARA ANALIZAR:
    ${contextText}
    `;

    let jsonText = await generateContentGemini(prompt);
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonText);
}

// ---- PROCESAMIENTO ----

async function processFile(filename: string) {
    const fullPath = path.join(INGEST_DIR, filename);
    console.log(`\n📄 Procesando: ${filename}`);

    try {
        // --- DUPE CHECK INICIAL (Para ahorrar tiempo y API) ---
        const { data: earlyCheck } = await supabase.from('fertyfit_knowledge').select('id').ilike('document_id', filename).limit(1);
        if (earlyCheck && earlyCheck.length > 0) {
            console.log(`   ⏭️  Documento '${filename}' ya existe. Saltando.`);
            return;
        }

        const text = await extractTextFromPdf(fullPath);
        if (!text || text.length < 50) return;

        console.log(`   🧠 Esperando turno para análisis (10s)...`);
        await sleep(10000);
        console.log(`   🧠 Analizando con Gemini...`);
        let metadata = await analyzeDocument(text, filename);

        // --- VALIDACIÓN Y FALLBACKS ---
        if (!metadata.semantic_filename || metadata.semantic_filename === 'undefined') {
            const safeBase = filename.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-0]/g, '_');
            metadata.semantic_filename = safeBase || 'documento_sin_nombre';
        }
        if (!metadata.document_title || metadata.document_title === 'undefined') {
            metadata.document_title = filename;
        }
        if (!metadata.pillar_category) {
            metadata.pillar_category = 'FUNCTION';
        }

        console.log(`      → [${metadata.pillar_category}] ${metadata.document_title}`);

        let finalName = `${metadata.semantic_filename}.pdf`;
        let destPath = path.join(INGEST_DIR, finalName);

        if (finalName.toLowerCase() !== filename.toLowerCase()) {
            try {
                await fs.access(destPath);
                // Si el nombre ya existe y NO es el archivo actual, añadimos sufijo
                finalName = `${metadata.semantic_filename}_${Math.floor(Math.random() * 1000)}.pdf`;
                destPath = path.join(INGEST_DIR, finalName);
            } catch (e) { }

            await fs.rename(fullPath, destPath);
            console.log(`   🔄 Renombrado a: ${finalName}`);
        }


        console.log(`   📚 Indexando embeddings...`);
        const words = text.split(/\s+/).filter(Boolean);
        const chunks = [];
        for (let i = 0; i < words.length; i += 700) {
            chunks.push(words.slice(i, i + 800).join(' '));
        }

        const rows = [];
        for (let i = 0; i < chunks.length; i++) {
            const vector = await embedContentREST(chunks[i]);
            rows.push({
                document_id: finalName,
                chunk_id: i + 1,
                content_chunk: chunks[i],
                embedding: vector,
                metadata_json: { ...metadata, chunk_index: i + 1 }
            });
            await sleep(1000); // 1s para evitar 429
        }

        const { error } = await supabase.from('fertyfit_knowledge').insert(rows);
        if (error) throw error;

        console.log(`   ✨ ¡Éxito! Indexados ${rows.length} trozos.`);
        console.log(`   ⏳ Pausa de seguridad (35 segundos)...`);
        await sleep(35000);

    } catch (err: any) {
        console.error(`❌ ERROR: ${err.message}`);
    }
}

async function main() {
    console.log("=== FertyFit Auto Ingestor (Full Gemini) ===");
    await testConnection();

    const pdfs = (await fs.readdir(INGEST_DIR)).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
    console.log(`📂 Encontrados ${pdfs.length} documentos.`);

    for (const pdf of pdfs) {
        await processFile(pdf);
    }
    console.log("\n✅ FIN DEL PROCESO.");
}

main();
