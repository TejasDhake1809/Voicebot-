// nlu_gemini.js
import axios from "axios";

/*
  Highly improved NLU:
  - Strong FAQs detection
  - Local heuristics override Gemini mistakes
*/

export async function detectIntent(text) {
  const cleanedText = normalizeForIntent(text);

  const prompt = `
You are an intent classifier.

User message: "${cleanedText}"

Return ONLY pure JSON. No markdown, no backticks, no explanation.

JSON format:
{
  "intent": "",                  
  "entities": {
    "accountId": null,
    "amount": null,
    "question": null
  }
}

INTENT RULES:
- Balance → check_balance
- Deposit/add/put money → deposit
- Withdraw/take/remove money → withdraw
- "who owns", "owner", "holder" → get_owner
- "details for account", "account details" → account_details
- ANY user question like:
      "how to ...", 
      "how do I ...", 
      "what to do", 
      "can you tell me", 
      "i want to know",
      "steps to ..."
  → faq   (entities.question = entire user text)
- "save", "store this question" → save_question
- Default → smalltalk

RULE: If unsure, choose faq instead of smalltalk.
`;

  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      { timeout: 12000 }
    );

    let raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = sanitize(JSON.parse(raw));
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? sanitize(JSON.parse(match[0])) : { intent: "smalltalk", entities: {} };
    }

    // ---------------------------------------------
    // 🔥 SUPER-IMPORTANT: Override incorrect intent
    // ---------------------------------------------
    if (isFAQ(cleanedText)) {
      parsed.intent = "faq";
      parsed.entities.question = cleanedText;
    }

    // If Gemini "smalltalk" but looks like a question → faq
    if (parsed.intent === "smalltalk" && looksLikeQuestion(cleanedText)) {
      parsed.intent = "faq";
      parsed.entities.question = cleanedText;
    }

    return parsed;

  } catch (err) {
    console.error("Gemini RAW Error:", err.response?.data || err);

    // On any error → treat questions as FAQ
    if (looksLikeQuestion(cleanedText) || isFAQ(cleanedText)) {
      return {
        intent: "faq",
        entities: { accountId: null, amount: null, question: cleanedText }
      };
    }

    return { intent: "smalltalk", entities: { accountId: null, amount: null, question: null } };
  }
}

/* -------------------------------------------------------------------------- */
/*                                Helper Logic                                */
/* -------------------------------------------------------------------------- */

// Normalize STT noisy input
function normalizeForIntent(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\w\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Looks like FAQ based on patterns
function isFAQ(text) {
  return (
    text.startsWith("how to") ||
    text.startsWith("how do i") ||
    text.includes("how can i") ||
    text.includes("i want to") ||
    text.includes("what to do") ||
    text.includes("steps to") ||
    text.includes("can you tell me") ||
    text.includes("please explain") ||
    text.includes("help me") ||
    text.endsWith("?")
  );
}

// Generic question detection
function looksLikeQuestion(text) {
  const qWords = ["what", "how", "why", "when", "where", "who", "which"];
  const first = text.split(" ")[0];
  return text.endsWith("?") || qWords.includes(first);
}

// Clean the JSON
function sanitize(obj) {
  const out = {
    intent: typeof obj?.intent === "string" ? obj.intent : "smalltalk",
    entities: { accountId: null, amount: null, question: null }
  };

  const e = obj?.entities || {};
  if (e.accountId) {
    const digits = String(e.accountId).match(/\d+/g);
    if (digits) out.entities.accountId = digits.join("");
  }

  if (e.amount) {
    const num = Number(String(e.amount).replace(/[^0-9.-]+/g, ""));
    if (!Number.isNaN(num)) out.entities.amount = num;
  }

  if (e.question) {
    out.entities.question = String(e.question).trim();
  }

  return out;
}
