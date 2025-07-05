export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Add CORS headers
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

  // Get API key from environment variables
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'API key not configured. Please set GEMINI_API_KEY in Vercel environment variables.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  try {
    // Parse request body
    const { system, messages } = await request.json();

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format. Messages must be an array.' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Convert messages to Gemini format
    const geminiMessages = [];
    
    // Add system message as first user message if provided
    if (system) {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: system }]
      });
      geminiMessages.push({
        role: 'model',
        parts: [{ text: 'I understand.' }]
      });
    }

    // Convert conversation messages
    for (const message of messages) {
      if (message.role === 'user') {
        geminiMessages.push({
          role: 'user',
          parts: [{ text: message.content }]
        });
      } else if (message.role === 'assistant') {
        geminiMessages.push({
          role: 'model',
          parts: [{ text: message.content }]
        });
      }
    }

    const modelName = 'gemini-2.0-flash-exp';
    const geminiApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${GEMINI_API_KEY}`;

    // Make streaming request to Gemini
    const geminiResponse = await fetch(geminiApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error:', errorText);
      
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || 'Unknown API error';
      } catch {
        errorMessage = errorText || 'Unknown API error';
      }
      
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errorMessage}` }),
        {
          status: geminiResponse.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Create a custom streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiResponse.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = line.substring(6);
                  if (data === '[DONE]') continue;
                  
                  const jsonData = JSON.parse(data);
                  
                  // Extract text from Gemini response structure
                  if (jsonData.candidates && jsonData.candidates[0] && 
                      jsonData.candidates[0].content && jsonData.candidates[0].content.parts) {
                    const text = jsonData.candidates[0].content.parts[0].text;
                    if (text) {
                      // Send in our custom format
                      const responseChunk = JSON.stringify({ text: text });
                      controller.enqueue(new TextEncoder().encode(`data: ${responseChunk}\n\n`));
                    }
                  }
                } catch (e) {
                  // Ignore malformed JSON chunks
                }
              } else if (line.trim() && line.includes('"text"')) {
                // Handle non-SSE format responses
                try {
                  const jsonData = JSON.parse(line);
                  if (jsonData.candidates && jsonData.candidates[0] && 
                      jsonData.candidates[0].content && jsonData.candidates[0].content.parts) {
                    const text = jsonData.candidates[0].content.parts[0].text;
                    if (text) {
                      const responseChunk = JSON.stringify({ text: text });
                      controller.enqueue(new TextEncoder().encode(`data: ${responseChunk}\n\n`));
                    }
                  }
                } catch (e) {
                  // Ignore malformed JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
        } finally {
          controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error: ' + error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}
