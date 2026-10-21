import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  title: z.string().min(2).max(120),
  kind: z.enum(["FEED", "SEARCH", "CATEGORY", "CREATOR"]).default("FEED"),
  category: z.string().max(80).optional().nullable(),
  budgetCents: z.number().int().min(0).max(100_000_000).default(0),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).default("DRAFT"),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const campaigns = await withDbRetry(() =>
    prisma.brandCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  );
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const body = schema.parse(await req.json());
  const campaign = await withDbRetry(() =>
    prisma.brandCampaign.create({
      data: {
        ...body,
        ownerUserId: session.user.id,
        startsAt: body.status === "ACTIVE" ? new Date() : null,
      },
    }),
  );
  return NextResponse.json({ campaign });
}
