// tts_gtts.js
import fs from "fs-extra";
import path from "path";
import gTTS from "gtts";

export async function speakTextToFile(text = "") {
  try {
    // Empty text fallback
    if (!text || !text.trim()) {
      text = "Sorry, I could not generate a response.";
    }

    // Output directory
    const outDir = path.join(process.cwd(), "tts_output");
    await fs.ensureDir(outDir);

    // MP3 filename
    const filename = `tts_${Date.now()}.mp3`;
    const outPath = path.join(outDir, filename);

    const tts = new gTTS(text, "en");

    return new Promise((resolve, reject) => {
      tts.save(outPath, (err) => {
        if (err) return reject(err);
        resolve({
          path: outPath,
          filename,
          url: `/tts/${filename}`  // If you want to serve audio via Express
        });
      });
    });

  } catch (error) {
    console.error("TTS generation failed:", error);
    return null;
  }
}
