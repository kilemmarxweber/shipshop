import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/tickets/auth";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { ticketTypes: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const tickets = await prisma.ticket.findMany({
    where: { eventId: id },
    select: {
      status: true,
      purchaseCents: true,
      platformFeeCents: true,
      organizerCents: true,
      settledAt: true,
    },
  });
  const refunds = await prisma.ticketRefundRequest.count({
    where: { ticket: { eventId: id }, status: "PENDING" },
  });
  const gmv = tickets
    .filter((row) => row.status !== "VOID")
    .reduce((sum, row) => sum + row.purchaseCents, 0);
  const platformRevenue = tickets
    .filter((row) => row.status === "PAID" || row.status === "CHECKED_IN")
    .reduce((sum, row) => sum + row.platformFeeCents, 0);
  const organizerDue = tickets
    .filter(
      (row) =>
        (row.status === "PAID" || row.status === "CHECKED_IN") &&
        !row.settledAt,
    )
    .reduce((sum, row) => sum + row.organizerCents, 0);
  const organizerPaid = tickets
    .filter((row) => row.settledAt)
    .reduce((sum, row) => sum + row.organizerCents, 0);
  const checkedIn = tickets.filter((row) => row.status === "CHECKED_IN").length;
  const sold = tickets.filter(
    (row) => row.status === "PAID" || row.status === "CHECKED_IN",
  ).length;
  return NextResponse.json({
    sales: {
      gmv,
      platformRevenue,
      organizerDue,
      organizerPaid,
      sold,
      checkedIn,
      pendingRefunds: refunds,
      types: event.ticketTypes.map((type) => ({
        id: type.id,
        name: type.name,
        quota: type.quota,
        soldCount: type.soldCount,
      })),
    },
  });
}
