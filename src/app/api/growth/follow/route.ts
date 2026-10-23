import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  countCreatorSubscribers,
  followCreator,
  unfollowCreator,
} from "@/lib/growth/subscribers";
import { recordUserActivity } from "@/lib/growth/activity";
import { refreshAccountBadges } from "@/lib/growth/badges";

const schema = z.object({
  creatorId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    await followCreator(session.user.id, body.creatorId);
    await recordUserActivity(session.user.id, "follow");
    await refreshAccountBadges(body.creatorId);
    const subscribers = await countCreatorSubscribers(body.creatorId);
    return NextResponse.json({ followedByMe: true, subscribers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suivi impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    await unfollowCreator(session.user.id, body.creatorId);
    await refreshAccountBadges(body.creatorId);
    const subscribers = await countCreatorSubscribers(body.creatorId);
    return NextResponse.json({ followedByMe: false, subscribers });
  } catch {
    return NextResponse.json({ error: "Retrait impossible" }, { status: 400 });
  }
}
