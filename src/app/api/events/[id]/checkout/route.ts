import {
    beginIdempotentInTx,
    completeIdempotentInTx,
    findIdempotentOp,
    fingerprintPayload,
    replayIfComplete,
} from "@/lib/payments/idempotent-op";
import { auditFromRequest, idempotencyFrom } from "@/lib/payments/ledger";
import { prisma } from "@/lib/prisma";
import { requireBuyerSession, ticketHttp } from "@/lib/tickets/auth";
import { purchaseTickets } from "@/lib/tickets/ledger";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  ticketTypeId: z.string().min(1),
  qty: z.number().int().min(1).max(10).default(1),
  acceptedNonRefundable: z.literal(true),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireBuyerSession();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  let key: string;
  try {
    key = idempotencyFrom(req);
  } catch {
    return NextResponse.json(
      { error: "Clé d’idempotence manquante" },
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Accepte la politique non remboursable et choisis un billet" },
      { status: 400 },
    );
  }
  const body = { eventId: id, ...parsed.data };
  const requestHash = fingerprintPayload(body);
  const existing = await findIdempotentOp({
    userId: auth.session.user.id,
    scope: "TICKET",
    key,
  });
  try {
    const replay = replayIfComplete(existing, requestHash);
    if (replay?.response) {
      return NextResponse.json(replay.response, {
        status: replay.httpStatus || 200,
        headers: { "x-idempotent-replay": "1" },
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Idempotence" },
      { status: 409 },
    );
  }

  const audit = auditFromRequest(req, auth.session.user.id);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const gate = await beginIdempotentInTx(tx, {
        userId: auth.session.user.id,
        scope: "TICKET",
        key,
        requestHash,
      });
      if (gate.replayed && gate.replay.response) {
        return {
          replayed: true as const,
          payload: gate.replay.response,
          status: gate.replay.httpStatus || 200,
        };
      }
      return { replayed: false as const };
    });
    if (result.replayed) {
      return NextResponse.json(result.payload, { status: result.status });
    }
    const payload = await purchaseTickets({
      buyerUserId: auth.session.user.id,
      eventId: id,
      ticketTypeId: parsed.data.ticketTypeId,
      qty: parsed.data.qty,
      acceptedNonRefundable: parsed.data.acceptedNonRefundable,
      audit,
    });
    await prisma.$transaction((tx) =>
      completeIdempotentInTx(tx, {
        userId: auth.session.user.id,
        scope: "TICKET",
        key,
        httpStatus: 200,
        response: payload,
      }),
    );
    return NextResponse.json(payload);
  } catch (error) {
    return ticketHttp(error);
  }
}
