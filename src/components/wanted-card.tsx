import Link from "next/link";
import { formatMoney, cn } from "@/lib/utils";
import { MediaThumb } from "@/components/media-thumb";
import { useI18n } from "@/components/i18n-provider";

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
}: {
  item: WantedListItem;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <Link
      href={`/wanted/${item.id}`}
      className={cn(
        "flex gap-3 rounded-2xl border border-border bg-surface-2 p-3 transition hover:border-primary/50",
        className,
      )}
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.images[0] ? (
          <MediaThumb
            src={item.images[0]}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-[10px] text-muted-foreground">
            ?
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-sm font-bold">{item.title}</p>
        <p className="mt-0.5 text-xs text-trust">
          {t("wanted.budget")} {formatMoney(item.budgetCents, item.currency)}
        </p>
        <p className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">
            {item.condition === "USED" ? t("wanted.used") : t("wanted.newShop")}
          </span>
          {item.commune ? (
            <span className="rounded-full bg-muted px-2 py-0.5">{item.commune}</span>
          ) : null}
          {item._count != null ? (
            <span className="rounded-full bg-muted px-2 py-0.5">
              {item._count.offers} offre{item._count.offers === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
