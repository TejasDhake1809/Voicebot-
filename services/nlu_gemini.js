import axios from "axios";

export async function detectIntent(text) {
  const prompt = `
You are an intent classifier.

User message: "${text}"

Return ONLY pure JSON. No markdown. No backticks.

JSON schema:
{
  "intent": "",
  "entities": {
    "accountId": null,
    "amount": null
  }
}

Intent rules:
- "check_balance" → asking for balance
- "deposit" → adding money
- "withdraw" → removing money
- "get_owner" → asking who owns an account (who is the owner, account holder, etc.)
- greeting → hi, hello
- goodbye → bye
- smalltalk → anything else
`;

  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    let raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Remove accidental markdown
    raw = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    // First parse attempt
    try {
      return sanitize(JSON.parse(raw));
    } catch (err) {
      // Fallback: extract first {...}
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return sanitize(JSON.parse(match[0]));
      throw new Error("NLU: No valid JSON returned");
    }
  } catch (err) {
    console.error("Gemini RAW Error:", err.response?.data || err);
    return {
      intent: "smalltalk",
      entities: { accountId: null, amount: null }
    };
  }
}

function sanitize(obj) {
  const out = {
    intent: obj?.intent ?? "smalltalk",
    entities: {
      accountId: null,
      amount: null
    }
  };

  if (obj?.entities) {
    const e = obj.entities;

    // Normalize accountId (digits only)
    if (e.accountId) {
      const digits = String(e.accountId).match(/\d+/g);
      if (digits) out.entities.accountId = digits.join("");
    }

    // Normalize amount
    if (e.amount) {
      const num = Number(String(e.amount).replace(/[^0-9.]+/g, ""));
      if (!isNaN(num)) out.entities.amount = num;
    }
  }

  return out;
}
