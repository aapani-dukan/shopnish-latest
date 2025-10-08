import { defineConfig, type Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Please set it in your environment and provision the database."
  );
}

export default defineConfig({
  out: "./drizzle/migrations",
  schema: [
    "./shared/backend/tables.ts",
    "./shared/backend/relations.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string, // ✅ यही सही key है
  },
}) satisfies Config;
