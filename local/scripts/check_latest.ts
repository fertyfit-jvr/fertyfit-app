
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkLatest() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    const { data, error } = await supabase
        .from('fertyfit_knowledge')
        .select('created_at, document_id')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error querying Supabase:', error.message);
        return;
    }

    console.log('LATEST_ENTRIES:', JSON.stringify(data, null, 2));
}

checkLatest();
