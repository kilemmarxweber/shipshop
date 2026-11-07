import { daysAgo, utcDay } from "@/lib/growth/constants";
import { prisma, withDbRetry } from "@/lib/prisma";

/** Interrupteur owner : challenges visibles feed / Découvrir. */
export async function isChallengesEnabled() {
  try {
    const row = await withDbRetry(() =>
      prisma.contentSourceConfig.findUnique({
        where: { id: "default" },
        select: { challengesEnabled: true },
      }),
    );
    return Boolean(row?.challengesEnabled);
  } catch {
    // Colonne absente avant migration — traiter comme off
    return false;
  }
}

export async function setChallengesEnabled(enabled: boolean) {
  try {
    return await withDbRetry(() =>
      prisma.contentSourceConfig.upsert({
        where: { id: "default" },
        create: { id: "default", challengesEnabled: enabled },
        update: { challengesEnabled: enabled },
      }),
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (
      /challengesEnabled|Unknown column|does not exist|P2022/i.test(message)
    ) {
      throw new Error(
        "Colonne challengesEnabled absente — lance la migration DB",
      );
    }
    throw cause instanceof Error
      ? cause
      : new Error("Activation challenges impossible");
  }
}

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

const challengeEventSelect = {
  id: true,
  title: true,
  imageUrl: true,
  currency: true,
  fxCdfPerUsd: true,
  fxKwPerUsd: true,
  organizerName: true,
  organizerKind: true,
  status: true,
  ticketTypes: {
    orderBy: { sortOrder: "asc" as const },
    select: { priceCents: true, name: true },
  },
} as const;

export const challengeInclude = {
  product: { select: challengeProductSelect },
  event: { select: challengeEventSelect },
} as const;

/**
 * Challenges actifs programmés dans les paramètres owner/admin.
 * (interrupteur on + fenêtre startsAt/endsAt + programmed=true)
 */
export async function listActiveChallenges() {
  if (!(await isChallengesEnabled())) return [];
  return withDbRetry(() =>
    prisma.dailyChallenge.findMany({
      where: {
        programmed: true,
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
      },
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      include: challengeInclude,
    }),
  );
}

/** @deprecated alias — plus de seed implicite */
export async function ensureActiveChallenges() {
  return listActiveChallenges();
}

/**
 * Anciennes lignes catalogue auto : ne plus les afficher.
 * (titres du catalogue type, sans ancrage produit)
 */
export async function demoteLegacyCatalogChallenges() {
  const titles = CHALLENGE_CATALOG.map((row) => row.title);
  try {
    await withDbRetry(() =>
      prisma.dailyChallenge.updateMany({
        where: {
          title: { in: [...titles] },
          productFocus: "none",
          productId: null,
          programmed: true,
        },
        data: { programmed: false },
      }),
    );
  } catch {
    /* colonne absente avant migration */
  }
}

/** Seed catalogue = brouillons non affichés (programmed=false). Feed = pub admin only. */
export async function seedCatalogChallenges() {
  if (!(await isChallengesEnabled())) {
    throw new Error(
      "Activez d’abord les challenges dans les paramètres (owner)",
    );
  }
  await demoteLegacyCatalogChallenges();
  const start = utcDay();
  const end = utcDay(daysAgo(-1));
  const existing = await withDbRetry(() =>
    prisma.dailyChallenge.findMany({
      where: { title: { in: CHALLENGE_CATALOG.map((row) => row.title) } },
      select: { title: true },
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
            programmed: false,
          },
          include: challengeInclude,
        }),
      ),
    );
  }
  return created;
}

export async function ensureTodayChallenge() {
  const all = await listActiveChallenges();
  return all[0] ?? null;
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
  if (!(await isChallengesEnabled())) {
    throw new Error("Challenges désactivés");
  }
  const challenge = await withDbRetry(() =>
    prisma.dailyChallenge.findFirst({
      where: {
        id: challengeId,
        programmed: true,
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
      },
      select: { id: true },
    }),
  );
  if (!challenge) throw new Error("Challenge inactif");

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
