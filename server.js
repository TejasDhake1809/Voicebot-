// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";
import multer from "multer";
import fs from "fs";
import path from "path";

import { initDB, InteractionLog } from "./services/db.js";
import { detectIntent } from "./services/nlu_gemini.js";
import { generateResponse } from "./services/respond_gemini.js";
import { transcribeFile } from "./services/stt_deepgram.js";
import { speakTextToFile } from "./services/tts_gtts.js";

const app = express();

// Enable CORS for frontend
app.use(cors());

// Support JSON
app.use(bodyParser.json());

// Create uploads directory
const upload = multer({ dest: "uploads/" });

// Initialize Database
await initDB();

// Root test route
app.get("/", (req, res) => {
  res.send("VoiceBot backend is running 🚀");
});


// ==========================================================
// 1️⃣ TEXT-BASED BOT ENDPOINT
// ==========================================================
app.post("/api/message", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: "text field is required" });

    // NLU
    const nlu = await detectIntent(text);

    // BOT REPLY
    const reply = await generateResponse(text, nlu.intent, nlu.entities);

    // Log interaction (non-blocking)
    InteractionLog.create({
      inputText: text,
      intent: nlu.intent,
      responseText: reply
    }).catch(() => {});

    return res.json({
      inputText: text,
      intent: nlu.intent,
      entities: nlu.entities,
      responseText: reply
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// ==========================================================
// 2️⃣ VOICE BOT ENDPOINT (AUDIO → TEXT → RESPONSE → TTS)
// ==========================================================
app.post("/api/voice-bot", upload.single("audio"), async (req, res) => {
  try {
    // 1. Ensure audio file exists
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const audioPath = req.file.path;

    // 2. Speech-to-Text
    const inputText = await transcribeFile(audioPath);

    // 3. NLU
    const nlu = await detectIntent(inputText);

    // 4. Business logic response
    const responseText = await generateResponse(inputText, nlu.intent, nlu.entities);

    // 5. Convert response text to speech
    const tts = await speakTextToFile(responseText);
    const audioBase64 = fs.readFileSync(tts.path).toString("base64");

    // 6. Cleanup uploaded audio
    fs.unlinkSync(audioPath);

    // 7. Log interaction
    InteractionLog.create({
      inputText,
      intent: nlu.intent,
      responseText
    }).catch(() => {});

    return res.json({
      inputText,
      intent: nlu.intent,
      entities: nlu.entities,
      responseText,
      audioBase64
    });

  } catch (err) {
    console.error("Voice Bot Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// ==========================================================
// STATIC SERVE FOR TTS OUTPUT (OPTIONAL)
// ==========================================================
app.use("/tts", express.static(path.join(process.cwd(), "tts_output")));


// ==========================================================
// START SERVER
// ==========================================================
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
