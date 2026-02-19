import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY not found');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function main() {
    console.log('Listing all available models...');
    try {
        const response = await (ai as any).models.list();
        if (response && response.models) {
            console.log(`Found ${response.models.length} models:`);
            for (const model of response.models) {
                if (model.name.toLowerCase().includes('embed')) {
                    console.log(`- ${model.name} (${model.displayName})`);
                }
            }
        } else {
            console.log('No models found in response:', response);
        }
    } catch (error) {
        console.error('Error listing models:', error);
    }
}

main();
