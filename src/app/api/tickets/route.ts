import { prisma } from "@/lib/prisma";
import { requireBuyerSession } from "@/lib/tickets/auth";
import { publicTicket } from "@/lib/tickets/serialize";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireBuyerSession();
  if (auth.error) return auth.error;
  const tickets = await prisma.ticket.findMany({
    where: { buyerUserId: auth.session.user.id },
    orderBy: { createdAt: "desc" },
    take: 80,
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
  return NextResponse.json({ tickets: tickets.map(publicTicket) });
}
