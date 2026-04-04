import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Anthropic API proxy
app.post('/api/chat', async (req, res) => {
  const { messages, model = 'MiniMax-M2.7', max_tokens = 256, stream = false, system } = req.body;
  console.log('Received API request, messages count:', messages?.length, 'stream:', stream);

  try {
    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.role === 'user'
        ? [{ type: 'text', text: msg.content }]
        : msg.content
    }));

    const requestBody = {
      model,
      max_tokens: Math.max(max_tokens, 1024),
      messages: anthropicMessages,
    };

    if (system) {
      requestBody.system = system;
    }

    if (stream) {
      requestBody.stream = true;
    }

    console.log('Calling Anthropic API...');
    const apiResponse = await fetch('https://api.minimaxi.com/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('Anthropic API error:', apiResponse.status, errorText);
      return res.status(apiResponse.status).json({ error: errorText });
    }

    if (stream) {
      // Stream mode: pipe the response directly
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      apiResponse.body.pipe(res);
    } else {
      // Non-stream mode
      const data = await apiResponse.json();
      console.log('Anthropic API response received, content blocks:', data.content?.length);

      // Convert Anthropic response to OpenAI format for client compatibility
      const textContent = [];

      if (data.content) {
        for (const block of data.content) {
          if (block.type === 'text') {
            textContent.push(block.text);
          }
          // Skip thinking blocks - they're already processed server-side
        }
      }

      // Return in OpenAI chat format
      const openAIFormat = {
        id: data.id || 'chatcmpl-' + Date.now(),
        choices: [{
          message: {
            role: 'assistant',
            content: textContent.join('\n\n')
          },
          finish_reason: 'stop'
        }],
        model: data.model || model,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 }
      };

      res.json(openAIFormat);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
