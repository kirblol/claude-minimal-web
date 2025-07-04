exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    // Add CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Get API key from environment variables
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'API key not configured.' })
        };
    }

    try {
        const { system, messages } = JSON.parse(event.body);

        if (!messages || !Array.isArray(messages)) {
            return {
                statusCode: 400,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid messages format.' })
            };
        }

        const modelName = 'claude-opus-4-20250514';
        
        // For streaming, we need to return a different response
        // Since regular Netlify functions don't support streaming,
        // let's make a non-streaming request instead
        const response = await fetch('https://api.anthropic.com/v1/messages', {
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
                stream: false // Changed to non-streaming
            })
        });

        const responseData = await response.text();

        if (!response.ok) {
            console.error('Anthropic API Error:', responseData);
            return {
                statusCode: response.status,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: `API error: ${responseData}`,
                    status: response.status 
                })
            };
        }

        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: responseData
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
