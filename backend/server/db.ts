// db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/backend/schema.ts";
// import * as relations from "../shared/backend/relations.ts"; // ❌ इसे कमेंट आउट करें
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("❌ DATABASE_URL is missing. Please set it in your environment (either .env file or Codespaces/Render secrets).");
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

// ✅ यहाँ Drizzle को relations पास करना बंद करें
export const db = drizzle(pool, { schema /*, relations: relations */, logger:true }); // relations: relations को भी कमेंट आउट करें

export const databasePool = pool;
