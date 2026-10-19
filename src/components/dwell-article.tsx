"use client";

import { useRef, type ReactNode } from "react";
import { useVisibleProductDwell } from "@/lib/use-product-dwell";

export function DwellArticle({
  productId,
  enabled,
  className,
  children,
}: {
  productId: string;
  enabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useVisibleProductDwell(productId, enabled, ref);
  return (
    <article ref={ref} className={className}>
      {children}
    </article>
  );
}
