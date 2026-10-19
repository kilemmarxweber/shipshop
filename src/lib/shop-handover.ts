import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

const CLOSED = [
  "DELIVERED",
  "PICKED_UP",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
] as const;

function pickupCode() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CS-${part}`;
}

export async function createShopHandover(
  tx: Tx,
  buyerId: string,
  shopId: string,
) {
  const code = pickupCode();
  const created = await tx.shopHandover.create({
    data: {
      buyerId,
      shopId,
      code,
      qrPayload: "{}",
    },
  });
  const qrPayload = JSON.stringify({
    v: 2,
    g: created.id,
    c: code,
    s: shopId,
  });
  return tx.shopHandover.update({
    where: { id: created.id },
    data: { qrPayload },
  });
}

export async function maybeCompleteShopHandover(
  tx: Tx,
  handoverId?: string | null,
) {
  if (!handoverId) return null;
  const open = await tx.order.count({
    where: {
      handoverId,
      status: { notIn: [...CLOSED] },
    },
  });
  if (open > 0) return null;
  return tx.shopHandover.update({
    where: { id: handoverId },
    data: { completedAt: new Date() },
  });
}
