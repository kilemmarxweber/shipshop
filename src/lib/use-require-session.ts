"use client";

import { authClient } from "@/lib/auth-client";
import { loginHref } from "@/lib/safe-next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Send guests to login and keep the current path for after sign-in. */
export function useRequireSession() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending || session) return;
    const next = `${window.location.pathname}${window.location.search}`;
    router.replace(loginHref(next));
  }, [isPending, pathname, router, session]);

  return { session, isPending, allowed: Boolean(session) };
}
