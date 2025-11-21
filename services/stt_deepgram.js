import { createClient } from "@deepgram/sdk";
import fs from "fs";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

export async function transcribeFile(filePath) {
  const audio = fs.readFileSync(filePath);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audio, {
    model: "nova-2",
    smart_format: true
  });

  if (error) {
    console.error("Deepgram Error:", error);
    return "";
  }

  return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}
