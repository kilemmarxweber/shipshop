import { NextResponse } from "next/server";
import { parseCinetPayNotification } from "@/lib/payments/cinetpay";
import { settleCinetPayDeposit } from "@/lib/payments/mobile-money";
import { auditFromRequest } from "@/lib/payments/ledger";

export async function GET() {
  return new Response("OK", { status: 200 });
}

export async function POST(req: Request) {
  let note: ReturnType<typeof parseCinetPayNotification>;
  try {
    note = parseCinetPayNotification(await req.json());
  } catch {
    return NextResponse.json({ error: "Notification invalide" }, { status: 400 });
  }
  try {
    await settleCinetPayDeposit({
      transactionId: note.merchantTransactionId || note.transactionId,
      notifyToken: note.notifyToken,
      audit: auditFromRequest(req, null, "SYSTEM"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    if (message === "Notification CinetPay refusée") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === "CinetPay n'est pas configuré") {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return new Response("OK", { status: 200 });
}
