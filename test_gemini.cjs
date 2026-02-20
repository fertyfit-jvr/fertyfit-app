require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API;
const ai = new GoogleGenAI({ apiKey });
async function test() {
    try {
        console.log('Testing contents: [{ text: "hello" }] on gemini-2.5-flash');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { text: 'hello' }
            ]
        });
        console.log('Success:', typeof response.text === 'function' ? response.text() : response.text);
    } catch (err) {
        console.error('Error with array of parts:', err.message);
    }
}
test();
