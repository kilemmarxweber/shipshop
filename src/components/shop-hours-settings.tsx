"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import {
  WEEKDAY_UI,
  hoursAreConfigured,
  parseWorkDays,
  weekdayMessagePath,
  type ShopHoursFields,
  type WeekdayJs,
} from "@/lib/shop-hours";
import { cn } from "@/lib/utils";
import { ShopPicker } from "@/components/shop-picker";

type ShopRow = ShopHoursFields & {
  id: string;
  name: string;
  slug: string;
};

export function ShopHoursSettings() {
  const { t } = useI18n();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [shopId, setShopId] = useState("");
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const [hoursStart, setHoursStart] = useState("08:00");
  const [hoursEnd, setHoursEnd] = useState("18:00");
  const [workDays, setWorkDays] = useState<WeekdayJs[]>([1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchJson<{ shops?: ShopRow[] }>("/api/shops?mine=1")
      .then(({ data }) => {
        const list = data?.shops ?? [];
        setShops(list);
        if (list[0]) setShopId(list[0].id);
      })
      .finally(() => setLoaded(true));
  }, []);

  const shop = shops.find((s) => s.id === shopId) ?? null;

  useEffect(() => {
    if (!shop) return;
    const configured = hoursAreConfigured(shop);
    setAlwaysOpen(Boolean(shop.alwaysOpen));
    setHoursStart(shop.hoursStart ?? "08:00");
    setHoursEnd(shop.hoursEnd ?? "18:00");
    const days = parseWorkDays(shop.workDays);
    setWorkDays(configured && days.length ? days : [1, 2, 3, 4, 5]);
  }, [shop]);

  if (!loaded || shops.length === 0) return null;

  function toggleDay(day: WeekdayJs) {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  async function save() {
    if (!shop) return;
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string; shop?: ShopRow }>(
      `/api/shops/${shop.slug}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alwaysOpen,
          hoursStart: alwaysOpen ? null : hoursStart,
          hoursEnd: alwaysOpen ? null : hoursEnd,
          workDays: alwaysOpen ? [] : workDays,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? t("hours.saveFailed"));
      return;
    }
    if (data?.shop) {
      setShops((prev) =>
        prev.map((s) => (s.id === data.shop!.id ? { ...s, ...data.shop } : s)),
      );
    }
    toast.success(t("hours.saved"));
  }

  return (
    <section className="mt-4 mb-2 space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-heading text-base font-semibold">
          {t("hours.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hours.hint")}</p>
      </div>

      {shops.length > 1 ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("hours.shop")}</span>
          <ShopPicker shops={shops} value={shopId} onChange={setShopId} />
        </label>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAlwaysOpen(true)}
          className={cn(
            "rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold",
            alwaysOpen ? "border-primary bg-primary/10" : "border-muted",
          )}
        >
          {t("hours.always")}
        </button>
        <button
          type="button"
          onClick={() => setAlwaysOpen(false)}
          className={cn(
            "rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold",
            !alwaysOpen ? "border-primary bg-primary/10" : "border-muted",
          )}
        >
          {t("hours.scheduled")}
        </button>
      </div>

      {!alwaysOpen ? (
        <>
          <div>
            <p className="mb-2 text-sm font-medium">{t("hours.days")}</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_UI.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "h-9 min-w-11 rounded-full border px-2.5 text-xs font-bold",
                    workDays.includes(day)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {t(weekdayMessagePath(day))}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm font-medium">{t("hours.start")}</span>
              <Input
                type="time"
                value={hoursStart}
                onChange={(e) => setHoursStart(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">{t("hours.end")}</span>
              <Input
                type="time"
                value={hoursEnd}
                onChange={(e) => setHoursEnd(e.target.value)}
              />
            </label>
          </div>
        </>
      ) : null}

      <Button
        type="button"
        className="h-11 w-full font-bold"
        disabled={busy || (!alwaysOpen && workDays.length === 0)}
        onClick={() => void save()}
      >
        {busy ? t("common.loading") : t("common.save")}
      </Button>
    </section>
  );
}
