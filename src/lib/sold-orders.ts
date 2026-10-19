/** Commandes qui ont réellement pris du stock. */
export const SOLD_ORDER_STATUS_FILTER = {
  notIn: ["CANCELLED", "REFUNDED", "FAILED"] as const,
};

export const soldOrdersCount = {
  where: { status: SOLD_ORDER_STATUS_FILTER },
};
