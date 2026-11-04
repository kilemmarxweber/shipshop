import { prisma } from "@/lib/prisma";
import { publicEvent } from "@/lib/tickets/serialize";
import { NextResponse } from "next/server";

export async function GET() {
  const events = await prisma.event.findMany({
    where: { status: "ON_SALE" },
    orderBy: { startsAt: "asc" },
    take: 40,
    include: { ticketTypes: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ events: events.map(publicEvent) });
}
