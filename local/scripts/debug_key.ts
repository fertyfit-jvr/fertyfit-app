
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicit load
const envPath = path.resolve(process.cwd(), '.env');
console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) console.error("Error loading .env:", result.error);

const key = process.env.GEMINI_API_KEY;

if (!key) {
    console.error("❌ Key is undefined!");
    process.exit(1);
}

console.log(`Key found: ${key.substring(0, 5)}...`);
console.log(`Length: ${key.length}`);
console.log(`Codes: ${key.split('').map(c => c.charCodeAt(0)).join(',')}`);

async function test() {
    // Exact URL from curl success: https://generativelanguage.googleapis.com/v1beta/models?key=...
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    console.log(`\nTesting URL: ${url.replace(key, 'HIDDEN')}`);

    try {
        const resp = await fetch(url);
        console.log(`Status: ${resp.status} ${resp.statusText}`);
        const text = await resp.text();
        if (resp.ok) {
            console.log("✅ SUCCESS! Key is valid for listModels.");
            console.log("First 100 chars:", text.substring(0, 100));
        } else {
            console.error("❌ FAILED:", text);
        }
    } catch (e) {
        console.error("Exception:", e);
    }

    // Now test generateContent
    console.log("\nTesting generateContent...");
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    try {
        const resp = await fetch(genUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
        });
        console.log(`Status: ${resp.status} ${resp.statusText}`);
        const text = await resp.text();
        if (resp.ok) {
            console.log("✅ SUCCESS! Key is valid for generateContent.");
        } else {
            console.error("❌ FAILED:", text);
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

test();
