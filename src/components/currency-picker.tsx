"use client";

import { APP_CURRENCIES, type AppCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CurrencyPicker({
  value,
  onChange,
  disabled,
}: {
  value: AppCurrency;
  onChange: (next: AppCurrency) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {APP_CURRENCIES.map((code) => (
        <button
          key={code}
          type="button"
          disabled={disabled}
          onClick={() => onChange(code)}
          className={cn(
            "rounded-xl border px-2 py-2 text-sm font-bold transition",
            value === code
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
