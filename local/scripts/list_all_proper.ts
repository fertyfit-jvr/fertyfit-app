
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function listAllProperly() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    let allDocs: string[] = [];
    let from = 0;
    const step = 1000;
    let finished = false;

    while (!finished) {
        const { data, error } = await supabase
            .from('fertyfit_knowledge')
            .select('document_id')
            .range(from, from + step - 1);

        if (error) {
            console.error('Error:', error.message);
            break;
        }

        if (data.length === 0) {
            finished = true;
        } else {
            allDocs = allDocs.concat(data.map(d => String(d.document_id)));
            from += step;
        }
    }

    const uniqueDocs = [...new Set(allDocs)];
    console.log('REAL_TOTAL_DOCS:' + uniqueDocs.length);

    // Separar los viejos (FLORA/FUNC...) de los nuevos (semánticos)
    const newDocs = uniqueDocs.filter(d => !/^(FLORA|FLOW|FOOD|FUNC)-/i.test(d));
    console.log('NEW_SEMANTIC_DOCS_COUNT:' + newDocs.length);
    console.log('NEW_DOCS_LIST:', newDocs.sort().join('\n'));
}

listAllProperly();
