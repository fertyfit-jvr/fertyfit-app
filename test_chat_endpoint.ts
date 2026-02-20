import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' }); // try .env instead of .env.local

// Important: set the environment variables before importing the handler
if (!process.env.VITE_SUPABASE_URL) {
    console.warn('MISSING VITE_SUPABASE_URL');
}

async function main() {
    try {
        console.log('Testing /api/chat/rag endpoint directly by calling the handler code.');

        // Import the handler
        const { default: handler } = await import('./api/chat/rag.ts');

        // Mock Vercel Request and Response
        const req: any = {
            method: 'POST',
            body: {
                userId: '7e9b01ca-aeb7-4eb9-a3e9-082098b11145', // Valid UUID from a previous user context
                query: 'hello'
            },
            url: '/api/chat/rag',
            headers: {}
        };

        const res: any = {
            status: function (code: number) {
                this.statusCode = code;
                return this;
            },
            json: function (data: any) {
                console.log(`STATUS: ${this.statusCode}`);
                console.log('JSON RESPONSE:', data);
            },
            setHeader: function (name: string, value: string) {
                // mock
            }
        };

        await handler(req, res);
    } catch (e) {
        console.error('ERROR during handler test:', e);
    }
}

main();
