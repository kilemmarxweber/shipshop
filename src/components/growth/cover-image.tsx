"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Face({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image: string | null;
  size?: "sm" | "md";
}) {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#3a3040] text-[10px] font-bold text-white ring-2 ring-[#0f0f16]",
        size === "sm" ? "size-6" : "size-7",
      )}
    >
      {image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

export function CoverImage({
  candidates,
  className,
}: {
  candidates: string[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const src = candidates[index];
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setIndex((prev) => prev + 1)}
    />
  );
}
