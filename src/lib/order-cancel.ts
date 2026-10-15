/** Motifs d'annulation vendeur → message d'excuse au client. */

export const CANCEL_REASONS = {
  OUT_OF_STOCK: {
    label: "Stock épuisé",
    apology:
      "Nous sommes sincèrement désolés : le stock de cet article est épuisé. Votre commande a été annulée et le montant a été entièrement remboursé sur votre portefeuille Chip Shop.",
    restoreStock: false,
  },
  DEFECTIVE: {
    label: "Produit défectueux",
    apology:
      "Nous nous excusons sincèrement : un défaut a été constaté sur le produit avant l'envoi. Votre commande a été annulée et le remboursement a été crédité sur votre portefeuille.",
    restoreStock: false,
  },
  DAMAGED: {
    label: "Produit endommagé",
    apology:
      "Toutes nos excuses : le produit s'est avéré endommagé et ne pouvait pas vous être remis en bon état. Commande annulée — remboursement effectué sur votre portefeuille.",
    restoreStock: false,
  },
  UNAVAILABLE: {
    label: "Produit indisponible",
    apology:
      "Nous sommes désolés : ce produit n'est plus disponible. Votre commande a été annulée et le montant remboursé sur votre portefeuille Chip Shop.",
    restoreStock: false,
  },
  LOGISTICS: {
    label: "Problème de livraison",
    apology:
      "Nous nous excusons pour ce désagrément : un imprévu logistique nous empêche d'honorer la livraison. Commande annulée — remboursement crédité sur votre portefeuille.",
    restoreStock: true,
  },
  OTHER: {
    label: "Autre motif",
    apology:
      "Nous sommes sincèrement désolés de ne pas pouvoir honorer votre commande. Elle a été annulée et le montant a été remboursé sur votre portefeuille Chip Shop.",
    restoreStock: true,
  },
} as const;

export type CancelReasonCode = keyof typeof CANCEL_REASONS;

export const CANCEL_REASON_CODES = Object.keys(
  CANCEL_REASONS,
) as CancelReasonCode[];

export function buildVendorCancelMessage(input: {
  shopName: string;
  productTitle: string;
  reason: CancelReasonCode;
  extraNote?: string;
  refundCents: number;
}) {
  const meta = CANCEL_REASONS[input.reason];
  const amount = (input.refundCents / 100).toFixed(2);
  const lines = [
    "❌ Annulation de commande — Chip Shop",
    "",
    `Boutique : ${input.shopName}`,
    `Produit : ${input.productTitle}`,
    `Motif : ${meta.label}`,
    "",
    meta.apology,
    "",
    `💰 Remboursement : ${amount} $ crédité sur votre portefeuille.`,
  ];
  if (input.extraNote?.trim()) {
    lines.push("", `Note du vendeur : ${input.extraNote.trim()}`);
  }
  lines.push(
    "",
    "Encore toutes nos excuses pour la gêne occasionnée. N'hésitez pas à nous écrire si besoin.",
  );
  return lines.join("\n");
}

/** Statuts pour lesquels une annulation (client ou vendeur) est encore possible. */
export const CANCELLABLE_STATUSES = new Set([
  "PAID",
  "ASSIGNED",
  "FULFILLING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "FAILED",
]);

export function isOrderCancellable(
  status: string,
  redeemedAt?: Date | null,
  scannedAt?: Date | null,
) {
  if (redeemedAt || scannedAt) return false;
  if (
    status === "DELIVERED" ||
    status === "PICKED_UP" ||
    status === "AWAITING_CONFIRM"
  ) {
    return false;
  }
  if (status === "CANCELLED" || status === "REFUNDED") return false;
  return CANCELLABLE_STATUSES.has(status);
}
