import { prisma, withDbRetry } from "@/lib/prisma";
import { parseChallengeTeaser } from "@/lib/growth/challenge-product";

export type ChallengeParticipantRow = {
  reference: string;
  name: string;
  phone: string | null;
  email: string | null;
  emailVerified: boolean;
  image: string | null;
  joinedAt: string;
  contactOk: boolean;
};

export type ChallengeQualityReport = {
  challenge: {
    id: string;
    title: string;
    body: string;
    category: string | null;
    city: string | null;
    startsAt: string;
    endsAt: string;
    productFocus: string;
    productLabel: string | null;
  };
  quality: {
    /** 0–100 — volume + couverture contacts */
    score: number;
    label: "faible" | "correct" | "bon" | "excellent";
    participants: number;
    withPhone: number;
    withEmail: number;
    withContact: number;
    emailVerified: number;
    contactCoveragePct: number;
    phoneCoveragePct: number;
    summary: string;
  };
  participants: ChallengeParticipantRow[];
};

function qualityLabel(score: number): ChallengeQualityReport["quality"]["label"] {
  if (score >= 80) return "excellent";
  if (score >= 60) return "bon";
  if (score >= 35) return "correct";
  return "faible";
}

function computeQuality(rows: ChallengeParticipantRow[]) {
  const participants = rows.length;
  const withPhone = rows.filter((r) => Boolean(r.phone)).length;
  const withEmail = rows.filter((r) => Boolean(r.email)).length;
  const withContact = rows.filter((r) => r.contactOk).length;
  const emailVerified = rows.filter((r) => r.emailVerified).length;
  const contactCoveragePct =
    participants === 0 ? 0 : Math.round((withContact / participants) * 100);
  const phoneCoveragePct =
    participants === 0 ? 0 : Math.round((withPhone / participants) * 100);

  // Volume (max 55) + contacts (max 45)
  const volumeScore = Math.min(55, participants * 8);
  const contactScore =
    participants === 0
      ? 0
      : Math.round((withContact / participants) * 35) +
        Math.round((withPhone / participants) * 10);
  const score = Math.min(100, volumeScore + contactScore);
  const label = qualityLabel(score);

  const summary =
    participants === 0
      ? "Aucun participant pour l’instant — republiez ou prolongez le challenge."
      : `${participants} challengeur${participants > 1 ? "s" : ""} · ${contactCoveragePct}% avec contact · score ${score}/100 (${label}).`;

  return {
    score,
    label,
    participants,
    withPhone,
    withEmail,
    withContact,
    emailVerified,
    contactCoveragePct,
    phoneCoveragePct,
    summary,
  };
}

export async function buildChallengeReport(
  challengeId: string,
): Promise<ChallengeQualityReport | null> {
  const challenge = await withDbRetry(() =>
    prisma.dailyChallenge.findUnique({
      where: { id: challengeId },
      include: {
        product: {
          select: { id: true, title: true, shop: { select: { name: true } } },
        },
      },
    }),
  );
  if (!challenge) return null;

  const completions = await withDbRetry(() =>
    prisma.challengeCompletion.findMany({
      where: { challengeId },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
            emailVerified: true,
            image: true,
          },
        },
      },
    }),
  );

  const participants: ChallengeParticipantRow[] = completions.map((row) => {
    const phone = row.user.phone?.trim() || null;
    const email = row.user.email?.trim() || null;
    return {
      reference: row.reference,
      name: row.user.name,
      phone,
      email,
      emailVerified: row.user.emailVerified,
      image: row.user.image,
      joinedAt: row.createdAt.toISOString(),
      contactOk: Boolean(phone || email),
    };
  });

  const teaser = parseChallengeTeaser(challenge.productTeaser);
  const productLabel =
    challenge.product?.title ??
    teaser?.title ??
    null;

  return {
    challenge: {
      id: challenge.id,
      title: challenge.title,
      body: challenge.body,
      category: challenge.category,
      city: challenge.city,
      startsAt: challenge.startsAt.toISOString(),
      endsAt: challenge.endsAt.toISOString(),
      productFocus: challenge.productFocus,
      productLabel,
    },
    quality: computeQuality(participants),
    participants,
  };
}

export function challengeReportToCsv(report: ChallengeQualityReport) {
  const header = [
    "reference",
    "name",
    "phone",
    "email",
    "emailVerified",
    "joinedAt",
  ].join(",");
  const lines = report.participants.map((row) =>
    [
      row.reference,
      JSON.stringify(row.name),
      JSON.stringify(row.phone ?? ""),
      JSON.stringify(row.email ?? ""),
      row.emailVerified ? "1" : "0",
      row.joinedAt,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
