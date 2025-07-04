// This is the final, correct Edge Function code, placed in the correct folder.

// The handler signature is different for Edge Functions.
// It receives a `request` object and the `context` object.
export default async (request, context) => {

    // Only allow POST requests
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // Securely get the API key from Netlify's environment variables
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: 'API key not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Get the body from the incoming request
    const { system, messages } = await request.json();

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
                stream: true // Enable streaming
            })
        });

        // Directly return a new Response, streaming the body from Anthropic.
        // This is the correct pattern for Edge Functions.
        return new Response(anthropicResponse.body, {
            status: anthropicResponse.status,
            headers: {
                'Content-Type': 'text/event-stream',
            }
        });

    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
