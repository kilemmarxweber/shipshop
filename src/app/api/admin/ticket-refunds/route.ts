import { auditFromRequest } from "@/lib/payments/ledger";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession, ticketHttp } from "@/lib/tickets/auth";
import { refundTicket } from "@/lib/tickets/ledger";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const rows = await prisma.ticketRefundRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      ticket: {
        include: {
          event: { select: { id: true, title: true } },
          type: { select: { name: true } },
        },
      },
      buyer: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({
    refunds: rows.map((row) => ({
      id: row.id,
      status: row.status,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
      ticketId: row.ticketId,
      eventTitle: row.ticket.event.title,
      typeName: row.ticket.type.name,
      ticketStatus: row.ticket.status,
      purchaseCents: row.ticket.purchaseCents,
      currency: row.ticket.currency,
      buyer: row.buyer,
    })),
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
});

export async function PATCH(req: Request) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const row = await prisma.ticketRefundRequest.findUnique({
    where: { id: parsed.data.id },
  });
  if (!row) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (row.status !== "PENDING") {
    return NextResponse.json(
      { error: "Demande déjà traitée" },
      { status: 409 },
    );
  }
  const audit = auditFromRequest(req, auth.session.user.id, "OWNER");
  try {
    if (parsed.data.action === "APPROVE") {
      await refundTicket({
        ticketId: row.ticketId,
        actorUserId: auth.session.user.id,
        reason: `refund_request:${row.id}`,
        audit,
      });
      await prisma.ticketRefundRequest.update({
        where: { id: row.id },
        data: {
          status: "APPROVED",
          reviewedById: auth.session.user.id,
          reviewedAt: new Date(),
        },
      });
    } else {
      await prisma.ticketRefundRequest.update({
        where: { id: row.id },
        data: {
          status: "REJECTED",
          reviewedById: auth.session.user.id,
          reviewedAt: new Date(),
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return ticketHttp(error);
  }
}
