require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "../frontend/build")));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

app.post("/api/chat", async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    console.error("[SERVER] OPENROUTER_API_KEY is not configured.");
    return res
      .status(500)
      .json({ error: "API key is not configured on the server." });
  }

  const { messages } = req.body;
  if (!messages) {
    return res
      .status(400)
      .json({ error: 'Missing "messages" in request body.' });
  }

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: "x-ai/grok-4-fast:free",
        messages: messages,
        stream: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://gemini-telegram-chat.dev",
          "X-Title": "Gemini Telegram Chat",
        },
        responseType: "stream",
        // This is important to handle non-200 responses without throwing an immediate error
        validateStatus: () => true,
      }
    );

    // If the status code is not 200, it's an error from the API
    if (response.status !== 200) {
      let errorData = "";
      response.data.on("data", (chunk) => {
        errorData += chunk;
      });
      response.data.on("end", () => {
        console.error(
          `[SERVER] API Error Response (Status ${response.status}):`,
          errorData
        );
        res.status(response.status).json({
          error: `API returned status ${response.status}: ${errorData}`,
        });
      });
      return;
    }

    // If status is 200, pipe the stream to the client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    response.data.pipe(res);
  } catch (error) {
    // This will catch network errors or issues before the request is even made
    console.error("[SERVER] General request error:", error.message);
    res.status(500).json({ error: "Failed to connect to the API service." });
  }
});

// All other GET requests not handled before will return our React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

app.listen(port, () => {
  console.log(`[SERVER] Listening on port ${port}`);
});
