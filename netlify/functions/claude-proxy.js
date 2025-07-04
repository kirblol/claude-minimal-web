// This is the final, corrected version using Netlify's native streaming support.
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        // Return a standard Response object for the error
        return new Response('Method Not Allowed', { status: 405 });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: 'API key not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const body = await event.text();
    const { system, messages } = JSON.parse(body);

    // Using the powerful Opus model, which is now safe thanks to streaming.
    const modelName = 'claude-opus-4-20250514'; 
    const anthropicApiEndpoint = 'https://api.anthropic.com/v1/messages';

    try {
        const anthropicResponse = await fetch(anthropicApiEndpoint, {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                max_tokens: 4096,
                system: system,
                messages: messages,
                stream: true // The magic flag to enable streaming
            })
        });

        // --- THE KEY FIX ---
        // Instead of creating our own stream, we directly return a new Response object
        // using the body and headers from Anthropic's response. This is what Netlify expects.
        return new Response(anthropicResponse.body, {
            status: anthropicResponse.status,
            headers: {
                'Content-Type': 'text/event-stream', // Correct MIME type for Server-Sent Events
            }
        });

    } catch (error) {
        console.error('Proxy Function Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
