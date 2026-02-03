
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

async function deleteUndefined() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { error, count } = await supabase
        .from('fertyfit_knowledge')
        .delete({ count: 'exact' })
        .eq('document_id', 'undefined.pdf');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Successfully deleted ${count} chunks associated with 'undefined.pdf'.`);
}

deleteUndefined().catch(console.error);
