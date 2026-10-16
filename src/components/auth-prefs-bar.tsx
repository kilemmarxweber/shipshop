"use client";

import { LocalePreferenceButtons } from "@/components/locale-preference-buttons";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthPrefsBar() {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <LocalePreferenceButtons showLabels={false} />
    </div>
  );
}
