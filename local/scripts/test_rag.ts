
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function listAvailableModels() {
    try {
        console.log('Listing available models...');
        // SDK might not have listModels exposed easily on instance depending on version
        // Trying direct fetch for list models as fallback or if SDK supports it
        // The sdk usually has ai.models.list()
        const resp = await (ai as any).models.list();
        console.log('Available models:', resp?.models?.map((m: any) => m.name));
    } catch (e: any) {
        console.error('Error listing models:', e.message);
    }
}

async function embedQuery(query: string): Promise<number[]> {
    await listAvailableModels();
    try {
        console.log('Generating embedding using GoogleGenAI SDK (text-embedding-004)...');
        const resp = await (ai as any).models.embedContent({
            model: 'models/text-embedding-004',
            contents: [query],
        });
        const values = resp?.embeddings?.[0]?.values;
        if (!values) throw new Error('No embedding values returned');
        return values;
    } catch (error: any) {
        console.error('Embedding Error:', error?.message || error);
        return [];
    }
}

async function testRag() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    const testQuery = "hormonas fertilidad FSH LH estradiol prolactina tiroides";
    console.log(`Testing RAG with query: "${testQuery}"`);

    const embedding = await embedQuery(testQuery);
    console.log(`Embedding generated: ${embedding.length} dimensions`);

    if (embedding.length === 0) {
        console.error('Failed to generate embedding, aborting search');
        return;
    }

    const { data, error } = await supabase.rpc('match_fertyfit_knowledge', {
        query_embedding: embedding,
        match_count: 15,
        filter_pillar_category: null,
        filter_doc_type: null,
        filter_document_id: null,
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log(`\nResults count: ${data?.length || 0}`);

    if (data && data.length > 0) {
        console.log('Top result snippet:', data[0].content_chunk.substring(0, 100));
        console.log('Top result source:', data[0].metadata_json?.filename || 'unknown');
        console.log('Top result similarity:', data[0].similarity);
    } else {
        console.warn('No matches found. Database might be empty or embeddings mismatch.');
    }
}

testRag().catch(console.error);
