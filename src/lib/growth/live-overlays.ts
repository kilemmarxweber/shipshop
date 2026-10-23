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

export const liveOverlaySchema = z.discriminatedUnion("kind", [
  liveTextOverlaySchema,
  liveProductOverlaySchema,
]);

export const liveOverlaysSchema = z.array(liveOverlaySchema).max(12);

export type LiveTextOverlay = z.infer<typeof liveTextOverlaySchema>;
export type LiveProductOverlay = z.infer<typeof liveProductOverlaySchema>;
export type LiveOverlay = z.infer<typeof liveOverlaySchema>;

export function parseLiveOverlays(raw: unknown): LiveOverlay[] {
  const parsed = liveOverlaysSchema.safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

export function newOverlayId() {
  return `ov_${Math.random().toString(36).slice(2, 10)}`;
}
