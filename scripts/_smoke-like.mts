import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const live = await prisma.creatorLive.findFirst({
  select: { id: true, likeCount: true },
});
console.log("find", live);
if (live) {
  const u = await prisma.creatorLive.update({
    where: { id: live.id },
    data: { likeCount: { increment: 0 } },
    select: { id: true, likeCount: true },
  });
  console.log("update ok", u);
}
await prisma.$disconnect();
await pool.end();
