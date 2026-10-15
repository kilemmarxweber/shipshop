import { prisma } from "@/lib/prisma";
import type { MobileMoneyProvider } from "@/generated/prisma/client";

export type DepositInput = {
  userId: string;
  amountCents: number;
  provider: Exclude<MobileMoneyProvider, "INTERNAL">;
  phone: string;
};

/**
 * Simulated Mobile Money gateway (M-Pesa / Orange / Airtel).
 * Swap implementations here when real operator APIs are available.
 */
export async function initiateDeposit(input: DepositInput) {
  if (input.amountCents < 100) {
    throw new Error("Montant minimum: 1 USD");
  }
  if (!/^\+?\d{9,15}$/.test(input.phone.replace(/\s/g, ""))) {
    throw new Error("Numéro Mobile Money invalide");
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: input.userId },
  });
  if (!wallet) throw new Error("Portefeuille introuvable");

  const reference = `MM-${input.provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const txn = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "DEPOSIT",
      amountCents: input.amountCents,
      provider: input.provider,
      phone: input.phone.replace(/\s/g, ""),
      reference,
      status: "PENDING",
      metadata: {
        simulated: true,
        ussdHint: `*${providerUssd(input.provider)}# puis confirmer`,
      },
    },
  });

  return { transactionId: txn.id, reference, status: txn.status };
}

export async function confirmSimulatedDeposit(transactionId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Portefeuille introuvable");

    const pending = await tx.walletTransaction.findFirst({
      where: {
        id: transactionId,
        walletId: wallet.id,
        type: "DEPOSIT",
        status: "PENDING",
      },
    });
    if (!pending) throw new Error("Transaction introuvable ou déjà traitée");

    const newBalance = wallet.balanceCents + pending.amountCents;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: newBalance },
    });

    const updated = await tx.walletTransaction.update({
      where: { id: pending.id },
      data: {
        status: "SUCCESS",
        balanceAfterCents: newBalance,
        metadata: {
          ...(typeof pending.metadata === "object" && pending.metadata
            ? (pending.metadata as object)
            : {}),
          confirmedAt: new Date().toISOString(),
          simulated: true,
        },
      },
    });

    return {
      balanceCents: newBalance,
      transaction: updated,
    };
  });
}

function providerUssd(provider: Exclude<MobileMoneyProvider, "INTERNAL">) {
  switch (provider) {
    case "MPESA":
      return "150";
    case "ORANGE":
      return "144";
    case "AIRTEL":
      return "500";
  }
}
