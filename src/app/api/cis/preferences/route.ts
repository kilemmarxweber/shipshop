import { NextResponse } from "next/server";
import { eraseCisUserData, hasActiveCisConsent } from "@/lib/cis/consent";
import { recomputeCisPreferences } from "@/lib/cis/profile";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!(await hasActiveCisConsent(session.user.id))) {
    return NextResponse.json({
      consent: false,
      preferences: [],
    });
  }

  const rows = await withDbRetry(() =>
    prisma.cisPreference.findMany({
      where: { userId: session.user.id },
      orderBy: { score: "desc" },
      take: 40,
    }),
  );

  return NextResponse.json({
    consent: true,
    preferences: rows.map((row) => ({
      kind: row.kind,
      key: row.key,
      score: row.score,
      factors: row.factors,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!(await hasActiveCisConsent(session.user.id))) {
    return NextResponse.json(
      { error: "Consentement CIS requis" },
      { status: 403 },
    );
  }
  const buckets = await recomputeCisPreferences(session.user.id);
  return NextResponse.json({ ok: true, count: buckets.length });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  await eraseCisUserData(session.user.id);
  return NextResponse.json({ ok: true });
}
