import { prisma } from "@/lib/prisma";
import { enforceApiSecurity } from "@/lib/security";
import { getSession } from "@/lib/session";
import { publicEvent } from "@/lib/tickets/serialize";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getSession();
  const blocked = await enforceApiSecurity({
    request: req,
    bucket: "events",
    session,
  });
  if (blocked) return blocked;
  const events = await prisma.event.findMany({
    where: { status: "ON_SALE" },
    orderBy: { startsAt: "asc" },
    take: 40,
    include: { ticketTypes: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ events: events.map(publicEvent) });
}
