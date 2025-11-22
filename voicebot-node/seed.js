// seed_faq.js
import "dotenv/config";
import { initDB, FAQ } from "./services/db.js";

async function run() {
  console.log("🌱 Starting FAQ seeding...");

  await initDB();

  // ------------------------------------------------------------
  // 1. OPTIONAL: Clear existing FAQs  
  // Uncomment if you want to REPLACE old FAQs
  // ------------------------------------------------------------
  // await FAQ.deleteMany({});
  // console.log("✔ Old FAQs removed");

  // ------------------------------------------------------------
  // 2. FAQ DATA  
  // ------------------------------------------------------------
  const faqs = [
    {
      question: "how to open an account",
      answer:
        "To open an account, visit our nearest branch with ID and address proof.",
    },
    {
      question: "what are your working hours",
      answer: "Our working hours are 10 AM to 5 PM, Monday to Friday.",
    },
    {
      question: "how to apply for a debit card",
      answer:
        "You can apply for a debit card using our mobile banking app or by visiting the branch.",
    },
    {
      question: "how to reset my net banking password",
      answer:
        "Use the 'Forgot Password' option on the login page or visit the branch with valid ID proof.",
    },
    {
      question: "how to check my last transactions",
      answer:
        "You can check your last transactions from the mobile app, net banking, or by visiting your branch.",
    },
    {
      question: "how to block my debit card",
      answer:
        "Call customer support or use the mobile app to instantly block your debit card.",
    },
    {
      question: "how to update my mobile number",
      answer:
        "Visit your nearest branch with a valid ID proof to update your mobile number.",
    },
    {
      question: "what to do if my account is locked",
      answer:
        "Use the mobile app or net banking to unlock it using OTP, or visit the branch.",
    },
    {
      question: "how to enable international transactions",
      answer:
        "Enable international transactions from your mobile banking app settings.",
    },
    {
      question: "how to transfer money online",
      answer:
        "Log in to your net banking account or mobile app and select the 'Fund Transfer' option.",
    },
  ];

  // ------------------------------------------------------------
  // 3. Upsert each FAQ (prevents duplicates)
  // ------------------------------------------------------------
  for (const f of faqs) {
    await FAQ.updateOne({ question: f.question }, { $set: f }, { upsert: true });
  }

  console.log("✔ FAQs seeded successfully");
  console.log("🌱 FAQ seeding complete.");

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ FAQ seed failed:", err);
  process.exit(1);
});
