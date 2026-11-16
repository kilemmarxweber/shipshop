"use client";

import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { useEffect, useState } from "react";

/** Owner plateforme ou vendeur de la boutique — comme le fil Android. */
export function useFeedGoLiveAccess() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [shopIds, setShopIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    void (async () => {
      try {
        const growth = await fetchJson<{ isPlatformOwner?: boolean }>(
          "/api/growth/me",
        );
        if (cancel) return;
        const platform = Boolean(growth.data?.isPlatformOwner);
        let nextShopIds: string[] = [];
        if (!platform) {
          const shops = await fetchJson<{ shops?: { id?: string }[] }>(
            "/api/shops?mine=1",
          );
          if (cancel) return;
          nextShopIds = (shops.data?.shops ?? [])
            .map((shop) => shop.id)
            .filter((id): id is string => typeof id === "string");
        }
        setIsPlatformOwner(platform);
        setShopIds(nextShopIds);
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

  const ready = Boolean(userId) && loadedFor === userId;
  return {
    userId,
    isPlatformOwner: ready && isPlatformOwner,
    shopIds: ready ? shopIds : [],
  };
}

export function canShowFeedGoLive(
  access: {
    userId: string | null;
    isPlatformOwner: boolean;
    shopIds: string[];
  },
  shop: { id?: string | null; ownerUserId?: string | null },
) {
  if (!access.userId) return false;
  if (access.isPlatformOwner) return true;
  if (shop.ownerUserId && shop.ownerUserId === access.userId) return true;
  return Boolean(shop.id && access.shopIds.includes(shop.id));
}
