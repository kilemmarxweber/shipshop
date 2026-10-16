import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows: shops } = await pool.query(
    `SELECT s.id, s.name, s."isActive",
      (SELECT COUNT(*)::int FROM product p WHERE p."shopId"=s.id) AS products,
      (SELECT COUNT(*)::int FROM product p WHERE p."shopId"=s.id AND p.status='HIDDEN') AS hidden,
      (SELECT COUNT(*)::int FROM product p WHERE p."shopId"=s.id AND p.status='ACTIVE') AS active,
      (SELECT COUNT(*)::int FROM product p WHERE p."shopId"=s.id AND p.status='DRAFT') AS draft
     FROM shop s ORDER BY s."createdAt" DESC`,
  );
  console.log(JSON.stringify(shops, null, 2));
} finally {
  await pool.end();
}
