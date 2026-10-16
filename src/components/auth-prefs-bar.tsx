"use client";

import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthPrefsBar() {
  return (
    <div className="mb-6 flex justify-end gap-2">
      <LocaleToggle />
      <ThemeToggle />
    </div>
  );
}
