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

  // sample users (username/password -> account)
  const users = [
    { username: "alice", password: "alicepass", accountId: "101" },
    { username: "bob", password: "bobpass", accountId: "102" }
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await User.updateOne({ username: u.username }, { $set: { username: u.username, passwordHash: hash, accountId: u.accountId } }, { upsert: true });
  }

  console.log("Seeding finished");
  process.exit(0);
}

seed();
