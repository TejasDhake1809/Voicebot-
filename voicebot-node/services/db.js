// db.js
import mongoose from "mongoose";

export async function initDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000
    });
    console.log("MongoDB (Mongoose) connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

// Account Schema
const accountSchema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  balance: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ["active", "inactive", "closed"], default: "active" }
});

export const Account = mongoose.model("Account", accountSchema);

// FAQ Schema
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, index: true },
  answer: { type: String, required: true }
});

export const FAQ = mongoose.model("FAQ", faqSchema);

// Interaction log
const interactionSchema = new mongoose.Schema({
  inputText: String,
  intent: String,
  responseText: String,
  audioOut: String,
  createdAt: { type: Date, default: Date.now }
});

export const InteractionLog = mongoose.model("InteractionLog", interactionSchema);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  accountId: { type: String, required: true }  // <-- IMPORTANT
});

export const User = mongoose.model("User", userSchema);
