
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

async function checkEmbedding() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await supabase.from('fertyfit_knowledge').select('embedding').limit(1);

    if (error || !data || data.length === 0) {
        console.error('Error or no data:', error);
        return;
    }

    const embeddingRaw = data[0].embedding;
    console.log('Embedding type:', typeof embeddingRaw);
    console.log('Raw sample:', String(embeddingRaw).slice(0, 100));

    // Parse the vector string if it's in pgvector format like "[0.1,0.2,...]"
    if (typeof embeddingRaw === 'string') {
        const nums = embeddingRaw.replace(/[\[\]]/g, '').split(',');
        console.log('Dimension:', nums.length);
    } else if (Array.isArray(embeddingRaw)) {
        console.log('Dimension:', embeddingRaw.length);
    }
}

checkEmbedding().catch(console.error);
