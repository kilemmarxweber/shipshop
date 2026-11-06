"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { subscribeNotices } from "@/lib/notices-client";

export function LiveNotificationListener() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  const pathname = usePathname();
  const seenNoticeIds = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!userId) return;

    return subscribeNotices((notices) => {
      if (!initialFetchDone.current) {
        for (const n of notices) seenNoticeIds.current.add(n.id);
        initialFetchDone.current = true;
        return;
      }

      for (const n of notices) {
        if (n.readAt || seenNoticeIds.current.has(n.id)) continue;
        seenNoticeIds.current.add(n.id);

        const isLive =
          n.href?.startsWith("/live/") ||
          n.title.toLowerCase().includes("live") ||
          n.title.toLowerCase().includes("scène");
        if (!isLive) continue;

        const href = n.href;
        // Déjà connecté à ce live → ne plus proposer l’alerte
        if (
          href &&
          pathnameRef.current?.startsWith("/live/") &&
          pathnameRef.current.includes(href.replace(/^\/live\//, "").split("?")[0])
        ) {
          continue;
        }
        if (href && pathnameRef.current === href) continue;

        toast.info(n.title, {
          description: n.body,
          duration: 10000,
          action: href
            ? {
                label: "Rejoindre",
                onClick: () => routerRef.current.push(href),
              }
            : undefined,
        });
      }
    });
  }, [userId]);

  return null;
}
