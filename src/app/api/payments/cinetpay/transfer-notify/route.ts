import { revertUnsentWithdrawal } from "@/lib/payments/revert-withdrawal";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Webhook CinetPay Transfert — jamais utilisé pour un achat. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const clientId =
      (typeof body.client_transaction_id === "string" &&
        body.client_transaction_id) ||
      (typeof body.clientTransactionId === "string" &&
        body.clientTransactionId) ||
      (typeof body.merchant_transaction_id === "string" &&
        body.merchant_transaction_id) ||
      (typeof body.merchantTransactionId === "string" &&
        body.merchantTransactionId) ||
      "";
    const status = String(
      body.treatment_status ?? body.status ?? "",
    ).toUpperCase();
    if (!clientId) {
      return NextResponse.json({ ok: true });
    }
    const withdrawal = await prisma.withdrawal.findFirst({
      where: {
        OR: [{ id: clientId }, { id: { startsWith: clientId } }],
      },
    });
    if (!withdrawal) {
      return NextResponse.json({ ok: true });
    }
    const paid =
      status === "CONFIRM" ||
      status === "CONFIRMED" ||
      status === "SUCCESS" ||
      status === "VAL" ||
      status === "PAID";
    const failed =
      status === "REJECTED" || status === "FAILED" || status === "REFUSED";
    if (paid && withdrawal.status !== "PAID") {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "PAID", paidAt: new Date() },
      });
    } else if (failed && withdrawal.status === "PENDING") {
      await revertUnsentWithdrawal(withdrawal.id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[cinetpay-transfer-notify]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
