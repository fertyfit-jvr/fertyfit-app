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

        // Get unique user IDs
        const userIds = [...new Set(data.map(d => d.user_id))];
        console.log('Recent user IDs length:', userIds.length);

        if (userIds.length > 0) {
            const userId = userIds[0];
            console.log(`\nPinging production API with user_id: ${userId}`);

            // Get profile for context
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
            console.log('Profile diagnoses type:', typeof profile?.diagnoses, Array.isArray(profile?.diagnoses));

            const response = await fetch('https://method.fertyfit.com/api/chat/rag', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId,
                    query: 'Hola, tengo una pregunta sobre mi ciclo.'
                })
            });

            console.log(`STATUS: ${response.status}`);
            const text = await response.text();
            console.log('RESPONSE:', text);
        }
    } catch (e) {
        console.error('ERROR:', e);
    }
}

main();
