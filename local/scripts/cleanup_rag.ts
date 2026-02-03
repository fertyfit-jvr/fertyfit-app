
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs/promises';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INGEST_DIR = path.join(process.cwd(), 'local/ingest');

async function cleanup() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    // 1. Obtener archivos locales
    const localFiles = (await fs.readdir(INGEST_DIR))
        .filter(f => f.toLowerCase().endsWith('.pdf'));

    console.log(`📂 Archivos locales encontrados en local/ingest: ${localFiles.length}`);

    // 2. Obtener todos los document_id de la DB (con paginación)
    let dbDocs: string[] = [];
    let from = 0;
    let finished = false;
    while (!finished) {
        const { data, error } = await supabase
            .from('fertyfit_knowledge')
            .select('document_id')
            .range(from, from + 999);

        if (error) throw error;
        if (data.length === 0) {
            finished = true;
        } else {
            dbDocs = dbDocs.concat(data.map(d => String(d.document_id)));
            from += 1000;
        }
    }

    const uniqueDbDocs = [...new Set(dbDocs)];
    console.log(`DB: Documentos únicos en base de datos: ${uniqueDbDocs.length}`);

    // 3. Identificar qué borrar
    const localFilesLower = localFiles.map(f => f.toLowerCase());
    const toDelete = uniqueDbDocs.filter(docId => !localFilesLower.includes(docId.toLowerCase()));

    console.log(`🗑️  Documentos identificados para borrar (no están en local/ingest): ${toDelete.length}`);
    if (toDelete.length > 0) {
        console.log('Ejemplos de archivos a borrar:', toDelete.slice(0, 5).join(', '));
    }

    // 4. Ejecutar borrado
    let deletedTotal = 0;
    for (const docId of toDelete) {
        console.log(`   Deleting [${docId}]...`);
        const { error, count } = await supabase
            .from('fertyfit_knowledge')
            .delete({ count: 'exact' })
            .eq('document_id', docId);

        if (error) {
            console.error(`      ❌ Error deleting ${docId}:`, error.message);
        } else {
            deletedTotal += (count || 0);
        }
    }

    console.log(`\n✅ LIMPIEZA COMPLETADA.`);
    console.log(`   - Documentos eliminados de la DB: ${toDelete.length}`);
    console.log(`   - Trozos (chunks) totales eliminados: ${deletedTotal}`);

    // 5. Verificación final
    const { count: finalCount } = await supabase
        .from('fertyfit_knowledge')
        .select('document_id', { count: 'exact', head: true });

    console.log(`\n📊 ESTADO FINAL:`);
    console.log(`   - Chunks restantes en DB: ${finalCount}`);

    // Contar docs únicos finales
    let finalDocs: string[] = [];
    from = 0;
    finished = false;
    while (!finished) {
        const { data } = await supabase.from('fertyfit_knowledge').select('document_id').range(from, from + 999);
        if (!data || data.length === 0) { finished = true; }
        else { finalDocs = finalDocs.concat(data.map(d => String(d.document_id))); from += 1000; }
    }
    const finalUniqueCount = [...new Set(finalDocs)].length;
    console.log(`   - Documentos únicos finales en DB: ${finalUniqueCount}`);
}

cleanup().catch(console.error);
