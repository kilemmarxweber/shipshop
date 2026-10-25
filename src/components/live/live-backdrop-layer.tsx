"use client";

import { liveBackdropCss } from "@/lib/growth/live-backdrops";
import { cn } from "@/lib/utils";

/** Fond plein écran (image / preset) + éclairage soft optionnel. */
export function LiveBackdropLayer({
  preset,
  url,
  className,
}: {
  preset?: string | null;
  url?: string | null;
  className?: string;
}) {
  const css = liveBackdropCss(preset);
  const hasCustom = Boolean(url?.trim());
  const hasPreset = Boolean(css);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      {hasCustom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          className="absolute left-1/2 top-1/2 h-auto w-auto min-h-full min-w-full max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
        />
      ) : hasPreset ? (
        <div
          className="absolute inset-0 size-full bg-cover bg-center"
          style={{ backgroundImage: css! }}
        />
      ) : (
        <div
          className="absolute inset-0 size-full"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 90% 65% at 50% 12%, rgba(255,210,180,0.28) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(40,28,32,0.55) 0%, transparent 60%), linear-gradient(180deg, #141018 0%, #08060a 100%)",
          }}
        />
      )}

      {/* Sur image perso : grade léger seulement (garde le plein écran lisible) */}
      {hasCustom ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/35" />
          <div className="absolute inset-0 bg-[rgba(255,170,140,0.05)] mix-blend-soft-light" />
        </>
      ) : (
        <>
          <div
            className="absolute inset-x-0 top-0 h-[42%] opacity-90"
            style={{
              background:
                "radial-gradient(ellipse 85% 90% at 50% 0%, rgba(255,220,195,0.22) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-y-[15%] left-0 w-[38%] opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 100% 70% at 0% 40%, rgba(255,175,155,0.14) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-y-[20%] right-0 w-[35%] opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 100% 65% at 100% 45%, rgba(255,200,170,0.12) 0%, transparent 70%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
          <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.4)]" />
          <div className="absolute inset-0 bg-[rgba(255,160,120,0.04)] mix-blend-soft-light" />
        </>
      )}
    </div>
  );
}
