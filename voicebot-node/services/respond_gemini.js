// respond_gemini.js
import { Account, FAQ } from "./db.js";

// === FAQ fuzzy matching helpers ===================================

// Escape regex
function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Simple “does this look like a question?”
function looksLikeQuestion(text) {
  if (!text) return false;
  const s = String(text).toLowerCase().trim();
  return (
    s.endsWith("?") ||
    /\b(how|what|why|when|who|which|can|could|should)\b/.test(s)
  );
}

// Fuzzy similarity (normalized Levenshtein)
function similarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = [];
  for (let i = 0; i <= b.length; i++) {
    m[i] = [i];
    for (let j = 1; j <= a.length; j++) {
      m[i][j] =
        i === 0
          ? j
          : Math.min(
              m[i - 1][j] + 1,
              m[i][j - 1] + 1,
              m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)
            );
    }
  }
  const dist = m[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

const FUZZY_THRESHOLD = 0.45;


// ===================================================================
//                          MAIN FUNCTION
// ===================================================================

export async function generateResponse(
  userText,
  intent,
  entities,
  currentAccountId = null
) {
  // Basic responses
  const RULES = {
    greeting: "Hello! How can I assist you today?",
    goodbye: "Goodbye! Take care!",
    smalltalk: "I'm here to help you. Could you please clarify?"
  };
  if (RULES[intent]) return RULES[intent];

  // ================================================================
  //          ACCOUNT ID NORMALIZATION + SECURITY FIX
  // ================================================================
  let accountId = entities.accountId ? String(entities.accountId).trim() : null;

  // If user did not specify ANY account ID → use THEIR OWN account ID
  if (!accountId && currentAccountId) {
    accountId = currentAccountId;
  }

  // For intents that need an account
  if (["check_balance", "deposit", "withdraw", "get_owner", "account_details"].includes(intent)) {

    // If STILL no accountId
    if (!accountId) {
      return "Please provide your account ID.";
    }

    // If user explicitly mentioned a different accountId → unauthorized
    if (entities.accountId && accountId !== currentAccountId) {
      return "You are not authorized to access another user's account.";
    }
  }

  // ================================================================
  //                     BUSINESS LOGIC
  // ================================================================

  // ACCOUNT DETAILS
  if (intent === "account_details") {
    const account = await Account.findOne({ accountId });
    if (!account) return `Account ${accountId} not found.`;
    return `Account ID: ${account.accountId}
Name: ${account.name}
Balance: ₹${account.balance}
Status: ${account.status}`;
  }

  // CHECK BALANCE
  if (intent === "check_balance") {
    const account = await Account.findOne({ accountId });
    if (!account) return `I could not find account ${accountId}.`;
    return `Your balance for account ${account.accountId} is ₹${account.balance}.`;
  }

  // GET OWNER
  if (intent === "get_owner") {
    const account = await Account.findOne({ accountId });
    if (!account) return `I could not find account ${accountId}.`;
    return `The owner of account ${account.accountId} is ${account.name}.`;
  }

  // DEPOSIT
  if (intent === "deposit") {
    if (entities.amount == null) return "How much would you like to deposit?";
    const account = await Account.findOne({ accountId });
    if (!account) return `I could not find account ${accountId}.`;
    account.balance += Number(entities.amount);
    await account.save();
    return `Successfully deposited ₹${entities.amount}. New balance is ₹${account.balance}.`;
  }

  // WITHDRAW
  if (intent === "withdraw") {
    if (entities.amount == null) return "How much would you like to withdraw?";
    const account = await Account.findOne({ accountId });
    if (!account) return `I could not find account ${accountId}.`;
    if (account.balance < Number(entities.amount)) return "Insufficient balance.";
    account.balance -= Number(entities.amount);
    await account.save();
    return `Successfully withdrew ₹${entities.amount}. Remaining balance is ₹${account.balance}.`;
  }

  // ================================================================
  //                          FAQ SEARCH
  // ================================================================
  if (intent === "faq" || looksLikeQuestion(userText)) {
    const q = (entities.question || userText || "").trim();
    if (!q) return "Please tell me your question.";

    // 1. Try exact or close regex match
    const words = q.replace(/[?.,!]/g, "").split(" ");
    const allFAQs = await FAQ.find({}).limit(300);

    let best = null;
    let bestScore = 0;

    for (const f of allFAQs) {
      const base = String(f.question || "").toLowerCase();
      const lowerQ = q.toLowerCase();
      const sim1 = similarity(lowerQ, base);

      let sim2 = 0;
      for (const w of words) {
        if (!w.trim()) continue;
        if (base.includes(w.toLowerCase())) sim2 += 0.1;
      }

      const score = sim1 + sim2;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }

    if (best && bestScore >= FUZZY_THRESHOLD) {
      return best.answer;
    }

    // No match → ask user if they want to save it
    return {
      text: "I don't have an exact answer for that. Would you like me to save this question for review?",
      suggestSave: true
    };
  }

  // ================================================================
  //                   SAVE QUESTION
  // ================================================================
  if (intent === "save_question") {
    const q = entities.question || userText;
    if (!q) return "Please tell me which question you'd like saved.";

    const existing = await FAQ.findOne({
      question: { $regex: new RegExp("^" + escapeRegex(q.trim()) + "$", "i") }
    });
    if (existing) {
      return "This question already exists in our FAQ list.";
    }

    await FAQ.create({
      question: q,
      answer: "No answer yet. Admin will review."
    });

    return "Your question has been saved for review. We'll add an answer soon.";
  }

  // Default
  return "Let me help you with that.";
}
