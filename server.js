const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { OpenAI } = require('openai');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// API Route
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    let completed = false;
    let runStatus = null;

    while (!completed) {
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      if (runStatus.status === 'completed') {
        completed = true;
      } else if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
        throw new Error('Assistant run failed.');
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const reply = messages.data
      .filter(m => m.role === "assistant")
      .map(m => m.content[0].text.value)
      .join("\n");

    res.json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Optional home route (for testing base URL)
app.get('/', (req, res) => {
  res.send('AI Command Backend is live 🚀');
});

// Start server
app.listen(port, () => {
  console.log(`✅ Backend running on http://localhost:${port}`);
});
