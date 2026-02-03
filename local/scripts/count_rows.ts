
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function countRows() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    const { count, error } = await supabase
        .from('fertyfit_knowledge')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('TOTAL_CHUNKS:' + count);
}

countRows();
