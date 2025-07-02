const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    console.log("🟢 Received user message:", userMessage);

    // ✅ Create thread and store ID
    const thread = await openai.beta.threads.create();
    const threadId = thread.id;
    console.log("🧵 Thread ID:", threadId);

    // ✅ Add message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    // ✅ Create a run and store ID
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });
    const runId = run.id;
    console.log("🚀 Run ID:", runId);

    // ✅ Poll for completion
    let completed = false;
    let runStatus;

    while (!completed) {
      runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);

      if (runStatus.status === 'completed') {
        completed = true;
      } else if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
        throw new Error(`Run failed with status: ${runStatus.status}`);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // ✅ Retrieve reply messages
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantReply = messages.data
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.content?.[0]?.text?.value || '')
      .join("\n");

    console.log("✅ Final reply:", assistantReply);
    res.json({ reply: assistantReply });

  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: 'Something went wrong. Check server logs.' });
  }
});

app.get('/', (req, res) => {
  res.send('AI Command Backend is live 🚀');
});

app.listen(port, () => {
  console.log(`✅ Backend running on http://localhost:${port}`);
});
