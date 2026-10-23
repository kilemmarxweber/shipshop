import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error("no user");
  console.log("user", user.id);
  const live = await prisma.creatorLive.create({
    data: {
      userId: user.id,
      title: "Test live debug",
      status: "LIVE",
      lastHeartbeatAt: new Date(),
      plannedMinutes: 60,
      cameraOn: true,
    },
  });
  console.log("OK", live.id);
  await prisma.creatorLive.delete({ where: { id: live.id } });
} catch (e) {
  console.error("FAIL", e);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
