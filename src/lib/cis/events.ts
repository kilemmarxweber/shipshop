import { prisma, withDbRetry } from "@/lib/prisma";
import { CIS_EVENT_TYPES, type CisEventType } from "@/lib/cis/constants";
import { hasActiveCisConsent } from "@/lib/cis/consent";
import { recomputeCisPreferences } from "@/lib/cis/profile";

export type IncomingCisEvent = {
  clientEventId: string;
  type: string;
  productId?: string | null;
  shopId?: string | null;
  category?: string | null;
  query?: string | null;
  payload?: Record<string, unknown> | null;
  occurredAt?: string | number | Date | null;
};

export function isCisEventType(value: unknown): value is CisEventType {
  return (
    typeof value === "string" &&
    (CIS_EVENT_TYPES as readonly string[]).includes(value)
  );
}

function parseOccurredAt(value: IncomingCisEvent["occurredAt"]) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

export async function ingestCisEvents(userId: string, events: IncomingCisEvent[]) {
  if (!(await hasActiveCisConsent(userId))) {
    return {
      accepted: false as const,
      reason: "consent_required" as const,
      inserted: 0,
      duplicates: 0,
      rejected: events.length,
    };
  }

  let inserted = 0;
  let duplicates = 0;
  let rejected = 0;

  for (const event of events) {
    if (!event.clientEventId?.trim() || !isCisEventType(event.type)) {
      rejected += 1;
      continue;
    }
    try {
      await withDbRetry(() =>
        prisma.cisEvent.create({
          data: {
            userId,
            clientEventId: event.clientEventId.trim(),
            type: event.type,
            productId: event.productId || null,
            shopId: event.shopId || null,
            category: event.category || null,
            query: event.query?.slice(0, 200) || null,
            payload: event.payload ?? {},
            occurredAt: parseOccurredAt(event.occurredAt),
          },
        }),
      );
      inserted += 1;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: string }).code)
          : "";
      if (code === "P2002") {
        duplicates += 1;
      } else {
        rejected += 1;
      }
    }
  }

  if (inserted > 0) {
    void recomputeCisPreferences(userId).catch(() => undefined);
  }

  return {
    accepted: true as const,
    inserted,
    duplicates,
    rejected,
  };
}
