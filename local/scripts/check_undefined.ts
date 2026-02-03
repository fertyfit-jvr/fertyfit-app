
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

async function checkUndefined() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Search for any document_id containing 'undefined'
    const { data, error } = await supabase
        .from('fertyfit_knowledge')
        .select('document_id, metadata_json')
        .ilike('document_id', '%undefined%')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data?.length} 'undefined' documents:`);
    data?.forEach(row => {
        console.log(`- ID: ${row.document_id}`);
        console.log(`  Title: ${row.metadata_json?.document_title}`);
        console.log(`  Filename: ${row.metadata_json?.semantic_filename}`);
    });
}

checkUndefined().catch(console.error);
