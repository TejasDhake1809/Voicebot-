// stt_deepgram.js
import { createClient } from "@deepgram/sdk";
import fs from "fs";
import path from "path";

// Initialize Deepgram client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

export async function transcribeFile(filePath) {
  try {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      console.error("STT Error: File does not exist:", filePath);
      return "";
    }

    // Read audio file
    const audio = fs.readFileSync(filePath);

    // Detect audio format from extension
    const ext = path.extname(filePath).replace(".", "").toLowerCase();

    const mimeTypes = {
      wav: "audio/wav",
      mp3: "audio/mp3",
      m4a: "audio/m4a",
      webm: "audio/webm",
      ogg: "audio/ogg",
      flac: "audio/flac"
    };

    const mimetype = mimeTypes[ext] || "audio/wav"; // default fallback

    // Call Deepgram
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audio,
      {
        model: "nova-2",
        smart_format: true,
        mimetype: mimetype
      }
    );

    if (error) {
      console.error("Deepgram STT Error:", error);
      return "";
    }

    // Extract transcript safely
    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    return transcript.trim();
  } catch (err) {
    console.error("STT Exception:", err);
    return "";
  }
}
