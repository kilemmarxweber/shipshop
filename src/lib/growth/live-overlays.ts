import { z } from "zod";

/** Overlays scène live — positions en % du stage (0–100). */

export const liveTextOverlaySchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.literal("text"),
  text: z.string().min(1).max(120),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  scale: z.number().min(0.55).max(2.4),
  color: z.string().max(32).optional(),
});

export const liveProductOverlaySchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.literal("product"),
  productId: z.string().min(1),
  title: z.string().min(1).max(120),
  image: z.string().nullable(),
  priceCents: z.number().int().min(0),
  currency: z.string().min(3).max(8).optional(),
  /** Mode d’emploi / conseil host */
  note: z.string().max(220).default(""),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  scale: z.number().min(0.55).max(2.2),
});

/** Liste produits ouverte par le diffuseur — les viewers voient le même catalogue. */
export const liveCatalogOverlaySchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.literal("catalog"),
  presentedProductId: z.string().max(64).nullable().optional(),
  scrollY: z.number().min(0).max(1).default(0),
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  scale: z.number().min(0.55).max(2.4).default(1),
});

export const liveOverlaySchema = z.discriminatedUnion("kind", [
  liveTextOverlaySchema,
  liveProductOverlaySchema,
  liveCatalogOverlaySchema,
]);

export const liveOverlaysSchema = z.array(liveOverlaySchema).max(12);

export type LiveTextOverlay = z.infer<typeof liveTextOverlaySchema>;
export type LiveProductOverlay = z.infer<typeof liveProductOverlaySchema>;
export type LiveCatalogOverlay = z.infer<typeof liveCatalogOverlaySchema>;
export type LiveOverlay = z.infer<typeof liveOverlaySchema>;

export function overlayList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseLiveOverlays(raw: unknown): LiveOverlay[] {
  return overlayList(raw)
    .flatMap((item) => {
      const parsed = liveOverlaySchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    })
    .slice(0, 12);
}

export function readCatalogState(
  raw: unknown,
  columns?: {
    catalogOpen?: boolean | null;
    presentedProductId?: string | null;
  },
): {
  catalogOpen: boolean;
  presentedProductId: string | null;
  scrollY: number;
} {
  const fromColumn = Boolean(columns?.catalogOpen);
  const list = overlayList(raw);
  const row = list.find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { kind?: unknown }).kind === "catalog",
  ) as { presentedProductId?: unknown; scrollY?: unknown } | undefined;
  const fromOverlay = Boolean(row);
  const presented =
    (typeof columns?.presentedProductId === "string" &&
    columns.presentedProductId
      ? columns.presentedProductId
      : null) ??
    (typeof row?.presentedProductId === "string" && row.presentedProductId
      ? row.presentedProductId
      : null);
  const scrollY =
    typeof row?.scrollY === "number" && Number.isFinite(row.scrollY)
      ? Math.min(1, Math.max(0, row.scrollY))
      : 0;
  return {
    catalogOpen: fromColumn || fromOverlay,
    presentedProductId: presented,
    scrollY,
  };
}

export function withCatalogOverlay(
  overlays: LiveOverlay[],
  open: boolean,
  presentedProductId: string | null,
  scrollY = 0,
): LiveOverlay[] {
  const rest = overlays.filter((row) => row.kind !== "catalog");
  if (!open) return rest;
  return [
    ...rest,
    {
      id: "ov_catalog",
      kind: "catalog",
      presentedProductId,
      scrollY: Math.min(1, Math.max(0, scrollY)),
      x: 0,
      y: 0,
      scale: 1,
    },
  ];
}

export function newOverlayId() {
  return `ov_${Math.random().toString(36).slice(2, 10)}`;
}

export type LiveGiftBurst = {
  id: string;
  amountCents: number;
};

export function readLastGiftBurst(raw: unknown): LiveGiftBurst | null {
  const row = overlayList(raw).find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { kind?: unknown }).kind === "giftburst",
  ) as { id?: unknown; amountCents?: unknown } | undefined;
  if (typeof row?.id !== "string" || !row.id) return null;
  if (typeof row.amountCents !== "number" || !Number.isFinite(row.amountCents)) {
    return null;
  }
  return { id: row.id, amountCents: Math.max(0, Math.round(row.amountCents)) };
}

export function withGiftBurst(raw: unknown, amountCents: number) {
  const list = overlayList(raw).filter(
    (item) =>
      !(
        item &&
        typeof item === "object" &&
        (item as { kind?: unknown }).kind === "giftburst"
      ),
  );
  list.push({
    kind: "giftburst",
    id: `gb_${Date.now().toString(36)}`,
    amountCents: Math.max(0, Math.round(amountCents)),
    at: Date.now(),
  });
  return list;
}
