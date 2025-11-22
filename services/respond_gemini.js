// respond_gemini.js
import { Account, FAQ } from "./db.js";

export async function generateResponse(userText, intent, entities) {
  const RULES = {
    greeting: "Hello! How can I assist you today?",
    goodbye: "Goodbye! Take care!",
    smalltalk: "I'm here to help you. Could you please clarify?"
  };

  if (RULES[intent]) return RULES[intent];

  const accountId = String(entities.accountId || "").trim();

  // Intents that require account ID
  if (["check_balance", "deposit", "withdraw", "get_owner", "account_details"].includes(intent)) {
    if (!accountId) return "Please provide your account ID.";
  }

  // ACCOUNT DETAILS
  if (intent === "account_details") {
    const account = await Account.findOne({ accountId });
    if (!account) return `Account ${accountId} not found.`;
    return `Account ID: ${account.accountId}\nName: ${account.name}\nBalance: ₹${account.balance}\nStatus: ${account.status}`;
  }

  // CHECK BALANCE
  if (intent === "check_balance") {
    const account = await Account.findOne({ accountId });
    if (!account) return `I could not find account ${accountId}. Please check the ID.`;
    return `Your balance for account ${account.accountId} is ₹${account.balance}.`;
  }

  // GET OWNER
  if (intent === "get_owner") {
    const account = await Account.findOne({ accountId });
    if (!account) return `I could not find account ${accountId}. Please check the ID.`;
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

  // FAQ search
  if (intent === "faq") {
    const q = entities.question || userText;
    // first try exact or partial match
    const faq = await FAQ.findOne({ question: { $regex: q, $options: "i" } });
    if (faq) return faq.answer;
    return "I don't have an exact answer for that. Would you like me to save this question for review?";
  }

  // SAVE QUESTION
  if (intent === "save_question") {
    const q = entities.question || userText;
    if (!q) return "Please tell me which question you'd like saved.";
    await FAQ.create({ question: q, answer: "No answer yet. Admin will review." });
    return "Your question has been saved for review. We'll add an answer soon.";
  }

  return "Let me help you with that.";
}
