import "dotenv/config";
import { MongoClient } from "mongodb";

async function testMongo() {
  console.log("Loaded URI:", process.env.MONGO_URI);

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log("❌ MONGO_URI missing in .env");
    return;
  }

  const client = new MongoClient(uri);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("✅ CONNECTED!");

    const db = client.db("voicebot");

    console.log("\nChecking collections...");
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));

    console.log("\nChecking accounts...");
    const oneAccount = await db.collection("accounts").findOne({});
    console.log("Sample account:", oneAccount);

  } catch (err) {
    console.log("❌ ERROR:", err.message);
  } finally {
    await client.close();
    console.log("Closed connection.");
  }
}

testMongo();
