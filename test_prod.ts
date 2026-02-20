import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    try {
        console.log('Pinging production API...');
        const response = await fetch('https://method.fertyfit.com/api/chat/rag', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // We might need an authorization header depending on how it's secured, but let's check without it first
            },
            body: JSON.stringify({
                userId: '7e9b01ca-aeb7-4eb9-a3e9-082098b11145', // Valid UUID from a previous user context
                query: 'hello, this is a test from the system'
            })
        });

        console.log(`STATUS: ${response.status}`);
        const text = await response.text();
        console.log('RESPONSE:', text);
    } catch (e) {
        console.error('ERROR:', e);
    }
}

main();
