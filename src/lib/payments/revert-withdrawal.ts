import { parseCurrency, walletCents } from "@/lib/money";
import { debitTreasury } from "@/lib/platform-ledger";
import { prisma } from "@/lib/prisma";
import { applyBucketDelta } from "@/lib/wallet-buckets";

/** CinetPay n’a pas accepté le transfert : le pot est recrédité. */
export async function revertUnsentWithdrawal(withdrawalId: string) {
  await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal || withdrawal.status !== "PENDING") return;
    const wallet = await tx.wallet.findUnique({
      where: { userId: withdrawal.userId },
    });
    if (!wallet) return;
    const currency = parseCurrency(withdrawal.currency);
    const bucket = withdrawal.bucket as "BUYER" | "VENDOR" | "COURIER";
    const patch = applyBucketDelta(
      wallet,
      currency,
      withdrawal.grossCents,
      bucket,
    );
    await tx.wallet.update({
      where: { id: wallet.id },
      data: patch,
    });
    if (withdrawal.feeCents > 0) {
      await debitTreasury(tx, {
        amountCents: withdrawal.feeCents,
        currency,
        actorUserId: withdrawal.userId,
        action: "WITHDRAWAL_REVERSAL",
        detail: { withdrawalId: withdrawal.id },
      });
    }
    await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "FAILED" },
    });
    const total = walletCents({ ...wallet, ...patch }, currency);
    await tx.walletTransaction.updateMany({
      where: {
        walletId: wallet.id,
        type: "WITHDRAWAL",
        reference: `WD-${withdrawal.id.slice(0, 8)}`,
      },
      data: {
        status: "FAILED",
        balanceAfterCents: total,
      },
    });
  });
}
