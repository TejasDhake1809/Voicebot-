// nlu_gemini.js
import axios from "axios";

export async function detectIntent(text) {
  const prompt = `
You are a strict banking NLU classifier. You must ALWAYS return JSON only.

User message: "${text}"

OUTPUT FORMAT (ONLY JSON):
{
  "intent": "",
  "entities": {
    "accountId": null,
    "amount": null,
    "question": null
  }
}

==================== RULES ====================

INTENT RULES (very strict):

1. **check_balance**
   - Keywords: "balance", "how much money", "remaining money", "check my balance"

2. **deposit**
   - Keywords: "deposit", "add", "put money", "credit", "add amount"
   - Extract amount if present.

3. **withdraw**
   - Keywords: "withdraw", "take out", "remove money", "debit"
   - Extract amount if present.

4. **get_owner**
   - VERY IMPORTANT:
   - Trigger when user asks who owns an account.
   - Keywords:
     - "owner"
     - "who owns"
     - "who is the owner"
     - "account holder"
     - "whose account"
   - ALWAYS extract accountId when numbers appear.

   EXAMPLES THAT MUST BE get_owner:
   - "Who is the owner of account 101?"
   - "Who owns account number 555?"
   - "Tell me the account holder of 3001"

5. **account_details**
   - Keywords:
     - "account details"
     - "show details"
     - "info for account"
     - "details of account 123"

6. **faq**
   - General knowledge or HOW questions NOT related to accounts:
     - "How to open an account?"
     - "What are your working hours?"

7. **save_question**
   - If user says: "save this", "store this question", "yes save", "please save it"

8. **greeting / goodbye**
   - hello / hi / bye / goodnight etc.

9. **smalltalk (fallback)**

================================================

ENTITY RULES:
- accountId → extract ANY digits in the message.
- amount → extract any number with or without currency.
- question → if faq or save_question, put the original user text.

REMEMBER:
- STRICT JSON ONLY
- Do not include commentary or markdown
`;

  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { timeout: 12000 }
    );

    let raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      return sanitize(JSON.parse(raw));
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return sanitize(JSON.parse(match[0]));
      console.error("NLU RAW (unparseable):", raw);
      return fallback();
    }
  } catch (err) {
    console.error("Gemini RAW Error:", err.response?.data || err.message);
    return fallback();
  }
}

function sanitize(obj) {
  const out = {
    intent: typeof obj?.intent === "string" ? obj.intent : "smalltalk",
    entities: { accountId: null, amount: null, question: null },
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

function fallback() {
  return {
    intent: "smalltalk",
    entities: { accountId: null, amount: null, question: null },
  };
}
