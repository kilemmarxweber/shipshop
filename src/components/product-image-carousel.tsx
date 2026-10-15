"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  className?: string;
  intervalMs?: number;
  showDots?: boolean;
  overlay?: boolean;
  /** cover = remplit la card ; contain = image entière visible */
  fit?: "cover" | "contain";
};

export function ProductImageCarousel({
  images,
  className,
  intervalMs = 3200,
  showDots = true,
  overlay = false,
  fit = "cover",
}: Props) {
  const list =
    images.length > 0
      ? images
      : ["https://picsum.photos/seed/chipshop/800/1000"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [list.length, intervalMs]);

  return (
    <div className={cn("relative overflow-hidden bg-[#1c1c26]", className)}>
      {list.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className={cn(
            "absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-700",
            i === index ? "opacity-100" : "opacity-0",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className={cn(
              fit === "cover"
                ? "absolute inset-0 size-full object-cover object-center"
                : "max-h-full max-w-full object-contain object-center",
            )}
            style={{ objectPosition: "center center" }}
          />
          {overlay && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/95 via-[#0a0a0f]/25 to-transparent" />
          )}
        </div>
      ))}
      {showDots && list.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
