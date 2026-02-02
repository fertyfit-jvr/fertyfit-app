import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing env vars. Ensure .env exists in root.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
    console.log('--- Inspecting FertyFit Knowledge Base ---');

    // 1. Check embedding dimension
    const { data: embeddingData, error: embeddingError } = await supabase
        .from('fertyfit_knowledge')
        .select('embedding')
        .limit(1);

    if (embeddingError) {
        console.error('Error fetching embedding:', embeddingError);
    } else if (embeddingData && embeddingData.length > 0) {
        const emb = embeddingData[0].embedding;
        console.log('Sample embedding fetched.');
        if (typeof emb === 'string') {
            const count = emb.split(',').length; // very rough count for string format "[x,y,z]"
            console.log(`Embedding format is string. Approximate dimensions: ${count} (from string parse)`);
        } else if (Array.isArray(emb)) {
            console.log(`Embedding is Array. Length: ${emb.length}`);
        } else {
            console.log('Embedding type:', typeof emb);
        }
    }

    // 2. Count total chunks
    const { count, error: countError } = await supabase
        .from('fertyfit_knowledge')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error counting rows:', countError);
    } else {
        console.log(`Total chunks in DB: ${count}`);
    }

    // 3. List all unique documents
    // Fetch only metadata to be lighter
    const { data, error: dataError } = await supabase
        .from('fertyfit_knowledge')
        .select('metadata_json')
        .limit(10000); // Fetch enough to cover all chunks

    if (dataError) {
        console.error('Error fetching data:', dataError);
        return;
    }

    const sources = new Set();
    data.forEach(row => {
        const meta = row.metadata_json;
        if (meta) {
            // Prefer explicit title, then filename, then file_path
            const src = meta.document_title || meta.filename || meta.file_path || 'unknown';
            if (src !== 'unknown') {
                sources.add(src);
            }
        }
    });

    const sortedSources = Array.from(sources).sort();
    console.log(`\nFound ${sortedSources.length} unique documents:\n`);
    sortedSources.forEach((s, i) => console.log(`${i + 1}. ${s}`));
}

main().catch(console.error);
