// nlu_gemini.js
import axios from "axios";

export async function detectIntent(text) {
  const prompt = `
You are an intent classifier.

User message: "${text}"

Return ONLY pure JSON. No markdown, no backticks, no explanation.

JSON schema:
{
  "intent": "",                  // check_balance, deposit, withdraw, get_owner, account_details, faq, save_question, greeting, goodbye, smalltalk
  "entities": {
    "accountId": null,           // digits or null
    "amount": null,              // numeric or null
    "question": null             // for FAQ intents
  }
}

Rules:
- If user asks about balance -> check_balance
- If user asks to deposit/put/add money -> deposit (extract amount)
- If user asks to withdraw/take -> withdraw (extract amount)
- If user asks "who owns", "owner", "account holder" -> get_owner (extract accountId)
- If user asks "show account details" or "details for account X" -> account_details (extract accountId)
- If user asks a general question "how to ...", "what is ..." -> faq (entities.question = user's text)
- If user asks to "save" or "store this question" -> save_question (entities.question)
- Default -> smalltalk

Return values:
- Intent must be a string.
- Entities must match the schema. Use null for missing values.
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

    // Clean common Markdown/code fences
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    // Try parse -> fallback to extracting {...}
    try {
      return sanitize(JSON.parse(raw));
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return sanitize(JSON.parse(match[0]));
        } catch (e2) {
          console.error("NLU: JSON parse failed after extraction:", e2);
        }
      }
      console.error("NLU RAW (unparseable):", raw);
      return { intent: "smalltalk", entities: { accountId: null, amount: null, question: null } };
    }
  } catch (err) {
    console.error("Gemini RAW Error:", err.response?.data || err.message || err);
    return { intent: "smalltalk", entities: { accountId: null, amount: null, question: null } };
  }
}

function sanitize(obj) {
  const out = {
    intent: typeof obj?.intent === "string" ? obj.intent : "smalltalk",
    entities: { accountId: null, amount: null, question: null }
  };

  const e = obj?.entities || {};
  if (e.accountId != null) {
    const digits = String(e.accountId).match(/\d+/g);
    if (digits) out.entities.accountId = digits.join("");
  }

  if (e.amount != null) {
    const num = Number(String(e.amount).replace(/[^0-9.-]+/g, ""));
    if (!Number.isNaN(num)) out.entities.amount = num;
  }

  if (e.question != null) {
    out.entities.question = String(e.question).trim();
  }

  return out;
}
