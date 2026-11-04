import { prisma } from "@/lib/prisma";
import { publicEvent } from "@/lib/tickets/serialize";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { ticketTypes: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event || event.status === "DRAFT") {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  return NextResponse.json({ event: publicEvent(event) });
}
