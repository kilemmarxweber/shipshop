import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();
try {
  const [count, rows, challengeCols] = await Promise.all([
    prisma.event.count(),
    prisma.event.findMany({
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.dailyChallenge.findMany({
      select: { id: true, title: true, eventId: true },
      where: { eventId: { not: null } },
      take: 10,
    }),
  ]);
  console.log(
    JSON.stringify({ count, rows, linkedChallenges: challengeCols }, null, 2),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
