import { prisma } from "@/lib/prisma";
import { requireBuyerSession } from "@/lib/tickets/auth";
import { publicTicket } from "@/lib/tickets/serialize";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireBuyerSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const ticket = await prisma.ticket.findFirst({
    where: { id, buyerUserId: auth.session.user.id },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          venue: true,
          city: true,
          startsAt: true,
          endsAt: true,
          organizerName: true,
          imageUrl: true,
          accessNote: true,
        },
      },
      type: { select: { id: true, name: true } },
      refundRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, reason: true },
      },
    },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ticket: publicTicket(ticket) });
}
