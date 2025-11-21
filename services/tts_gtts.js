import fs from "fs-extra";
import path from "path";
import gTTS from "gtts";

export async function speakTextToFile(text) {
  const outDir = path.join(process.cwd(), "tts_output");
  await fs.ensureDir(outDir);

  const filename = `tts_${Date.now()}.mp3`;
  const outPath = path.join(outDir, filename);

  const tts = new gTTS(text, "en");

  return new Promise((resolve, reject) => {
    tts.save(outPath, err => {
      if (err) reject(err);
      else resolve(outPath);
    });
  });
}
