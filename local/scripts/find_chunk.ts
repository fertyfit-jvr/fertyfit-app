
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function findChunk() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    const { data, error } = await supabase
        .from('fertyfit_knowledge')
        .select('*')
        .ilike('content_chunk', '%manual para ver%');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('MATCHING_CHUNKS:', JSON.stringify(data, null, 2));
}

findChunk();
