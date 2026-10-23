import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { recordUserActivity, type ActivityKind } from "@/lib/growth/activity";

const schema = z.object({
  kind: z.enum([
    "like",
    "comment",
    "share",
    "follow",
    "shop_visit",
    "category",
    "dwell",
    "challenge",
  ]),
  city: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    await recordUserActivity(session.user.id, body.kind as ActivityKind, {
      city: body.city,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Activité invalide" }, { status: 400 });
  }
}
