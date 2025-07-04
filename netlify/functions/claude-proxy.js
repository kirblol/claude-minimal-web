// This function now supports streaming responses to avoid timeouts.
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured.' }) };
    }

    const { system, messages } = JSON.parse(event.body);

    // --- UPDATED to your preferred model, now viable with streaming ---
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
                max_tokens: 4096, // A high value is fine for streaming
                system: system,
                messages: messages,
                stream: true // This is the magic flag that enables streaming
            })
        });

        // This ReadableStream will pipe the data from Anthropic directly to the browser
        const readableStream = new ReadableStream({
            async start(controller) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                function push() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            controller.close();
                            return;
                        }
                        // Pass the chunk of data directly through
                        controller.enqueue(value);
                        push();
                    }).catch(err => {
                        console.error('Stream reading error', err);
                        controller.error(err);
                    });
                }
                push();
            }
        });

        // Return the stream directly to the browser
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff' // Security header
            },
            body: readableStream,
        };

    } catch (error) {
        console.error('Proxy Function Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
