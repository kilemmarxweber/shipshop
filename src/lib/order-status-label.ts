import type { MessagePath } from "@/components/i18n-provider";

const KNOWN_STATUSES = new Set([
  "PAID",
  "ASSIGNED",
  "FULFILLING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "AWAITING_CONFIRM",
  "PICKED_UP",
  "DELIVERED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
]);

export function orderStatusLabel(
  t: (path: MessagePath) => string,
  status: string,
) {
  if (!KNOWN_STATUSES.has(status)) return status;
  return t(`orderStatus.${status}` as MessagePath);
}

/** 2e pastille du suivi : retrait = prêt en boutique ; livraison = course. */
export function isTransitStepActive(order: {
  status: string;
  fulfillmentType?: string;
  escrowReleasedAt?: string | null;
}) {
  if (
    order.escrowReleasedAt ||
    order.status === "DELIVERED" ||
    order.status === "PICKED_UP"
  ) {
    return true;
  }
  if (order.fulfillmentType === "PICKUP") {
    return (
      order.status === "READY_FOR_PICKUP" ||
      order.status === "AWAITING_CONFIRM"
    );
  }
  return ["ASSIGNED", "FULFILLING", "OUT_FOR_DELIVERY", "AWAITING_CONFIRM"].includes(
    order.status,
  );
}
