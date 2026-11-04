import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const wd = await client.query(
    `SELECT id, status, "grossCents", "userId" FROM withdrawal WHERE id = $1 FOR UPDATE`,
    ["cmw159p5r00eigkvr0twvul5n"],
  );
  const row = wd.rows[0];
  if (!row || row.status !== "PENDING") {
    console.log("skip", row?.status ?? "missing");
    await client.query("ROLLBACK");
  } else {
    const updated = await client.query(
      `UPDATE wallet
       SET "usdCents" = "usdCents" + $1,
           "balanceCents" = "balanceCents" + $1,
           "vendorUsdCents" = "vendorUsdCents" + $1
       WHERE "userId" = $2
       RETURNING "usdCents", "balanceCents", "buyerUsdCents", "vendorUsdCents"`,
      [row.grossCents, row.userId],
    );
    await client.query(
      `UPDATE withdrawal SET status = 'FAILED' WHERE id = $1`,
      [row.id],
    );
    await client.query(
      `UPDATE wallet_transaction
       SET status = 'FAILED', "balanceAfterCents" = $2
       WHERE type = 'WITHDRAWAL' AND reference = $1`,
      [`WD-${row.id.slice(0, 8)}`, updated.rows[0].usdCents],
    );
    await client.query("COMMIT");
    console.log("restored", JSON.stringify(updated.rows[0]));
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
const one = await pool.query(`
  SELECT id, status, bucket, "grossCents", "netCents", "feeCents", currency, "paidAt", "createdAt"
  FROM withdrawal
  WHERE id = 'cmw159p5r00eigkvr0twvul5n'
`);
console.log("one", JSON.stringify(one.rows, null, 2));
const linked = await pool.query(`
  SELECT t.type, t."amountCents", t."balanceAfterCents", t.status, t.metadata,
         w."usdCents", w."balanceCents", w."buyerUsdCents", w."vendorUsdCents", w."courierUsdCents"
  FROM wallet_transaction t
  JOIN wallet w ON w.id = t."walletId"
  WHERE t.metadata::text LIKE '%cmw159p5r00eigkvr0twvul5n%'
     OR t.reference LIKE 'WD-cmw159p5%'
`);
console.log("linked", JSON.stringify(linked.rows, null, 2));
const tx = await pool.query(`
  SELECT type, "amountCents", "balanceAfterCents", status, currency, "createdAt"
  FROM wallet_transaction
  WHERE type = 'WITHDRAWAL'
  ORDER BY "createdAt" DESC
  LIMIT 5
`);
console.log("withdrawals", JSON.stringify(tx.rows, null, 2));
if (tx.rows.length) {
  const w = await pool.query(`
    SELECT w."usdCents", w."balanceCents", w."buyerUsdCents", w."vendorUsdCents", w."courierUsdCents"
    FROM wallet w
    JOIN wallet_transaction t ON t."walletId" = w.id
    WHERE t.type = 'WITHDRAWAL'
    ORDER BY t."createdAt" DESC
    LIMIT 1
  `);
  console.log("wallet", JSON.stringify(w.rows, null, 2));
}
const recent = await pool.query(`
  SELECT type, "amountCents", "balanceAfterCents", status, currency, provider, "createdAt"
  FROM wallet_transaction
  ORDER BY "createdAt" DESC
  LIMIT 15
`);
console.log("recent", JSON.stringify(recent.rows, null, 2));
const wd = await pool.query(`
  SELECT status, "grossCents", "netCents", "feeCents", bucket, currency, "paidAt"
  FROM withdrawal
  ORDER BY "createdAt" DESC
  LIMIT 5
`);
console.log("wd", JSON.stringify(wd.rows, null, 2));
await pool.end();
