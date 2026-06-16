// db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

// 🛑 ध्यान दें: यहाँ '*' हटाकर केवल '{ schema }' (curly braces के साथ) इम्पोर्ट करें
//import { schema } from "../shared/backend/schema.ts"; 
import * as allSchema from "../shared/backend/schema";


const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
});

// ✅ अब यहाँ 'schema' को सीधे पास करें
// क्योंकि 'schema' खुद अब टेबल्स और रिलेशंस का combined ऑब्जेक्ट है
export const db = drizzle(pool, { schema: allSchema.schema, logger: true });

export const databasePool = pool;
