export default async (request, context) => {
    // Only allow POST requests
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // Add CORS headers for browser compatibility
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: corsHeaders,
        });
    }

    // Securely get the API key from Netlify's environment variables
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: 'API key not configured. Please set ANTHROPIC_API_KEY in Netlify environment variables.' }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
            },
        });
    }

    try {
        // Get the body from the incoming request
        const requestBody = await request.json();
        const { system, messages } = requestBody;

        // Validate input
        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Invalid messages format. Messages must be an array.' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders 
                },
            });
        }

        // Use a valid Claude model name
        const modelName = 'claude-opus-4-20250514'; // or 'claude-3-opus-20240229' for more powerful model
        const anthropicApiEndpoint = 'https://api.anthropic.com/v1/messages';

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
                system: system || '',
                messages: messages,
                stream: true
            })
        });

        if (!anthropicResponse.ok) {
            const errorText = await anthropicResponse.text();
            console.error('Anthropic API Error:', errorText);
            
            let errorMessage;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorJson.message || 'Unknown API error';
            } catch {
                errorMessage = errorText || 'Unknown API error';
            }
            
            return new Response(JSON.stringify({ error: `Anthropic API error: ${errorMessage}` }), {
                status: anthropicResponse.status,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders 
                },
            });
        }

        // Return the streaming response with proper headers
        return new Response(anthropicResponse.body, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                ...corsHeaders
            }
        });

    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error: ' + error.message }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
            },
        });
    }
};
