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

    // ✅ Step 1: Create a thread
    const threadResponse = await openai.beta.threads.create();
    const threadId = threadResponse.id;
    console.log("🧵 Thread ID:", threadId);

    // ✅ Step 2: Add user's message
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    // ✅ Step 3: Create run with assistant
    const runResponse = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });
    const runId = runResponse.id;
    console.log("🚀 Run ID:", runId);

    // ✅ Step 4: Poll until run is complete
    let completed = false;
    let runStatus;
    while (!completed) {
      runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
      if (runStatus.status === 'completed') {
        completed = true;
      } else if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
        throw new Error(`Run failed with status: ${runStatus.status}`);
      } else {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // ✅ Step 5: Get assistant's reply
    const messagesResponse = await openai.beta.threads.messages.list(threadId);
    const assistantMessages = messagesResponse.data.filter(
      (msg) => msg.role === "assistant"
    );

    const finalReply = assistantMessages
      .map((msg) => msg.content?.[0]?.text?.value || '')
      .join("\n");

    console.log("✅ Assistant Reply:", finalReply);
    res.json({ reply: finalReply });

  } catch (error) {
    console.error("❌ Server error:", error);
    res.status(500).json({ error: 'Server error. Check logs for details.' });
  }
});

app.get('/', (req, res) => {
  res.send('AI Command Backend is live 🚀');
});

app.listen(port, () => {
  console.log(`✅ Backend listening on http://localhost:${port}`);
});
