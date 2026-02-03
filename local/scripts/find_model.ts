
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicit load
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
const key = process.env.GEMINI_API_KEY?.trim();

if (!key) {
    console.error("❌ No Key");
    process.exit(1);
}

const CANDIDATES = [
    'gemini-1.5-flash',
    'models/gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'models/gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash-native-audio-latest' // Seen in list
];

async function testModel(model: string) {
    // Handling models that might already have 'models/' prefix
    const modelPath = model.startsWith('models/') ? model : `models/${model}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${key}`;

    console.log(`\nTesting: ${model} ...`);
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
        });

        if (resp.ok) {
            console.log(`✅ SUCCESS! Working model found: "${model}"`);
            return true;
        } else {
            console.log(`❌ Failed (${resp.status}): ${await resp.text()}`);
        }
    } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
    }
    return false;
}

async function main() {
    console.log("Searching for working model...");
    for (const model of CANDIDATES) {
        const works = await testModel(model);
        if (works) {
            console.log(`\n🏆 WINNER: Use model "${model}"`);
            return;
        }
    }
    console.log("\n😭 No working models found.");
}

main();
