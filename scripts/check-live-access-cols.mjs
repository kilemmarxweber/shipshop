import "dotenv/config";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name LIKE 'liveAccess%'`,
);
console.log(r.rows);
await c.end();
