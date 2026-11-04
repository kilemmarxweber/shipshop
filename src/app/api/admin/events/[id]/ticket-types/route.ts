import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/tickets/auth";
import { adminEvent } from "@/lib/tickets/serialize";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).optional().default(""),
  priceCents: z.number().int().min(1).max(100_000_000),
  quota: z.number().int().min(1).max(1_000_000),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (event.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Types figés après publication" },
      { status: 409 },
    );
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const count = await prisma.ticketType.count({ where: { eventId: id } });
  await prisma.ticketType.create({
    data: {
      eventId: id,
      ...parsed.data,
      sortOrder: count,
    },
  });
  const updated = await prisma.event.findUnique({
    where: { id },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      organizer: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ event: updated ? adminEvent(updated) : null });
}
