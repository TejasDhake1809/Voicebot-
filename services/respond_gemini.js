import { Account } from "./db.js";

export async function generateResponse(userText, intent, entities) {
  const RULES = {
    greeting: "Hello! How can I assist you today?",
    goodbye: "Goodbye! Take care!",
    smalltalk: "I'm here to help you. Could you please clarify?"
  };

  // Rule-based replies first
  if (RULES[intent]) return RULES[intent];

  // Clean ID
  const accountId = String(entities.accountId || "").trim();

  // For intents requiring an account ID
  if (
    ["check_balance", "deposit", "withdraw", "get_owner"].includes(intent)
  ) {
    if (!accountId) return "Please provide your account ID.";
  }

  const account = await Account.findOne({ accountId });

  if (!account) {
    return `I could not find account ${accountId}. Please check the ID.`;
  }

  // ⭐ CHECK BALANCE
  if (intent === "check_balance") {
    return `Your balance for account ${account.accountId} is ₹${account.balance}.`;
  }

  // ⭐ GET OWNER OF ACCOUNT
  if (intent === "get_owner") {
    return `The owner of account ${account.accountId} is ${account.name}.`;
  }

  // ⭐ DEPOSIT
  if (intent === "deposit") {
    if (!entities.amount) return "How much would you like to deposit?";

    account.balance += entities.amount;
    await account.save();

    return `Successfully deposited ₹${entities.amount}. New balance is ₹${account.balance}.`;
  }

  // ⭐ WITHDRAW
  if (intent === "withdraw") {
    if (!entities.amount) return "How much would you like to withdraw?";

    if (account.balance < entities.amount) {
      return "Insufficient balance.";
    }

    account.balance -= entities.amount;
    await account.save();

    return `Successfully withdrew ₹${entities.amount}. Remaining balance is ₹${account.balance}.`;
  }

  return "Let me help you with that.";
}
