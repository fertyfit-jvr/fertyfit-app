
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkDb() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    const { data, error } = await supabase
        .from('fertyfit_knowledge')
        .select('id, document_id, chunk_id, metadata_json')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Sample rows:');
    data?.forEach((row, i) => {
        console.log(`\n--- Row ${i + 1} ---`);
        console.log('document_id:', row.document_id);
        console.log('chunk_id:', row.chunk_id);
        console.log('metadata_json:', JSON.stringify(row.metadata_json, null, 2));
    });
}

checkDb().catch(console.error);
