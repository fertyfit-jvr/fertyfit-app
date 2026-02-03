
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function listAll() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    const { data, error } = await supabase.from('fertyfit_knowledge').select('document_id');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    const uniqueDocs = [...new Set(data?.map(d => d.document_id))];
    console.log('TOTAL_UNIQUE_DOCS:' + uniqueDocs.length);
    console.log('DOC_LIST:', uniqueDocs.sort().join('\n'));
}

listAll();
