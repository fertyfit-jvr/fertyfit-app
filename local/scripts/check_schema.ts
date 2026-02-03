
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSchema() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    // Query to get the exact column definition for the embedding column
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'fertyfit_knowledge' });

    if (error) {
        // If RPC doesn't exist, try a direct query to information_schema if possible (often limited)
        const { data: cols, error: err2 } = await supabase.from('fertyfit_knowledge').select('*').limit(1);
        if (err2) {
            console.error('Error fetching data:', err2.message);
        } else {
            console.log('COLUMNS_IN_DATA:', Object.keys(cols[0] || {}));
        }
        return;
    }

    console.log('SCHEMA_DATA:', JSON.stringify(data, null, 2));
}

checkSchema();
