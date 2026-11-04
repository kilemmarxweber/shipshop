import { prisma } from "@/lib/prisma";
import { requireBuyerSession } from "@/lib/tickets/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  reason: z.string().trim().min(8).max(500),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireBuyerSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Explique la demande (8 caractères min.)" },
      { status: 400 },
    );
  }
  const ticket = await prisma.ticket.findFirst({
    where: { id, buyerUserId: auth.session.user.id },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (ticket.status !== "PAID") {
    return NextResponse.json(
      { error: "Ce billet ne peut plus être remboursé sur demande" },
      { status: 409 },
    );
  }
  const pending = await prisma.ticketRefundRequest.findFirst({
    where: { ticketId: ticket.id, status: "PENDING" },
  });
  if (pending) {
    return NextResponse.json({ refund: pending, already: true });
  }
  const refund = await prisma.ticketRefundRequest.create({
    data: {
      ticketId: ticket.id,
      buyerUserId: auth.session.user.id,
      reason: parsed.data.reason,
    },
  });
  return NextResponse.json({ refund }, { status: 201 });
}
