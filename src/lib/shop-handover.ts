import type { Prisma } from "@/generated/prisma/client";
import { buildHandoverQrPayload, parseHandoverQrPayload } from "@/lib/handover";
import { prisma } from "@/lib/prisma";

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
  const stillToHandOver = await tx.order.count({
    where: {
      handoverId,
      status: { notIn: [...CLOSED] },
      pickupReceipt: { is: { scannedAt: null } },
    },
  });
  if (stillToHandOver > 0) return null;
  return tx.shopHandover.update({
    where: { id: handoverId },
    data: { completedAt: new Date() },
  });
}

/** Anciens tickets partageaient le QR boutique : chaque article a le sien. */
export async function ensureOrderItemQr(input: {
  orderId: string;
  shopId: string;
  pickupReceipt: { id: string; code: string; qrPayload: string; scannedAt: Date | null } | null;
}) {
  const rec = input.pickupReceipt;
  if (!rec || rec.scannedAt) return rec;
  const parsed = parseHandoverQrPayload(rec.qrPayload);
  if (parsed?.v === 1 && parsed.o === input.orderId) return rec;
  return prisma.pickupReceipt.update({
    where: { id: rec.id },
    data: {
      qrPayload: buildHandoverQrPayload({
        orderId: input.orderId,
        code: rec.code,
        shopId: input.shopId,
      }),
    },
  });
}
