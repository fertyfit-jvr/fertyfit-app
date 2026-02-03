
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API;

async function list() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const resp = await fetch(url);
    const data = await resp.json();
    console.log(JSON.stringify(data, null, 2));
}
list();
