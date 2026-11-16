"use client";

import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { useEffect, useState } from "react";

export type FeedGoLiveAccess = {
  userId: string | null;
  isPlatformOwner: boolean;
  shopIds: string[];
  ready: boolean;
};

const EMPTY: FeedGoLiveAccess = {
  userId: null,
  isPlatformOwner: false,
  shopIds: [],
  ready: false,
};

/**
 * Accès « démarrer un live » — parité Android (`isSellerOfShop` + OWNER/ADMIN).
 * Le match `ownerUserId === session.user.id` suffit dès la session, sans attendre l’API.
 */
export function useFeedGoLiveAccess(): FeedGoLiveAccess {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [shopIds, setShopIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setLoadedFor(null);
      setIsPlatformOwner(false);
      setShopIds([]);
      return;
    }
    let cancel = false;
    void (async () => {
      try {
        const [growth, shops] = await Promise.all([
          fetchJson<{
            isPlatformOwner?: boolean;
            canGoLive?: boolean;
          }>("/api/growth/me"),
          fetchJson<{ shops?: { id?: string }[] }>("/api/shops?mine=1"),
        ]);
        if (cancel) return;
        setIsPlatformOwner(Boolean(growth.data?.isPlatformOwner));
        setShopIds(
          (shops.data?.shops ?? [])
            .map((shop) => shop.id)
            .filter((id): id is string => typeof id === "string"),
        );
        setLoadedFor(userId);
      } catch {
        if (!cancel) {
          setIsPlatformOwner(false);
          setShopIds([]);
          setLoadedFor(userId);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userId]);

  if (!userId) return EMPTY;

  const ready = loadedFor === userId;
  return {
    userId,
    isPlatformOwner: ready && isPlatformOwner,
    shopIds: ready ? shopIds : [],
    ready,
  };
}

/** true si le user peut voir le cluster LIVE + abonnés sur cette carte. */
export function canShowFeedGoLive(
  access: Pick<FeedGoLiveAccess, "userId" | "isPlatformOwner" | "shopIds">,
  shop: { id?: string | null; ownerUserId?: string | null },
) {
  if (!access.userId) return false;
  if (access.isPlatformOwner) return true;
  if (shop.ownerUserId && shop.ownerUserId === access.userId) return true;
  return Boolean(shop.id && access.shopIds.includes(shop.id));
}
