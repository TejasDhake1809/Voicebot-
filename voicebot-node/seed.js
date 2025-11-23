// seed.js
import "dotenv/config";
import { initDB, Account, User } from "./services/db.js";
import bcrypt from "bcryptjs";

await initDB();

async function seed() {
  // sample accounts
  const accounts = [
    { accountId: "101", name: "Alice Example", balance: 5000, status: "active" },
    { accountId: "102", name: "Bob Example", balance: 12000, status: "active" }
  ];

  for (const a of accounts) {
    await Account.updateOne({ accountId: a.accountId }, { $set: a }, { upsert: true });
  }

  console.log("Seeding finished");
  process.exit(0);
}

seed();
