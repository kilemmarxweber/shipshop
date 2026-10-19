import { z } from "zod";

/** Dimanche → samedi (Date.getDay()). */
export const WEEKDAY_JS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Affichage Lun → Dim. */
export const WEEKDAY_UI = [1, 2, 3, 4, 5, 6, 0] as const;

export type WeekdayJs = (typeof WEEKDAY_JS)[number];

export const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toHhmm(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.trim();
  if (TIME_HHMM.test(s)) return s;
  if (/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(s)) return s.slice(0, 5);
  return null;
}

export const SHOP_HOURS_SELECT = {
  alwaysOpen: true,
  hoursStart: true,
  hoursEnd: true,
  workDays: true,
} as const;

export type ShopHoursFields = {
  alwaysOpen?: boolean | null;
  hoursStart?: string | null;
  hoursEnd?: string | null;
  workDays?: unknown;
};

export const shopHoursBodySchema = z.object({
  alwaysOpen: z.boolean(),
  hoursStart: z.string().nullable().optional(),
  hoursEnd: z.string().nullable().optional(),
  workDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});

export function parseWorkDays(raw: unknown): WeekdayJs[] {
  if (!Array.isArray(raw)) return [];
  const days = new Set<WeekdayJs>();
  for (const n of raw) {
    if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6) {
      days.add(n as WeekdayJs);
    }
  }
  return [...days].sort((a, b) => a - b);
}

export function hoursAreConfigured(h: ShopHoursFields | null | undefined): boolean {
  if (!h) return false;
  if (h.alwaysOpen) return true;
  const days = parseWorkDays(h.workDays);
  return (
    days.length > 0 &&
    TIME_HHMM.test(h.hoursStart ?? "") &&
    TIME_HHMM.test(h.hoursEnd ?? "")
  );
}

export function normalizeShopHours(
  body: z.infer<typeof shopHoursBodySchema>,
): {
  alwaysOpen: boolean;
  hoursStart: string | null;
  hoursEnd: string | null;
  workDays: WeekdayJs[];
} {
  if (body.alwaysOpen) {
    return {
      alwaysOpen: true,
      hoursStart: null,
      hoursEnd: null,
      workDays: [],
    };
  }
  const days = parseWorkDays(body.workDays ?? []);
  const start = toHhmm(body.hoursStart);
  const end = toHhmm(body.hoursEnd);
  if (!days.length && !start && !end) {
    return {
      alwaysOpen: false,
      hoursStart: null,
      hoursEnd: null,
      workDays: [],
    };
  }
  if (!days.length || !start || !end) {
    throw new Error("INCOMPLETE_HOURS");
  }
  return {
    alwaysOpen: false,
    hoursStart: start,
    hoursEnd: end,
    workDays: days,
  };
}

export function weekdayMessagePath(day: WeekdayJs): `hours.d${WeekdayJs}` {
  return `hours.d${day}`;
}
