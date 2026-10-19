/** Payload QR Chip Shop pour remise commande (retrait / livraison). */

export type HandoverQrPayload = {
  v: 1 | 2;
  /** orderId (v1) */
  o?: string;
  /** shopHandoverId (v2 — un QR par boutique) */
  g?: string;
  c: string;
  s: string;
};

export function buildHandoverQrPayload(input: {
  orderId: string;
  code: string;
  shopId: string;
}): string {
  const payload: HandoverQrPayload = {
    v: 1,
    o: input.orderId,
    c: input.code,
    s: input.shopId,
  };
  return JSON.stringify(payload);
}

export function buildShopHandoverQrPayload(input: {
  handoverId: string;
  code: string;
  shopId: string;
}): string {
  const payload: HandoverQrPayload = {
    v: 2,
    g: input.handoverId,
    c: input.code,
    s: input.shopId,
  };
  return JSON.stringify(payload);
}

export function parseHandoverQrPayload(
  raw: string,
): HandoverQrPayload | null {
  const trimmed = raw.trim();
  try {
    const data = JSON.parse(trimmed) as Partial<HandoverQrPayload>;
    if (
      data.v === 2 &&
      typeof data.g === "string" &&
      typeof data.c === "string" &&
      typeof data.s === "string"
    ) {
      return { v: 2, g: data.g, c: data.c.toUpperCase(), s: data.s };
    }
    if (
      data.v === 1 &&
      typeof data.o === "string" &&
      typeof data.c === "string" &&
      typeof data.s === "string"
    ) {
      return { v: 1, o: data.o, c: data.c.toUpperCase(), s: data.s };
    }
  } catch {
    // CHIPSHOP2|handoverId|CODE|shopId or CHIPSHOP|orderId|CODE|shopId
  }
  const parts = trimmed.split("|");
  if (parts[0] === "CHIPSHOP2" && parts.length >= 4) {
    return {
      v: 2,
      g: parts[1],
      c: parts[2].toUpperCase(),
      s: parts[3],
    };
  }
  if (parts[0] === "CHIPSHOP" && parts.length >= 4) {
    return {
      v: 1,
      o: parts[1],
      c: parts[2].toUpperCase(),
      s: parts[3],
    };
  }
  return null;
}

export function qrImageUrl(data: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}

/** Fenêtre pour signaler un souci après remise (48 h). */
export const ISSUE_WINDOW_MS = 48 * 60 * 60 * 1000;

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  WRONG_SIZE: "Mauvaise taille",
  WRONG_COLOR: "Mauvaise couleur",
  DEFECT: "Produit défectueux",
  WRONG_PRODUCT: "Mauvais produit",
  OTHER: "Autre problème",
};

export const HANDOVER_CLOSED_STATUSES = [
  "DELIVERED",
  "PICKED_UP",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
] as const;
