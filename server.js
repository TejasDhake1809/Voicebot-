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
app.use(bodyParser.urlencoded({ extended: true }));

// Create uploads directory
const upload = multer({ dest: "uploads/" });

// Initialize Database
await initDB();

// In-memory pending question store (sessionId -> { question, createdAt })
// NOTE: for production consider persistent store (Redis) and TTL cleanup
const pendingQuestions = new Map();
const PENDING_TTL_MS = 1000 * 60 * 10; // 10 minutes

function setPendingQuestion(sessionId, question) {
  if (!sessionId) return;
  pendingQuestions.set(sessionId, { question, createdAt: Date.now() });
}
function getPendingQuestion(sessionId) {
  const entry = pendingQuestions.get(sessionId);
  if (!entry) return null;
  // TTL check
  if (Date.now() - entry.createdAt > PENDING_TTL_MS) {
    pendingQuestions.delete(sessionId);
    return null;
  }
  return entry.question;
}
function clearPendingQuestion(sessionId) {
  pendingQuestions.delete(sessionId);
}

// Root test route
app.get("/", (req, res) => {
  res.send("VoiceBot backend is running 🚀");
});

// Helper to extract sessionId (text or form)
function readSessionId(req) {
  // prefer explicit body.sessionId, then query param
  return req.body?.sessionId || req.query?.sessionId || req.headers["x-session-id"] || null;
}

// ==========================================================
// 1️⃣ TEXT-BASED BOT ENDPOINT
// ==========================================================
app.post("/api/message", async (req, res) => {
  try {
    const { text } = req.body;
    const sessionId = readSessionId(req);

    if (!text) return res.status(400).json({ error: "text field is required" });

    // NLU
    const nlu = await detectIntent(text);

    // BOT REPLY — generateResponse now returns either a string OR an object { text, suggestSave }
    const replyObj = await generateResponse(text, nlu.intent, nlu.entities);
    const responseText = typeof replyObj === "string" ? replyObj : (replyObj?.text || "");
    const suggestSave = !(typeof replyObj === "string") && !!replyObj?.suggestSave;

    // If the bot suggested saving, store the user's question in pendingQuestions
    if (suggestSave && sessionId) {
      // Save the original user question (the one we tried to answer)
      setPendingQuestion(sessionId, text);
    }

    // Log interaction (non-blocking)
    InteractionLog.create({
      inputText: text,
      intent: nlu.intent,
      responseText
    }).catch(() => {});

    return res.json({
      inputText: text,
      intent: nlu.intent,
      entities: nlu.entities,
      responseText
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

    const sessionId = readSessionId(req);

    const audioPath = req.file.path;

    // 2. Speech-to-Text
    const inputText = await transcribeFile(audioPath);

    // 3. NLU
    const nlu = await detectIntent(inputText);

    // 4. Business logic response
    const replyObj = await generateResponse(inputText, nlu.intent, nlu.entities);
    const responseText = typeof replyObj === "string" ? replyObj : (replyObj?.text || "");
    const suggestSave = !(typeof replyObj === "string") && !!replyObj?.suggestSave;

    // If bot suggested saving, remember the user's question
    if (suggestSave && sessionId) {
      setPendingQuestion(sessionId, inputText);
    }

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
// 3️⃣ SAVE QUESTION (shortcut route if frontend posts a "save" command)
//    This route demonstrates the same logic used when intent=save_question
// ==========================================================
app.post("/api/save-question", async (req, res) => {
  try {
    const { text } = req.body; // the user's latest message (often "yes please save it")
    const sessionId = readSessionId(req);

    // NLU -> we still want to know if this is save_question or contains the full question
    const nlu = await detectIntent(text || "");

    // If NLU found an explicit question in entities, use it; otherwise fallback to pending
    let questionToSave = (nlu?.entities?.question || "").trim();
    if (!questionToSave) {
      questionToSave = getPendingQuestion(sessionId);
    }

    if (!questionToSave) {
      return res.status(400).json({ error: "No question found to save. Please re-state the question." });
    }

    // Create FAQ entry (avoid duplicates)
    const { FAQ } = await import("./services/db.js");
    const existing = await FAQ.findOne({ question: { $regex: new RegExp("^" + escapeRegex(questionToSave) + "$", "i") } });
    if (existing) {
      clearPendingQuestion(sessionId);
      return res.json({ message: "This question already exists in the FAQ list." });
    }

    await FAQ.create({ question: questionToSave, answer: "No answer yet. Admin will review." });
    clearPendingQuestion(sessionId);

    // Log and respond
    InteractionLog.create({
      inputText: text || "",
      intent: "save_question",
      responseText: "Saved pending question"
    }).catch(() => {});

    return res.json({ message: "Your question has been saved for review. We'll add an answer soon." });
  } catch (err) {
    console.error("Save-question error:", err);
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

// tiny helper
function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
