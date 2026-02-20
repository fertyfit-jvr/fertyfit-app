import { ai } from './server/lib/ai.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'say hello',
        });
        console.log('--- RESPONSE: ---');
        console.log(response);
        console.log('--- response.text: ---');
        console.log(response.text);
    } catch (e) {
        console.error('ERROR', e);
    }
}

main();
