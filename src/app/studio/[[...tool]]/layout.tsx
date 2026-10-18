import type { Metadata, Viewport } from "next";
import {
  metadata as studioMetadata,
  viewport as studioViewport,
} from "next-sanity/studio";

/** Studio charge du JS lourd — pas de validation instant / prefetch. */
export const instant = false;

export const metadata: Metadata = {
  ...studioMetadata,
  title: "ShipShop Studio",
};

export const viewport: Viewport = studioViewport;

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
