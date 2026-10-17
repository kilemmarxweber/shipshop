import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  confirmSimulatedDeposit,
  initiateDeposit,
} from "@/lib/payments/mobile-money";

const initiateSchema = z.object({
  amountCents: z.number().int().min(100),
  provider: z.enum(["MPESA", "ORANGE", "AIRTEL"]),
  phone: z.string().min(10).max(24),
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

  try {
    if (action === "confirm") {
      const parsed = confirmSchema.parse(body);
      const result = await confirmSimulatedDeposit(
        parsed.transactionId,
        session.user.id,
      );
      return NextResponse.json(result);
    }

    const parsed = initiateSchema.parse(body);
    const result = await initiateDeposit({
      userId: session.user.id,
      amountCents: parsed.amountCents,
      provider: parsed.provider,
      phone: parsed.phone,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur wallet";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
