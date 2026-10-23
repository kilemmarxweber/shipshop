import { prisma, withDbRetry } from "@/lib/prisma";
import { utcDay, daysAgo } from "@/lib/growth/constants";

export const CHALLENGE_CATALOG = [
  {
    title: "Beauté glow",
    body: "Regarde une story Beauté et dis en commentaire ton rituel.",
    category: "Beauté",
  },
  {
    title: "Challenge mode locale",
    body: "Explore 3 looks Mode et commente celui que tu porterais demain.",
    category: "Mode",
  },
  {
    title: "Top tech du jour",
    body: "Visite 2 boutiques Tech et partage l’article le plus utile.",
    category: "Tech",
  },
  {
    title: "Maison maline",
    body: "Découvre 3 produits Maison à moins de 20 $ et like ton favori.",
    category: "Maison",
  },
  {
    title: "Sport en mouvement",
    body: "Suis une boutique Sport et complète une mission partage.",
    category: "Sport",
  },
  {
    title: "Look du soir",
    body: "Enregistre 2 tenues Mode et like celle que tu porterais ce soir.",
    category: "Mode",
  },
  {
    title: "Rituel bien-être",
    body: "Passe 20 secondes sur 2 produits Beauté et commente ton favori.",
    category: "Beauté",
  },
] as const;

const challengeProductSelect = {
  id: true,
  title: true,
  description: true,
  images: true,
  priceCents: true,
  currency: true,
  category: true,
  shop: { select: { name: true } },
} as const;

export async function ensureActiveChallenges() {
  const start = utcDay();
  const end = utcDay(daysAgo(-1));
  const existing = await withDbRetry(() =>
    prisma.dailyChallenge.findMany({
      where: { startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
      // Plus récents / réactivés d’abord → mise en avant feed & Découvrir
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      include: { product: { select: challengeProductSelect } },
    }),
  );
  const have = new Set(existing.map((row) => row.title));
  const created = [];
  for (const pick of CHALLENGE_CATALOG) {
    if (have.has(pick.title)) continue;
    created.push(
      await withDbRetry(() =>
        prisma.dailyChallenge.create({
          data: {
            title: pick.title,
            body: pick.body,
            category: pick.category,
            city: "Kinshasa",
            startsAt: start,
            endsAt: end,
          },
          include: { product: { select: challengeProductSelect } },
        }),
      ),
    );
  }
  // Ne plus dédupliquer par titre à la lecture : un challenge admin
  // publié ne doit jamais être masqué par le catalogue auto.
  return [...created, ...existing].sort(
    (a, b) =>
      b.startsAt.getTime() - a.startsAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function ensureTodayChallenge() {
  const all = await ensureActiveChallenges();
  return all[0]!;
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Référence courte unique pour le rapport demandeur. */
export function newChallengeParticipationRef() {
  let code = "CHL-";
  for (let i = 0; i < 6; i += 1) {
    code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]!;
  }
  return code;
}

export async function completeChallenge(userId: string, challengeId: string) {
  const existing = await withDbRetry(() =>
    prisma.challengeCompletion.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
    }),
  );
  if (existing) return existing;

  let created = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      created = await withDbRetry(() =>
        prisma.challengeCompletion.create({
          data: {
            challengeId,
            userId,
            reference: newChallengeParticipationRef(),
          },
        }),
      );
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("reference") && !message.includes("Unique")) {
        throw error;
      }
    }
  }
  if (!created) {
    throw new Error("Référence challenge impossible");
  }

  await withDbRetry(() =>
    prisma.dailyChallenge.update({
      where: { id: challengeId },
      data: { completions: { increment: 1 } },
    }),
  );
  return created;
}
