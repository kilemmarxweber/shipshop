import { APP_CURRENCIES } from "@/lib/money";
import { auditFromRequest, idempotencyFrom } from "@/lib/payments/ledger";
import {
    IdempotencyConflictError,
    transferFromBalance,
} from "@/lib/payments/mobile-money";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  amountCents: z.number().int().min(100),
  currency: z.enum(APP_CURRENCIES).default("USD"),
  beneficiaryUserId: z.string().min(1),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const parsed = schema.parse(await req.json());
    const result = await transferFromBalance({
      payerUserId: session.user.id,
      beneficiaryUserId: parsed.beneficiaryUserId,
      amountCents: parsed.amountCents,
      currency: parsed.currency,
      idempotencyKey: idempotencyFrom(req, parsed.idempotencyKey),
      audit: auditFromRequest(req, session.user.id, "USER"),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Erreur wallet";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
