import { recordUserActivity } from "@/lib/growth/activity";
import {
    completeChallenge,
    listActiveChallenges,
} from "@/lib/growth/challenge";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  challengeId: z.string().min(1),
});

export async function GET() {
  const challenges = await listActiveChallenges();
  return NextResponse.json({ challenges, challenge: challenges[0] ?? null });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const completion = await completeChallenge(
      session.user.id,
      body.challengeId,
    );
    await recordUserActivity(session.user.id, "challenge");
    const linked = await withDbRetry(() =>
      prisma.dailyChallenge.findUnique({
        where: { id: body.challengeId },
        select: {
          eventId: true,
          event: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
    );
    return NextResponse.json({
      ok: true,
      reference: completion.reference,
      eventId: linked?.eventId ?? null,
      event: linked?.event ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Challenge impossible" },
      { status: 400 },
    );
  }
}
