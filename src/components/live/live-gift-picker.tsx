"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatMoney } from "@/lib/utils";
import { Gift, X } from "lucide-react";
import { toast } from "sonner";

const GIFTS = [
  { cents: 50, emoji: "🌸", label: "Fleur" },
  { cents: 100, emoji: "✨", label: "Éclat" },
  { cents: 200, emoji: "💐", label: "Bouquet" },
  { cents: 500, emoji: "💎", label: "Joyau" },
  { cents: 1_000, emoji: "👑", label: "Couronne" },
  { cents: 2_500, emoji: "🚀", label: "Boost" },
  { cents: 10_000, emoji: "🏆", label: "Star" },
] as const;

export function LiveGiftPicker({
  open,
  busy,
  customOpen,
  customAmount,
  onCustomOpen,
  onCustomAmount,
  onClose,
  onSend,
}: {
  open: boolean;
  busy: boolean;
  customOpen: boolean;
  customAmount: string;
  onCustomOpen: (open: boolean) => void;
  onCustomAmount: (value: string) => void;
  onClose: () => void;
  onSend: (amountCents: number) => void;
}) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Fermer"
        data-no-like
        className="absolute inset-0 z-[39] bg-black/50"
        onClick={onClose}
      />
      <div
        data-no-like
        className="absolute inset-x-0 z-40 overflow-hidden rounded-t-[28px] border border-white/12 bg-[#121218]/98 shadow-[0_-18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl bottom-0 pb-[max(0.85rem,env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#7dffb3]/18 to-transparent" />
        <div className="relative px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-full bg-[#7dffb3]/15 text-[#7dffb3]">
                <Gift className="size-5" />
              </span>
              <div>
                <p className="text-[15px] font-extrabold text-white">
                  Envoyer un cadeau
                </p>
                <p className="text-[11px] text-white/50">
                  Fleurs et lumière au centre du live
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-full bg-white/8 text-white transition-transform duration-150 ease-out active:scale-95"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {GIFTS.map((gift) => (
              <button
                key={gift.cents}
                type="button"
                disabled={busy}
                onClick={() => onSend(gift.cents)}
                className="flex min-h-[6.25rem] flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/6 px-1 py-2.5 transition-transform duration-150 ease-out hover:border-[#7dffb3]/40 hover:bg-[#7dffb3]/10 active:scale-[0.96] disabled:opacity-40"
              >
                <span className="text-[28px] leading-none drop-shadow-[0_0_12px_rgba(125,255,179,0.45)]">
                  {gift.emoji}
                </span>
                <span className="text-[11px] font-bold text-white/70">
                  {gift.label}
                </span>
                <span className="text-[13px] font-extrabold tabular-nums text-[#7dffb3]">
                  {formatMoney(gift.cents)}
                </span>
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => onCustomOpen(!customOpen)}
              className={cn(
                "flex min-h-[6.25rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2.5 transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-40",
                customOpen
                  ? "border-[#7dffb3]/50 bg-[#7dffb3]/15"
                  : "border-white/10 bg-white/6 hover:bg-white/10",
              )}
            >
              <span className="text-[28px] leading-none">🎁</span>
              <span className="text-[11px] font-bold text-white/70">Plus</span>
              <span className="text-[13px] font-extrabold text-white">
                Libre
              </span>
            </button>
          </div>

          {customOpen ? (
            <div className="mt-3 flex gap-2">
              <Input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                autoCorrect="off"
                value={customAmount}
                onChange={(e) => onCustomAmount(e.target.value)}
                placeholder="Montant ($)"
                className="h-12 min-h-12 flex-1 rounded-2xl border-white/12 bg-white/8 text-base text-white placeholder:text-white/40"
              />
              <Button
                type="button"
                disabled={busy}
                className="h-12 min-h-12 shrink-0 rounded-2xl bg-[#7dffb3] px-4 font-extrabold text-[#05140F] hover:bg-[#9dffc8]"
                onClick={() => {
                  const dollars = Number.parseFloat(
                    customAmount.replace(",", "."),
                  );
                  if (!Number.isFinite(dollars) || dollars <= 0) {
                    toast.error("Indiquez un montant");
                    return;
                  }
                  onSend(Math.round(dollars * 100));
                }}
              >
                Envoyer
              </Button>
            </div>
          ) : null}

          <p className="mt-3 text-[11px] leading-snug text-white/40">
            Aucun plafond — débité sur votre portefeuille. Le montant reste
            privé pour le diffuseur.
          </p>
        </div>
      </div>
    </>
  );
}
