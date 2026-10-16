import "dotenv/config";
import { Pool } from "pg";

const p = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await p.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name = 'user' AND column_name IN ('locale', 'theme')`,
);
console.log(r.rows);
await p.end();
