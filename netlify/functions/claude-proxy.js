// This is the final, correct version that will work with the netlify.toml configuration.
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: 'API key not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // On this runtime, the body is a string that needs to be parsed.
    const body = event.body; 
    const { system, messages } = JSON.parse(body);

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
                stream: true
            })
        });

        // This correctly streams the response from Anthropic through the Edge Function.
        return new Response(anthropicResponse.body, {
            status: anthropicResponse.status,
            headers: {
                'Content-Type': 'text/event-stream',
            }
        });

    } catch (error) {
        console.error('Proxy Function Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-type': 'application/json' },
        });
    }
};
