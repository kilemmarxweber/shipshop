"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Radio, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGrowthSurface } from "@/lib/growth/use-growth-surface";
import { authClient } from "@/lib/auth-client";

const DISMISS_KEY = "ss:live-teaser-dismiss";

function dismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistDismiss(id: string) {
  try {
    const next = dismissedIds();
    next.add(id);
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
  } catch {
    /* ignore */
  }
}

/**
 * Bulle live pendant le scroll feed :
 * — abonnés : forte (LIVE + Rejoindre)
 * — connectés non-abonnés : info douce
 */
export function LiveScrollTeaser({
  scrollRootSelector = ".feed-snap.feed-product-list",
}: {
  scrollRootSelector?: string;
}) {
  const { data: session } = authClient.useSession();
  const { surface } = useGrowthSurface();
  const lives = surface?.lives ?? [];
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissed(dismissedIds());
  }, []);

  const pick = useMemo(() => {
    const open = lives.filter(
      (row) =>
        row.status !== "ENDED" &&
        !dismissed.has(row.id) &&
        row.user?.id !== session?.user?.id,
    );
    if (!open.length) return null;
    const followed = open.find((row) => row.followedByMe);
    return followed ?? open[0] ?? null;
  }, [lives, dismissed, session?.user?.id]);

  const strong = Boolean(pick?.followedByMe && session?.user);

  useEffect(() => {
    if (!pick) {
      setVisible(false);
      return;
    }
    // Abonnés : visible assez tôt ; autres : après un peu de scroll
    const minScroll = strong ? 40 : 180;
    const root =
      document.querySelector(scrollRootSelector) ??
      document.querySelector(".app-main");

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const top =
          root instanceof HTMLElement ? root.scrollTop : window.scrollY;
        setVisible(top >= minScroll);
      });
    };
    onScroll();
    const target = root instanceof HTMLElement ? root : window;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [pick, strong, scrollRootSelector]);

  if (!pick || !visible) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-3",
        "bottom-[calc(5.9rem+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur-xl transition",
          strong
            ? "border-destructive/40 bg-[#1a0c12]/95 text-white"
            : "border-white/15 bg-black/75 text-white/90",
        )}
      >
        <Link
          href={`/live/${pick.id}`}
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <span
            className={cn(
              "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full",
              strong ? "ring-2 ring-destructive" : "ring-1 ring-white/25",
            )}
          >
            {pick.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pick.user.image}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <span className="grid size-full place-items-center bg-white/10">
                <Radio className="size-4 text-destructive" />
              </span>
            )}
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-black" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-destructive px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white">
                LIVE
              </span>
              <span className="truncate text-[12px] font-bold">
                {pick.user?.name ?? "Créateur"}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-white/70">
              {strong
                ? pick.title || "Ton abonnement est en live — rejoins"
                : pick.title || "Live shopping en cours — jette un œil"}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
              strong
                ? "bg-destructive text-white"
                : "bg-white/15 text-white",
            )}
          >
            Voir
          </span>
        </Link>
        <button
          type="button"
          aria-label="Fermer"
          className="grid size-7 shrink-0 place-items-center rounded-full text-white/55 hover:bg-white/10 hover:text-white"
          onClick={() => {
            persistDismiss(pick.id);
            setDismissed((prev) => new Set(prev).add(pick.id));
            setVisible(false);
          }}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
