"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Radio, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGrowthSurface } from "@/lib/growth/use-growth-surface";
import { formatLiveHostLabel } from "@/lib/growth/live-host-label";
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
 * Alerte live au scroll (Pour toi / Abonnements) :
 * visible même sans abonnement ; disparait au X ; jamais si déjà dans ce live.
 */
export function LiveScrollTeaser({
  scrollRootSelector = ".feed-snap.feed-product-list",
}: {
  scrollRootSelector?: string;
}) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { surface } = useGrowthSurface();
  const lives = surface?.lives ?? [];
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissed(dismissedIds());
  }, []);

  const currentLiveId = pathname?.startsWith("/live/")
    ? pathname.split("/")[2] ?? null
    : null;

  const pick = useMemo(() => {
    const open = lives.filter(
      (row) =>
        row.status !== "ENDED" &&
        !dismissed.has(row.id) &&
        row.user?.id !== session?.user?.id &&
        row.id !== currentLiveId,
    );
    if (!open.length) return null;
    const followed = open.find((row) => row.followedByMe);
    const featured = open.find(
      (row) =>
        (row as { hostKind?: string }).hostKind === "OWNER" ||
        (row as { hostKind?: string }).hostKind === "ADMIN" ||
        (row as { hostKind?: string }).hostKind === "INFLUENCER",
    );
    return followed ?? featured ?? open[0] ?? null;
  }, [lives, dismissed, session?.user?.id, currentLiveId]);

  const strong = Boolean(
    pick &&
      (pick.followedByMe ||
        (pick as { hostKind?: string }).hostKind === "OWNER" ||
        (pick as { hostKind?: string }).hostKind === "ADMIN" ||
        (pick as { hostKind?: string }).hostKind === "INFLUENCER"),
  );

  const hostLabel = pick
    ? formatLiveHostLabel({
        hostLabel: (pick as { hostLabel?: string }).hostLabel,
        userName: pick.user?.name,
        shopName: (pick as { shop?: { name?: string } | null }).shop?.name,
      })
    : "";

  useEffect(() => {
    if (!pick || currentLiveId === pick.id) {
      setVisible(false);
      return;
    }
    // Visible pour tout le monde (abonné ou non) dès un léger scroll
    const minScroll = strong ? 24 : 80;
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
  }, [pick, strong, scrollRootSelector, currentLiveId]);

  if (!pick || !visible || currentLiveId === pick.id) return null;

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
            {pick.user?.image ||
            (pick as { shop?: { logoUrl?: string | null } }).shop?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  pick.user?.image ||
                  (pick as { shop?: { logoUrl?: string | null } }).shop
                    ?.logoUrl ||
                  ""
                }
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
              <span className="truncate text-[12px] font-bold">{hostLabel}</span>
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-white/70">
              {pick.followedByMe
                ? pick.title || "Ton abonnement est en live — rejoins"
                : pick.title || "Live shopping en cours — jette un œil"}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
              strong ? "bg-destructive text-white" : "bg-white/15 text-white",
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
