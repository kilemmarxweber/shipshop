"use client";

import { DEFAULT_FX } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  cdfPerUsd: number;
  onCdfPerUsd: (n: number) => void;
  confirmed?: boolean;
  onConfirmed?: (v: boolean) => void;
  requireConfirm?: boolean;
};

export function ShopFxRateField({
  cdfPerUsd,
  onCdfPerUsd,
  confirmed = false,
  onConfirmed,
  requireConfirm = false,
}: Props) {
  const rate = Number.isFinite(cdfPerUsd) && cdfPerUsd >= 1 ? cdfPerUsd : DEFAULT_FX.cdfPerUsd;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
      <Label htmlFor="fx-cdf">Taux du jour — CDF pour 1 $US</Label>
      <Input
        id="fx-cdf"
        type="number"
        min={1}
        max={100000}
        step={1}
        value={rate}
        onChange={(e) => onCdfPerUsd(Number.parseInt(e.target.value, 10) || 0)}
        placeholder="2400"
        className="h-11 bg-background"
      />
      <p className="text-[11px] text-muted-foreground">
        Exemple : 1 $US = {rate.toLocaleString("fr-CD")} CDF
      </p>
      {requireConfirm ? (
        <label className="flex items-start gap-2 text-xs leading-relaxed">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmed}
            onChange={(e) => onConfirmed?.(e.target.checked)}
          />
          <span>
            Je valide ce taux de change local pour ma boutique. Je pourrai le
            modifier ensuite dans la config vendeur.
          </span>
        </label>
      ) : null}
    </div>
  );
}
