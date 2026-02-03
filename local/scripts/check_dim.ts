
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkDim() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    const { data, error } = await supabase
        .from('fertyfit_knowledge')
        .select('embedding')
        .limit(1);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (data && data.length > 0 && data[0].embedding) {
        // Supabase returns embeddings as strings in some contexts if not using pgvector properly in JS, 
        // but usually as arrays of numbers.
        const emb = data[0].embedding;
        if (typeof emb === 'string') {
            // If it's a string like "[0.1, 0.2, ...]" or similar
            try {
                const parsed = JSON.parse(emb);
                console.log('EMBEDDING_DIM:' + parsed.length);
            } catch (e) {
                // If it's the pgvector string format "[0.1, 0.2]"
                const len = emb.replace('[', '').replace(']', '').split(',').length;
                console.log('EMBEDDING_DIM_STR:' + len);
            }
        } else if (Array.isArray(emb)) {
            console.log('EMBEDDING_DIM_ARRAY:' + emb.length);
        }
    } else {
        console.log('NO_DATA_OR_NO_EMBEDDING');
    }
}

checkDim();
