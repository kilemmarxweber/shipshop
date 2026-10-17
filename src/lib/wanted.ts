import type { WantedCondition } from "@/generated/prisma/client";

export const WANTED_OPEN_LIMIT = 3;
export const WANTED_TTL_DAYS = 14;

export function wantedExpiresAt(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + WANTED_TTL_DAYS);
  return d;
}

export function conditionLabel(condition: WantedCondition | string) {
  return condition === "USED" ? "Occasion" : "Neuf / magasin";
}
