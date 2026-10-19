"use client";

import { useI18n } from "@/components/i18n-provider";
import { WalletInlineTopUp } from "@/components/wallet-inline-topup";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Même largeur que Pour toi ; hauteur compacte (pas plein écran). */
export const INSUFFICIENT_FUNDS_SHEET_CLASS = cn(
  "app-sheet-width gap-0 overflow-y-auto border-border bg-surface p-0 shadow-lg",
  "data-[side=bottom]:inset-x-0 data-[side=bottom]:top-auto data-[side=bottom]:bottom-0",
  "data-[side=bottom]:h-auto data-[side=bottom]:max-h-[min(68dvh,26rem)]",
  "data-[side=bottom]:rounded-t-3xl data-[side=bottom]:border-t",
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  neededCents: number;
  balanceCents: number;
  currency?: string;
  onFunded: () => void;
};

export function InsufficientFundsSheet({
  open,
  onOpenChange,
  neededCents,
  balanceCents,
  currency,
  onFunded,
}: Props) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={INSUFFICIENT_FUNDS_SHEET_CLASS}
        style={{ height: "auto", maxHeight: "min(68dvh, 26rem)" }}
      >
        <SheetHeader className="px-4 py-3 pr-12">
          <SheetTitle className="font-heading text-base">
            {t("product.insufficientTitle")}
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <WalletInlineTopUp
            neededCents={neededCents}
            balanceCents={balanceCents}
            currency={currency}
            onFunded={onFunded}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
