import fs from "node:fs";

const dir = "prisma/migrations/20261107120000_daily_challenge_programmed";
fs.mkdirSync(dir, { recursive: true });
const sql = `-- Challenges programmés (publiés) vs brouillons catalogue
ALTER TABLE "daily_challenge" ADD COLUMN IF NOT EXISTS "programmed" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "daily_challenge_programmed_startsAt_endsAt_idx"
  ON "daily_challenge"("programmed", "startsAt", "endsAt");
`;
fs.writeFileSync(`${dir}/migration.sql`, sql, { encoding: "utf8" });
const bytes = fs.readFileSync(`${dir}/migration.sql`);
console.log(
  JSON.stringify({
    hasBom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    len: bytes.length,
  }),
);
