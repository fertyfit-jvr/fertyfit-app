import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        console.log('Fetching recently active users from daily_logs...');
        const { data, error } = await supabase
            .from('daily_logs')
            .select('user_id, date')
            .order('date', { ascending: false })
            .limit(10);

        if (error) throw error;
        const userIds = [...new Set(data.map(d => d.user_id))];

        if (userIds.length > 0) {
            const userId = userIds[0];
            console.log(`\nTesting local handler API with user_id: ${userId}`);

            const { default: handler } = await import('./api/chat/rag.ts');

            // Mock Vercel Request and Response
            const req: any = {
                method: 'POST',
                body: {
                    userId: userId,
                    query: 'Hola, tengo una pregunta sobre mi ciclo.'
                },
                url: '/api/chat/rag',
                headers: { origin: 'https://method.fertyfit.com' }
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
        }
    } catch (e) {
        console.error('ERROR:', e);
    }
}

main();
