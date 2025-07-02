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

    // Step 1: Create thread
    let thread;
    try {
      thread = await openai.beta.threads.create();
      console.log("🧵 Thread created:", thread.id);
    } catch (threadError) {
      console.error("❌ Failed to create thread:", threadError);
      return res.status(500).json({ error: "Failed to create assistant thread." });
    }

    const threadId = thread?.id;
    if (!threadId) {
      console.error("❌ Thread ID is missing or undefined.");
      return res.status(500).json({ error: "Thread ID is missing." });
    }

    // Step 2: Add user message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    // Step 3: Run assistant
    let run;
    try {
      run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: process.env.ASSISTANT_ID,
      });
      console.log("🚀 Run created:", run.id);
    } catch (runError) {
      console.error("❌ Failed to create run:", runError);
      return res.status(500).json({ error: "Failed to create assistant run." });
    }

    // Step 4: Poll for run completion
    let completed = false;
    let runStatus = null;

    while (!completed) {
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      if (runStatus.status === 'completed') {
        completed = true;
      } else if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
        throw new Error('Assistant run failed.');
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1s before retry
      }
    }

    // Step 5: Get final assistant reply
    const messages = await openai.beta.threads.messages.list(threadId);
    console.log("📩 All assistant messages:", JSON.stringify(messages.data, null, 2));

    const reply = messages.data
      .filter(m => m.role === "assistant")
      .map(m => m.content[0].text.value)
      .join("\n");

    console.log("✅ Final reply:", reply);
    res.json({ reply });

  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.get('/', (req, res) => {
  res.send('AI Command Backend is live 🚀');
});

app.listen(port, () => {
  console.log(`✅ Backend running on http://localhost:${port}`);
});
