
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testInsert() {
    console.log('Using URL:', SUPABASE_URL);
    console.log('Using Key (first 10 chars):', SUPABASE_KEY?.substring(0, 10));

    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
        auth: { persistSession: false }
    });

    const testRow = {
        document_id: 'TEST_MANUAL_INSERT.pdf',
        chunk_id: 999,
        content_chunk: 'Esto es una prueba manual para ver por qué no se guarda nada.',
        embedding: new Array(768).fill(0), // Dummy vector
        metadata_json: { test: true }
    };

    console.log('Attempting insert...');
    const result = await supabase.from('fertyfit_knowledge').insert([testRow]);

    console.log('RESULT:', JSON.stringify(result, null, 2));
}

testInsert();
