"use client";

import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { isUserTheme } from "@/lib/user-theme";
import { authClient } from "@/lib/auth-client";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const { data: session } = authClient.useSession();

  function apply(next: "light" | "dark") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(next);
    root.style.colorScheme = next;
    setTheme(next);
    if (session?.user?.id && isUserTheme(next)) {
      void fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-9 shrink-0 rounded-full border border-border bg-muted/40"
      onClick={() => {
        if (resolvedTheme !== "dark" && resolvedTheme !== "light") return;
        apply(resolvedTheme === "dark" ? "light" : "dark");
      }}
      aria-label="Theme"
    >
      <SunMedium className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
