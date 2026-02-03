
import dotenv from 'dotenv';
import path from 'path';

// Fix path resolution
const envPath = path.resolve(process.cwd(), '.env');
console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

if (!GEMINI_API_KEY) {
    console.error("❌ No GEMINI_API_KEY found");
    process.exit(1);
}

console.log(`Key found: ${GEMINI_API_KEY.substring(0, 5)}...`);
console.log(`Length: ${GEMINI_API_KEY.length}`);
console.log(`Codes: ${GEMINI_API_KEY.split('').map(c => c.charCodeAt(0)).join(',')}`);

const MODEL_EMBED = 'text-embedding-004';

async function testEmbed() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_EMBED}:embedContent?key=${GEMINI_API_KEY}`;
    console.log(`\nTesting URL: ${url.replace(GEMINI_API_KEY, 'HIDDEN')}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text: "Hello world" }] }
            })
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();

        if (!response.ok) {
            console.error("❌ FAILED:", text);
        } else {
            console.log("✅ SUCCESS!");
            console.log(text.substring(0, 100)); // Print start of response
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

testEmbed();
