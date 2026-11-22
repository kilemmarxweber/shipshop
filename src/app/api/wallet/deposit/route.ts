import { APP_CURRENCIES } from "@/lib/money";
import { auditFromRequest, idempotencyFrom } from "@/lib/payments/ledger";
import { confirmDeposit, initiateDeposit } from "@/lib/payments/mobile-money";
import { MIN_CASH_MOVE_CENTS } from "@/lib/platform-fees";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

const initiateSchema = z.object({
  amountCents: z.number().int().min(MIN_CASH_MOVE_CENTS, "Minimum 5"),
  provider: z.enum(["MPESA", "ORANGE", "AIRTEL"]),
  phone: z.string().min(10).max(24),
  currency: z.enum(APP_CURRENCIES).default("USD"),
  beneficiaryUserId: z.string().min(1).optional().nullable(),
  idempotencyKey: z.string().optional(),
});

const confirmSchema = z.object({
  transactionId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action as "initiate" | "confirm";
  const audit = auditFromRequest(req, session.user.id, "USER");

  try {
    if (action === "confirm") {
      const parsed = confirmSchema.parse(body);
      const result = await confirmDeposit(
        parsed.transactionId,
        session.user.id,
        audit,
      );
      return NextResponse.json(result);
    }

    const parsed = initiateSchema.parse(body);
    const idempotencyKey = idempotencyFrom(req, parsed.idempotencyKey);
    const result = await initiateDeposit({
      userId: session.user.id,
      amountCents: parsed.amountCents,
      provider: parsed.provider,
      phone: parsed.phone,
      currency: parsed.currency,
      beneficiaryUserId: parsed.beneficiaryUserId,
      idempotencyKey,
      audit,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Minimum 5" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Erreur wallet";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
