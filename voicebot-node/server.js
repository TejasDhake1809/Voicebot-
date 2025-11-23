// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";
import multer from "multer";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { initDB, InteractionLog, User, Account } from "./services/db.js";
import { detectIntent } from "./services/nlu_gemini.js";
import { generateResponse } from "./services/respond_gemini.js";
import { transcribeFile } from "./services/stt_deepgram.js";
import { speakTextToFile } from "./services/tts_gtts.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });

// Initialize DB
await initDB();

// Simple in-memory pending question store keyed by sessionId
const pendingQuestions = new Map();
const PENDING_TTL_MS = 1000 * 60 * 10; // 10 min

function setPendingQuestion(sessionId, question) {
  if (!sessionId) return;
  pendingQuestions.set(sessionId, { question, createdAt: Date.now() });
}
function getPendingQuestion(sessionId) {
  const e = pendingQuestions.get(sessionId);
  if (!e) return null;
  if (Date.now() - e.createdAt > PENDING_TTL_MS) {
    pendingQuestions.delete(sessionId);
    return null;
  }
  return e.question;
}
function clearPendingQuestion(sessionId) {
  pendingQuestions.delete(sessionId);
}

function readSessionId(req) {
  return (
    req.body?.sessionId ||
    req.query?.sessionId ||
    req.headers["x-session-id"] ||
    null
  );
}

// ------------------ AUTH MIDDLEWARE ------------------
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header)
    return res.status(401).json({ error: "Missing Authorization header" });
  const token = header.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Invalid Authorization header" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains { userId, accountId }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ------------------ PUBLIC ROUTES ------------------

// Root
app.get("/", (req, res) => res.send("VoiceBot backend is running 🚀"));

// Register (for demo / admin use) — in production restrict this
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, accountId } = req.body;
    if (!username || !password || !accountId)
      return res
        .status(400)
        .json({ error: "username, password, accountId required" });

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await User.create({ username, passwordHash, accountId });
    return res.json({ message: "User created", userId: user._id });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username and password required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user._id.toString(), accountId: user.accountId },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    return res.json({ token, accountId: user.accountId });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------ PROTECTED BOT ROUTES ------------------

// TEXT BOT
app.post("/api/message", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const sessionId = readSessionId(req);
    if (!text) return res.status(400).json({ error: "text field is required" });

    // Detect intent
    const nlu = await detectIntent(text);

    // Pass user's accountId to business logic to enforce ownership
    const replyObj = await generateResponse(
      text,
      nlu.intent,
      nlu.entities,
      req.user.accountId
    );
    const responseText =
      typeof replyObj === "string" ? replyObj : replyObj?.text || "";
    const suggestSave =
      !(typeof replyObj === "string") && !!replyObj?.suggestSave;

    if (suggestSave && sessionId) setPendingQuestion(sessionId, text);

    InteractionLog.create({
      inputText: text,
      intent: nlu.intent,
      responseText,
    }).catch(() => {});

    return res.json({
      inputText: text,
      intent: nlu.intent,
      entities: nlu.entities,
      responseText,
    });
  } catch (err) {
    console.error("/api/message error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// VOICE BOT
app.post(
  "/api/voice-bot",
  authMiddleware,
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "No audio file uploaded" });

      const sessionId = readSessionId(req);
      const audioPath = req.file.path;

      const inputText = await transcribeFile(audioPath);
      const nlu = await detectIntent(inputText);

      const replyObj = await generateResponse(
        inputText,
        nlu.intent,
        nlu.entities,
        req.user.accountId
      );
      const responseText =
        typeof replyObj === "string" ? replyObj : replyObj?.text || "";
      const suggestSave =
        !(typeof replyObj === "string") && !!replyObj?.suggestSave;

      if (suggestSave && sessionId) setPendingQuestion(sessionId, inputText);

      const tts = await speakTextToFile(responseText);
      const audioBase64 = fs.readFileSync(tts.path).toString("base64");

      fs.unlinkSync(audioPath);

      InteractionLog.create({
        inputText,
        intent: nlu.intent,
        responseText,
      }).catch(() => {});

      return res.json({
        inputText,
        intent: nlu.intent,
        entities: nlu.entities,
        responseText,
        audioBase64,
      });
    } catch (err) {
      console.error("/api/voice-bot error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

// SAVE PENDING QUESTION (protected)
app.post("/api/save-question", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const sessionId = readSessionId(req);

    // Check if user provided the question explicitly (rare)
    const nlu = await detectIntent(text || "");
    let questionToSave = (nlu?.entities?.question || "").trim();
    if (!questionToSave) questionToSave = getPendingQuestion(sessionId);

    if (!questionToSave)
      return res
        .status(400)
        .json({
          error: "No question found to save. Please re-state the question.",
        });

    const { FAQ } = await import("./services/db.js");
    const existing = await FAQ.findOne({
      question: {
        $regex: new RegExp("^" + escapeRegex(questionToSave) + "$", "i"),
      },
    });
    if (existing) {
      clearPendingQuestion(sessionId);
      return res.json({
        message: "This question already exists in the FAQ list.",
      });
    }

    await FAQ.create({
      question: questionToSave,
      answer: "No answer yet. Admin will review.",
    });
    clearPendingQuestion(sessionId);

    InteractionLog.create({
      inputText: text || "",
      intent: "save_question",
      responseText: "Saved pending question",
    }).catch(() => {});

    return res.json({
      message:
        "Your question has been saved for review. We'll add an answer soon.",
    });
  } catch (err) {
    console.error("/api/save-question error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

const idUpload = multer({ dest: "uploads/idproofs/" });

app.post("/api/register-full", idUpload.single("idproof"), async (req, res) => {
  try {
    const { username, password, name, balance } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Auto-generate accountId
    const nextId = Date.now(); // Simple reliable unique ID
    const accountId = String(nextId).slice(-6); // e.g. "492351"

    // Create Account
    const account = await Account.create({
      accountId,
      name,
      balance: Number(balance) || 0,
      idProofUrl: req.file ? `/uploads/idproofs/${req.file.filename}` : null,
    });

    // Create User login
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash,
      accountId,
    });

    // Login token immediately
    const token = jwt.sign(
      { userId: user._id.toString(), accountId },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    return res.json({
      message: "Registration successful",
      token,
      accountId,
      name,
    });
  } catch (err) {
    console.error("Register-full error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Serve TTS
app.use("/tts", express.static(path.join(process.cwd(), "tts_output")));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// small helper
function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
