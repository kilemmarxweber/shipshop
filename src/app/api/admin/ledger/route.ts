import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  auditFromRequest,
  expireStaleMovements,
  flushNotifyOutbox,
} from "@/lib/payments/ledger";
import {
  postAwaitingMovement,
  rejectOrExpireMovement,
} from "@/lib/payments/mobile-money";

const actionSchema = z.object({
  movementId: z.string().min(1),
  action: z.enum(["expire", "reject", "post"]),
  evidenceNote: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé à la plateforme" }, { status: 403 });
  }

  await expireStaleMovements();
  void flushNotifyOutbox();

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q")?.trim() ?? "";

  const movements = await prisma.moneyMovement.findMany({
    where: {
      ...(status
        ? {
            status: status as
              | "AWAITING_FUNDS"
              | "POSTED"
              | "EXPIRED"
              | "FAILED"
              | "REJECTED"
              | "CREATED",
          }
        : {}),
      ...(q
        ? {
            OR: [
              { providerReference: { contains: q, mode: "insensitive" } },
              { clientIdempotencyKey: { contains: q, mode: "insensitive" } },
              { payer: { name: { contains: q, mode: "insensitive" } } },
              {
                beneficiary: { name: { contains: q, mode: "insensitive" } },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      payer: { select: { id: true, name: true, email: true } },
      beneficiary: { select: { id: true, name: true } },
      audits: { orderBy: { createdAt: "desc" }, take: 8 },
      outbox: { select: { eventKey: true, status: true, attempts: true } },
    },
  });

  const waiting = await prisma.moneyMovement.count({
    where: { status: "AWAITING_FUNDS" },
  });
  const postedToday = await prisma.moneyMovement.count({
    where: {
      status: "POSTED",
      postedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });
  const expired = await prisma.moneyMovement.count({
    where: { status: "EXPIRED" },
  });
  const deadOutbox = await prisma.notifyOutbox.count({
    where: { status: "DEAD" },
  });

  return NextResponse.json({
    movements,
    stats: { waiting, postedToday, expired, deadOutbox },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé à la plateforme" }, { status: 403 });
  }

  try {
    const body = actionSchema.parse(await req.json());
    const audit = auditFromRequest(req, session.user.id, "OWNER");
    if (body.action === "post") {
      const result = await postAwaitingMovement(body.movementId, audit, {
        evidenceNote: body.evidenceNote || "Owner: preuve caisse",
      });
      return NextResponse.json({ ok: true, result });
    }
    await rejectOrExpireMovement(
      body.movementId,
      audit,
      body.action === "expire" ? "EXPIRED" : "REJECTED",
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
