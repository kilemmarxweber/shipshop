import type { OrderStatus } from "@/generated/prisma/client";

/** Commandes qui ont réellement pris du stock. */
const EXCLUDED_SOLD_STATUSES: OrderStatus[] = [
  "CANCELLED",
  "REFUNDED",
  "FAILED",
];

export const SOLD_ORDER_STATUS_FILTER = {
  notIn: EXCLUDED_SOLD_STATUSES,
};

export const soldOrdersCount = {
  where: { status: SOLD_ORDER_STATUS_FILTER },
};
