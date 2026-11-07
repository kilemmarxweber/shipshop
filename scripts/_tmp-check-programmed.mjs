import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const r = await pool.query(`
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'daily_challenge'
  ORDER BY ordinal_position
`);
console.log(r.rows.map((x) => x.column_name).join(", "));
console.log("has programmed:", r.rows.some((x) => x.column_name === "programmed"));
await pool.end();
