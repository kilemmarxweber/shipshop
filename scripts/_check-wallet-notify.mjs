import { readFileSync } from "node:fs";
import { Pool } from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i);
      let v = l.slice(i + 1);
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [k, v];
    }),
);

const p = new Pool({ connectionString: env.DATABASE_URL });
const c = await p.query(
  `SELECT "notifySms","notifyWhatsapp","notifyEmail" FROM messaging_config LIMIT 1`,
);
console.log("config", JSON.stringify(c.rows, null, 2));
const e = await p.query(`SELECT unnest(enum_range(NULL::"MsgChannel")) AS channel`);
console.log("channels", JSON.stringify(e.rows, null, 2));
const t = await p.query(
  `SELECT "eventKey", channel, "isActive" FROM message_template ORDER BY 1, 2`,
);
console.log("all templates", JSON.stringify(t.rows, null, 2));
const n = await p.query(
  `SELECT "eventKey", channel, status, "toPhone", error, "createdAt" FROM notification_log WHERE "eventKey" LIKE 'WALLET%' ORDER BY "createdAt" DESC LIMIT 20`,
);
console.log("logs", JSON.stringify(n.rows, null, 2));
await p.end();
