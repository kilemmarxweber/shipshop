"use client";

import { useRef, type ReactNode } from "react";
import { useVisibleProductDwell } from "@/lib/use-product-dwell";

export function DwellArticle({
  productId,
  enabled,
  className,
  soundOn = false,
  children,
}: {
  productId: string;
  enabled: boolean;
  className?: string;
  soundOn?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useVisibleProductDwell(productId, enabled, ref);
  return (
    <article
      ref={ref}
      className={className}
      data-audio-key={productId}
      {...(soundOn ? { "data-feed-sound-on": "1" } : {})}
    >
      {children}
    </article>
  );
}
