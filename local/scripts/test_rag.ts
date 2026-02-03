
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API || process.env.GEMINI_API_KEY;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function embedQuery(query: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: query }] }
        })
    });
    const data = await response.json();
    return data.embedding?.values || [];
}

async function testRag() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    const testQuery = "hormonas fertilidad FSH LH estradiol prolactina tiroides";
    console.log(`Testing RAG with query: "${testQuery}"`);

    const embedding = await embedQuery(testQuery);
    console.log(`Embedding generated: ${embedding.length} dimensions`);

    const { data, error } = await supabase.rpc('match_fertyfit_knowledge', {
        query_embedding: embedding,
        match_count: 120,  // Fetch many to see diversity
        filter_pillar_category: null,
        filter_doc_type: null,
        filter_document_id: null,
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log(`\nRaw results count: ${data?.length || 0}`);

    // DEBUG: Log first row structure
    if (data && data.length > 0) {
        console.log('First row keys:', Object.keys(data[0]));
        console.log('First row sample:', JSON.stringify(data[0], null, 2).slice(0, 500));
    }

    // Group by document
    const docCounts: Record<string, number> = {};
    data?.forEach((row: any) => {
        const docId = row.document_id || row.metadata_json?.semantic_filename || 'unknown';
        docCounts[docId] = (docCounts[docId] || 0) + 1;
    });

    const uniqueDocs = Object.keys(docCounts);
    console.log(`\nUnique documents found: ${uniqueDocs.length}`);
    console.log('\nTop 15 documents by chunk count:');

    Object.entries(docCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([doc, count], i) => {
            const similarity = data.find((r: any) => r.document_id === doc)?.similarity || 0;
            console.log(`  ${i + 1}. ${doc} (${count} chunks, sim: ${similarity.toFixed(3)})`);
        });
}

testRag().catch(console.error);
