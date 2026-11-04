import { requirePlatformSession, ticketHttp } from "@/lib/tickets/auth";
import { promoteEvent } from "@/lib/tickets/promote";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  try {
    const result = await promoteEvent({
      eventId: id,
      ownerUserId: auth.session.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return ticketHttp(error);
  }
}
