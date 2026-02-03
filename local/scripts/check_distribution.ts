
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkDistribution() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    const { data, error } = await supabase.from('fertyfit_knowledge').select('document_id');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    const counts: Record<string, number> = {};
    data?.forEach(d => {
        const id = String(d.document_id);
        counts[id] = (counts[id] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log('DISTRIBUTION (Top 20):', JSON.stringify(sorted.slice(0, 20), null, 2));
    console.log('TOTAL_UNIQUE_FROM_MAP:', Object.keys(counts).length);
    console.log('ANY_NULL:', data?.some(d => d.document_id === null));
    console.log('ANY_UNDEFINED:', data?.some(d => d.document_id === undefined));
}

checkDistribution();
