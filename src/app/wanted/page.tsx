"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import { useI18n } from "@/components/i18n-provider";
import { PageLoader } from "@/components/page-loader";
import { WantedCard, type WantedListItem } from "@/components/wanted-card";

export default function WantedListPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<WantedListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<{ requests?: WantedListItem[] }>("/api/wanted")
      .then(({ data }) => setItems(data?.requests ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 pb-8 pt-3">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-bold">{t("wanted.title")}</h1>
        <Link
          href="/wanted/new"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          {t("wanted.publishWanted")}
        </Link>
      </div>
      {loading ? (
        <PageLoader className="h-[40dvh]" />
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("wanted.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <WantedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
