import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { settleCinetPayDeposit } from "@/lib/payments/mobile-money";
import { auditFromRequest } from "@/lib/payments/ledger";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const tx = new URL(req.url).searchParams.get("tx")?.trim();
  if (!tx) {
    return NextResponse.json({ error: "Transaction manquante" }, { status: 400 });
  }
  try {
    const result = await settleCinetPayDeposit({
      transactionId: tx,
      payerUserId: session.user.id,
      audit: auditFromRequest(req, session.user.id, "USER"),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
