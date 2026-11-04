import { useI18n } from "@/components/i18n-provider";
import { MediaThumb } from "@/components/media-thumb";
import { cn, formatMoney } from "@/lib/utils";
import Link from "next/link";

export type WantedListItem = {
  id: string;
  title: string;
  images: string[];
  budgetCents: number;
  currency?: string;
  condition: "NEW_SHOP" | "USED";
  commune?: string | null;
  category: string;
  _count?: { offers: number };
  buyer?: { name: string };
};

export function WantedCard({
  item,
  className,
  highlighted = false,
}: {
  item: WantedListItem;
  className?: string;
  highlighted?: boolean;
}) {
  const { t } = useI18n();
  const offers = item._count?.offers ?? 0;
  const followed = offers > 0;
  return (
    <Link
      href={`/wanted/${item.id}`}
      className={cn(
        "flex gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-trust/40",
        highlighted && "border-trust",
        className,
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
        {item.images[0] ? (
          <MediaThumb src={item.images[0]} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-sm text-muted-foreground">
            ?
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-base font-bold">
          {item.title}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-trust">
          {t("wanted.budget")} {formatMoney(item.budgetCents, item.currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.condition === "USED" ? t("wanted.used") : t("wanted.newShop")}
          {item.commune ? ` · ${item.commune}` : ""}
        </p>
        <p
          className={cn(
            "mt-1.5 text-xs font-bold tabular-nums",
            followed ? "text-trust" : "text-muted-foreground",
          )}
        >
          {followed
            ? `Suivie · ${offers} offre${offers > 1 ? "s" : ""}`
            : "Pas encore suivie"}
        </p>
      </div>
    </Link>
  );
}
