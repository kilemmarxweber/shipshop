import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  completeChallenge,
  ensureActiveChallenges,
} from "@/lib/growth/challenge";
import { recordUserActivity } from "@/lib/growth/activity";

const schema = z.object({
  challengeId: z.string().min(1),
});

export async function GET() {
  const challenges = await ensureActiveChallenges();
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
    return NextResponse.json({
      ok: true,
      reference: completion.reference,
    });
  } catch {
    return NextResponse.json({ error: "Challenge impossible" }, { status: 400 });
  }
}
