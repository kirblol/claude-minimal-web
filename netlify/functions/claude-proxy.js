// This is our secure, server-side function.
exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Get the API key from Netlify's secure environment variables
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured.' }) };
    }

    // Get the messages from the frontend's request
    const { system, messages } = JSON.parse(event.body);

    // --- UPDATED AS REQUESTED ---
    const modelName = 'claude-opus-4-20250514'; 
    
    const anthropicApiEndpoint = 'https://api.anthropic.com/v1/messages';

    try {
        const response = await fetch(anthropicApiEndpoint, {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                max_tokens: 2048, // This controls the max length of the *response*
                system: system,
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Anthropic API Error:', errorData);
            // Pass the specific error message from Anthropic back to the frontend
            return { statusCode: response.status, body: JSON.stringify({ error: errorData.error.message }) };
        }

        const result = await response.json();
        const assistantMessage = result.content[0].text;

        // Send the successful response back to the frontend
        return {
            statusCode: 200,
            body: JSON.stringify({ assistantResponse: assistantMessage })
        };

    } catch (error) {
        console.error('Proxy Function Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
