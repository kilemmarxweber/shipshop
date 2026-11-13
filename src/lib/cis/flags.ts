import { prisma, withDbRetry } from "@/lib/prisma";

export async function isCisRankingEnabled() {
  try {
    const row = await withDbRetry(() =>
      prisma.contentSourceConfig.findUnique({
        where: { id: "default" },
        select: { cisRankingEnabled: true },
      }),
    );
    // Pas de ligne config = activé par défaut (consentement user toujours requis).
    if (!row) return true;
    return Boolean(row.cisRankingEnabled);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /cisRankingEnabled|Unknown column|does not exist|P2022/i.test(message)
    ) {
      return true;
    }
    throw error;
  }
}

export async function setCisRankingEnabled(enabled: boolean) {
  return withDbRetry(() =>
    prisma.contentSourceConfig.upsert({
      where: { id: "default" },
      create: { id: "default", cisRankingEnabled: enabled },
      update: { cisRankingEnabled: enabled },
    }),
  );
}
