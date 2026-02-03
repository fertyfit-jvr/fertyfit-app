
import fs from 'fs/promises';
import path from 'path';

async function compare() {
    const local = (await fs.readFile('local_files.txt', 'utf-8'))
        .split('\n')
        .map(f => f.trim().split('/').pop())
        .filter(Boolean);

    const db = (await fs.readFile('db_files.txt', 'utf-8'))
        .split('\n')
        .filter(line => !line.includes('REAL_TOTAL_DOCS') && !line.includes('NEW_SEMANTIC_DOCS_COUNT') && !line.includes('injecting env'))
        .map(line => line.trim())
        .filter(Boolean);

    console.log('Local count:', local.length);
    console.log('DB count:', db.length);

    const dbLower = db.map(d => d.toLowerCase());
    const missing = local.filter(l => !dbLower.includes(l.toLowerCase()));

    console.log('Missing from DB (count):', missing.length);
    console.log('Missing list:', missing);

    const extraneous = db.filter(d => !local.map(l => l.toLowerCase()).includes(d.toLowerCase()));
    console.log('Extraneous in DB (count):', extraneous.length);
}

compare();
