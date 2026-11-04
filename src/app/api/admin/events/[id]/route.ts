import { auditFromRequest } from "@/lib/payments/ledger";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, ticketHttp } from "@/lib/tickets/auth";
import { cancelEventAndRefund, settleEvent } from "@/lib/tickets/ledger";
import { adminEvent } from "@/lib/tickets/serialize";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["publish", "close", "cancel", "settle", "end"]).optional(),
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  venue: z.string().trim().min(2).max(160).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  capacity: z.number().int().min(1).max(1_000_000).optional().nullable(),
  accessNote: z.string().trim().max(500).optional().nullable(),
  organizerKind: z.enum(["ARTIST", "ORGANIZATION"]).optional(),
  organizerName: z.string().trim().min(2).max(120).optional(),
  organizerUserId: z.string().min(1).optional(),
  platformFeeMode: z.enum(["PERCENT", "FLAT"]).optional(),
  platformFeeBps: z.number().int().min(0).max(10_000).optional(),
  platformFeeCents: z.number().int().min(0).max(100_000_000).optional(),
});

const eventInclude = {
  ticketTypes: { orderBy: { sortOrder: "asc" as const } },
  organizer: { select: { id: true, name: true, email: true } },
} as const;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: eventInclude,
  });
  if (!event) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  return NextResponse.json({ event: adminEvent(event) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const audit = auditFromRequest(req, auth.session.user.id, "OWNER");
  try {
    if (parsed.data.action === "publish") {
      const types = await prisma.ticketType.count({ where: { eventId: id } });
      if (types < 1) {
        return NextResponse.json(
          { error: "Ajoute au moins un type de billet" },
          { status: 400 },
        );
      }
      const updated = await prisma.event.update({
        where: { id },
        data: { status: "ON_SALE" },
        include: eventInclude,
      });
      return NextResponse.json({ event: adminEvent(updated) });
    }
    if (parsed.data.action === "close") {
      const updated = await prisma.event.update({
        where: { id },
        data: { status: "CLOSED" },
        include: eventInclude,
      });
      return NextResponse.json({ event: adminEvent(updated) });
    }
    if (parsed.data.action === "end") {
      const updated = await prisma.event.update({
        where: { id },
        data: { status: "ENDED" },
        include: eventInclude,
      });
      return NextResponse.json({ event: adminEvent(updated) });
    }
    if (parsed.data.action === "cancel") {
      await cancelEventAndRefund({
        eventId: id,
        actorUserId: auth.session.user.id,
        audit,
      });
      const updated = await prisma.event.findUnique({
        where: { id },
        include: eventInclude,
      });
      return NextResponse.json({ event: updated ? adminEvent(updated) : null });
    }
    if (parsed.data.action === "settle") {
      const result = await settleEvent({
        eventId: id,
        actorUserId: auth.session.user.id,
        audit,
      });
      const updated = await prisma.event.findUnique({
        where: { id },
        include: eventInclude,
      });
      return NextResponse.json({
        event: updated ? adminEvent(updated) : null,
        ...result,
      });
    }
  } catch (error) {
    return ticketHttp(error);
  }

  if (event.status !== "DRAFT") {
    const locked = [
      "organizerUserId",
      "platformFeeMode",
      "platformFeeBps",
      "platformFeeCents",
    ] as const;
    for (const key of locked) {
      if (parsed.data[key] !== undefined) {
        return NextResponse.json(
          { error: "Commission et bénéficiaire figés après publication" },
          { status: 409 },
        );
      }
    }
  }

  const data: Record<string, unknown> = {};
  const body = parsed.data;
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.imageUrl !== undefined)
    data.imageUrl = body.imageUrl?.trim() || null;
  if (body.venue !== undefined) data.venue = body.venue;
  if (body.city !== undefined) data.city = body.city;
  if (body.capacity !== undefined) data.capacity = body.capacity;
  if (body.accessNote !== undefined)
    data.accessNote = body.accessNote?.trim() || null;
  if (body.organizerKind !== undefined) data.organizerKind = body.organizerKind;
  if (body.organizerName !== undefined) data.organizerName = body.organizerName;
  if (body.organizerUserId !== undefined)
    data.organizerUserId = body.organizerUserId;
  if (body.platformFeeMode !== undefined)
    data.platformFeeMode = body.platformFeeMode;
  if (body.platformFeeBps !== undefined)
    data.platformFeeBps = body.platformFeeBps;
  if (body.platformFeeCents !== undefined)
    data.platformFeeCents = body.platformFeeCents;

  const updated = await prisma.event.update({
    where: { id },
    data,
    include: eventInclude,
  });
  return NextResponse.json({ event: adminEvent(updated) });
}
