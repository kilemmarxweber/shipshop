"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export function LiveNotificationListener() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  const seenNoticeIds = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    const checkNotices = async () => {
      try {
        const res = await fetch("/api/notices");
        if (!res.ok) return;
        const data = await res.json();
        const notices: Array<{
          id: string;
          title: string;
          body: string;
          href: string | null;
          readAt: string | null;
        }> = data.notices ?? [];

        if (!mounted) return;

        if (!initialFetchDone.current) {
          // Premier appel : mémoriser les notices existantes pour ne pas notifier du passé
          for (const n of notices) {
            seenNoticeIds.current.add(n.id);
          }
          initialFetchDone.current = true;
          return;
        }

        for (const n of notices) {
          if (!n.readAt && !seenNoticeIds.current.has(n.id)) {
            seenNoticeIds.current.add(n.id);

            const isLive =
              n.href?.startsWith("/live/") ||
              n.title.toLowerCase().includes("live") ||
              n.title.toLowerCase().includes("scène");

            if (isLive) {
              toast.info(n.title, {
                description: n.body,
                duration: 10000,
                action: n.href
                  ? {
                      label: "Rejoindre",
                      onClick: () => router.push(n.href!),
                    }
                  : undefined,
              });
            }
          }
        }
      } catch {
        // silence network error
      }
    };

    // Vérifier immédiatement puis toutes les 3 secondes
    void checkNotices();
    const interval = setInterval(checkNotices, 3000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkNotices();
      }
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, router]);

  return null;
}
