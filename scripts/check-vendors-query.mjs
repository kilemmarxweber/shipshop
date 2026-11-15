import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const shops = await prisma.shop.findMany({
    take: 2,
    select: {
      id: true,
      name: true,
      owner: {
        select: {
          id: true,
          name: true,
          liveAccessGrantedAt: true,
        },
      },
    },
  });
  console.log(
    "OK",
    shops.length,
    shops.map((s) => s.name),
  );
} catch (e) {
  console.error("FAIL", e.message?.slice(0, 500) ?? e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
