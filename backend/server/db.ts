// db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/backend/schema.ts";
import "dotenv/config";

// ✅ Configure the database pool and Drizzle ORM
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("❌ DATABASE_URL is missing. Please set it in your environment (either .env file or Codespaces/Render secrets).");
}

// ✅ PostgreSQL Pool with SSL support for cloud environments like Render
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false, // 🔐 Allows connecting to databases with self-signed SSL certificates, common on cloud platforms.
  },
});

// ✅ Initialize Drizzle ORM
export const db = drizzle(pool, { schema });

// ✅ Optional: Export the pool as well if you need to perform direct queries or management (e.g., migrations)
export const databasePool = pool;
