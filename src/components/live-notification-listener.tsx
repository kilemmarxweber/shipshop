"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { subscribeNotices } from "@/lib/notices-client";

export function LiveNotificationListener() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  const seenNoticeIds = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);

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
