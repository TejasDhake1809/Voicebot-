import "dotenv/config";

import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs/promises";
import path from "path";

import { initDB, Account, InteractionLog } from "./services/db.js";
import { transcribeFile } from "./services/stt_deepgram.js";
import { detectIntent } from "./services/nlu_gemini.js";
import { generateResponse } from "./services/respond_gemini.js";
import { speakTextToFile } from "./services/tts_gtts.js";

// Initialize DB FIRST
await initDB();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Voice Bot Backend Running"));

app.post("/api/voice-bot", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No audio file provided" });

    const audioPath = req.file.path;

    // 1. STT
    const text = await transcribeFile(audioPath);

    // 2. NLU
    const nlu = await detectIntent(text);

    // 3. Intent Action (Database logic)
    let responseText = await generateResponse(text, nlu.intent, nlu.entities);

    if (nlu.intent === "check_balance") {
      const id = Number(nlu.entities?.accountId || nlu.entities?.id);

      const acc = await Account.findOne({ accountId: id });

      if (acc)
        responseText = `The balance for account ${id} is ₹${acc.balance}.`;
      else
        responseText = `I could not find account ${id}. Please check the ID.`;
    }

    // 4. TTS
    const outFile = await speakTextToFile(responseText);
    const audioBuffer = await fs.readFile(outFile);

    // Cleanup
    await fs.unlink(audioPath);

    // 5. DB Logging
    await InteractionLog.create({
      inputText: text,
      intent: nlu.intent,
      responseText,
      audioOut: outFile
    });

    res.json({
      inputText: text,
      intent: nlu.intent,
      entities: nlu.entities,
      responseText,
      audioBase64: audioBuffer.toString("base64")
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 8000;
app.listen(port, () => console.log("Server running on port", port));
