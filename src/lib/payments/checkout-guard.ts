import type { Prisma } from "@/generated/prisma/client";
import { refundDuplicatePurchase } from "@/lib/checkout";
import { fingerprintPayload } from "@/lib/payments/idempotent-op";
import { lockWalletByUser } from "@/lib/payments/ledger";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

const RECENT_MS = 30 * 60 * 1000;

export function cartCheckoutFingerprint(
  userId: string,
  items: { productId: string; quantity: number }[],
) {
  const cart = [...items]
    .map((item) => ({
      productId: item.productId,
      quantity: Math.max(1, item.quantity),
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
  return fingerprintPayload({ userId, cart });
}

export function checkoutPaymentId(cartHash: string) {
  return `c_${cartHash.slice(0, 24)}`;
}

export async function lockBuyerCheckout(tx: Tx, userId: string) {
  try {
    await lockWalletByUser(tx, userId);
  } catch {
    throw new Error("Portefeuille introuvable");
  }
}

export async function findCompletedCheckout(
  tx: Tx,
  input: { userId: string; key?: string; cartHash?: string },
) {
  if (input.key) {
    const byKey = await tx.idempotentOperation.findUnique({
      where: {
        userId_scope_clientKey: {
          userId: input.userId,
          scope: "CHECKOUT",
          clientKey: input.key,
        },
      },
    });
    if (byKey?.status === "COMPLETED" && byKey.response) return byKey;
  }
  if (input.cartHash) {
    const byCart = await tx.idempotentOperation.findFirst({
      where: {
        userId: input.userId,
        scope: "CHECKOUT",
        status: "COMPLETED",
        requestHash: input.cartHash,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (byCart?.response) return byCart;
  }
  return null;
}

type TxnMeta = {
  checkoutId?: string;
  orderId?: string;
};

export async function refundDuplicateCheckouts(
  userId: string,
  keepCheckoutId: string,
) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return;
  const txns = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
      type: "PURCHASE",
      status: "SUCCESS",
      createdAt: { gte: new Date(Date.now() - RECENT_MS) },
    },
    select: { id: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const extraOrderIds: string[] = [];
  for (const row of txns) {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as TxnMeta)
        : {};
    if (!meta.checkoutId || !meta.orderId) continue;
    if (meta.checkoutId === keepCheckoutId) continue;
    extraOrderIds.push(meta.orderId);
  }
  const unique = [...new Set(extraOrderIds)];
  if (unique.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const orderId of unique) {
      try {
        await refundDuplicatePurchase(tx, userId, orderId);
      } catch (error) {
        console.error("[checkout-dedupe]", orderId, error);
      }
    }
  });
}
