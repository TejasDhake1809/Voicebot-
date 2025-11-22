// respond_gemini.js (Optimized for your FAQ dataset)
import { Account, FAQ } from "./db.js";

// New weights tuned for your FAQ list
const FUZZY_THRESHOLD = 0.45;
const MAX_CANDIDATES = 300;

export async function generateResponse(userText, intent, entities) {
  const RULES = {
    greeting: "Hello! How can I assist you today?",
    goodbye: "Goodbye! Take care!",
    smalltalk: "I'm here to help you. Could you please clarify?"
  };

  if (RULES[intent]) return RULES[intent];

  const accountId = String(entities.accountId || "").trim();

  // Intents requiring account ID
  if (["check_balance", "deposit", "withdraw", "get_owner", "account_details"].includes(intent)) {
    if (!accountId) return "Please provide your account ID.";
  }

  // ACCOUNT LOGIC (unchanged)
  if (intent === "account_details") {
    const acc = await Account.findOne({ accountId });
    if (!acc) return `Account ${accountId} not found.`;
    return `Account ID: ${acc.accountId}\nName: ${acc.name}\nBalance: ₹${acc.balance}\nStatus: ${acc.status}`;
  }

  if (intent === "check_balance") {
    const acc = await Account.findOne({ accountId });
    if (!acc) return `I could not find account ${accountId}.`;
    return `Your balance for account ${acc.accountId} is ₹${acc.balance}.`;
  }

  if (intent === "get_owner") {
    const acc = await Account.findOne({ accountId });
    if (!acc) return `I could not find account ${accountId}.`;
    return `The owner of account ${acc.accountId} is ${acc.name}.`;
  }

  if (intent === "deposit") {
    if (entities.amount == null) return "How much would you like to deposit?";
    const acc = await Account.findOne({ accountId });
    if (!acc) return `I could not find account ${accountId}.`;
    acc.balance += Number(entities.amount);
    await acc.save();
    return `Successfully deposited ₹${entities.amount}. New balance is ₹${acc.balance}.`;
  }

  if (intent === "withdraw") {
    if (entities.amount == null) return "How much would you like to withdraw?";
    const acc = await Account.findOne({ accountId });
    if (!acc) return `I could not find account ${accountId}.`;
    if (acc.balance < Number(entities.amount)) return "Insufficient balance.";
    acc.balance -= Number(entities.amount);
    await acc.save();
    return `Successfully withdrew ₹${entities.amount}. Remaining balance is ₹${acc.balance}.`;
  }

  // FAQ LOGIC (Improved)
  if (intent === "faq" || looksLikeFAQ(userText)) {
    const q = (entities.question || userText || "").trim();

    // Step 1: quick regex match
    try {
      const regex = new RegExp(escapeRegex(q), "i");
      const exact = await FAQ.findOne({ question: { $regex: regex } });
      if (exact) return exact.answer;
    } catch {}

    // Step 2: load candidates
    let candidates = await FAQ.find().limit(MAX_CANDIDATES).lean();

    // Step 3: compute best fuzzy match
    const scores = candidates.map((doc) => ({
      doc,
      score: faqSimilarity(q, doc.question)
    }));

    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (best && best.score >= FUZZY_THRESHOLD) {
      return best.doc.answer;
    }

    return {
      text: "I don't have an exact answer for that. Would you like me to save this question for review?",
      suggestSave: true
    };

  }

  // Save question
  if (intent === "save_question") {
    const q = entities.question || userText;
    if (!q) return "Please tell me which question you'd like saved.";
    const existing = await FAQ.findOne({
      question: { $regex: new RegExp("^" + escapeRegex(q.trim()) + "$", "i") }
    });
    if (existing) return "This question already exists in the FAQ list.";
    await FAQ.create({ question: q, answer: "No answer yet. Admin will review." });
    return "Your question has been saved for review.";
  }

  return "Let me help you with that.";
}

/*************** FAQ SIMILARITY FUNCTIONS *****************/

function faqSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);

  const lev = levenshteinRatio(na, nb);
  const jac = jaccard(na.split(" "), nb.split(" "));
  const tok = tokenOverlap(na.split(" "), nb.split(" "));

  return lev * 0.25 + jac * 0.55 + tok * 0.20;
}

// Remove filler words + normalize
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => !["my","your","the","a","an","to","for","me","please","can","could","would"].includes(w))
    .join(" ")
    .trim();
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = new Set([...A].filter(x => B.has(x)));
  const union = new Set([...A, ...B]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

function tokenOverlap(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0) return 0;
  const inter = new Set([...A].filter(x => B.has(x)));
  return inter.size / Math.min(A.size, B.size);
}

function levenshteinRatio(a, b) {
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// Detect if question is FAQ-like
function looksLikeFAQ(text) {
  text = text.toLowerCase();
  return (
    text.includes("how to") ||
    text.includes("how do") ||
    text.includes("i want to") ||
    text.includes("what to do") ||
    text.includes("please explain") ||
    text.includes("how can i")
  );
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
