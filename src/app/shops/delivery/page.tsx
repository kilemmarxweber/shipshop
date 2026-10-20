"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bike, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { ShopPicker } from "@/components/shop-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PricingMode = "PER_KM" | "FLAT_ZONE" | "COMMUNE" | "BUS_STOP";

type ZoneRef = {
  id: string;
  name: string;
  commune: string;
  kind: string;
  pricingMode: PricingMode;
  baseCents: number;
  ratePerKmCents: number;
  flatCents: number | null;
};

type Rate = {
  id?: string;
  zoneId: string | null;
  pricingMode: PricingMode;
  baseCents: number;
  ratePerKmCents: number;
  flatCents: number | null;
  zone?: { id: string; commune: string; name: string } | null;
};

type Courier = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  lat: number;
  lng: number;
  zoneId: string | null;
  shopId: string | null;
  isAvailable: boolean;
  zone?: { id: string; commune: string } | null;
  shop?: { id: string; name: string } | null;
};

type ShopOpt = { id: string; name: string; slug: string };

const MODES: { value: PricingMode; label: string }[] = [
  { value: "PER_KM", label: "Par km" },
  { value: "FLAT_ZONE", label: "Forfait zone" },
  { value: "COMMUNE", label: "Forfait commune" },
  { value: "BUS_STOP", label: "Arrêt de bus" },
];

function centsToUsd(cents: number) {
  return (cents / 100).toFixed(2);
}
function usdToCents(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default function ShopDeliveryPage() {
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<"couriers" | "rates">("couriers");
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<ShopOpt[]>([]);
  const [shopId, setShopId] = useState("");
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [zones, setZones] = useState<ZoneRef[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newCourier, setNewCourier] = useState({
    name: "",
    phone: "",
    address: "",
    lat: "-4.305",
    lng: "15.311",
    zoneId: "",
  });

  const activeShop = useMemo(
    () => shops.find((s) => s.id === shopId),
    [shops, shopId],
  );

  async function loadCouriers(forShop?: string) {
    const q = forShop ? `?shopId=${encodeURIComponent(forShop)}` : "";
    const { res, data } = await fetchJson<{
      couriers?: Courier[];
      shops?: ShopOpt[];
      error?: string;
    }>(`/api/shops/delivery/couriers${q}`);
    if (!res.ok) {
      toast.error(data?.error ?? "Impossible de charger les livreurs");
      return;
    }
    setCouriers(data?.couriers ?? []);
    if (data?.shops?.length) {
      setShops(data.shops);
      if (!forShop && !shopId) setShopId(data.shops[0]!.id);
    }
  }

  async function loadRates(forShop: string) {
    const { res, data } = await fetchJson<{
      rates?: Rate[];
      zones?: ZoneRef[];
      shops?: ShopOpt[];
      error?: string;
    }>(`/api/shops/delivery/rates?shopId=${encodeURIComponent(forShop)}`);
    if (!res.ok) {
      toast.error(data?.error ?? "Impossible de charger les tarifs");
      return;
    }
    setRates(
      (data?.rates ?? []).map((r) => ({
        zoneId: r.zoneId,
        pricingMode: r.pricingMode,
        baseCents: r.baseCents,
        ratePerKmCents: r.ratePerKmCents,
        flatCents: r.flatCents,
        zone: r.zone,
      })),
    );
    setZones(data?.zones ?? []);
    if (data?.shops?.length) setShops(data.shops);
  }

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    (async () => {
      await loadCouriers();
      setLoading(false);
    })();
  }, [session]);

  useEffect(() => {
    if (!shopId || !session) return;
    void loadCouriers(shopId);
    void loadRates(shopId);
  }, [shopId, session]);

  async function createCourier() {
    if (!shopId) return;
    setBusyId("new");
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/shops/delivery/couriers",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCourier.name,
          phone: newCourier.phone,
          address: newCourier.address,
          lat: Number(newCourier.lat),
          lng: Number(newCourier.lng),
          zoneId: newCourier.zoneId || null,
          shopId,
        }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Livreur ajouté");
    setNewCourier({
      name: "",
      phone: "",
      address: "",
      lat: "-4.305",
      lng: "15.311",
      zoneId: "",
    });
    await loadCouriers(shopId);
  }

  async function patchCourier(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/shops/delivery/couriers/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    await loadCouriers(shopId);
  }

  async function deleteCourier(id: string) {
    if (!confirm("Supprimer ce livreur ?")) return;
    setBusyId(id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/shops/delivery/couriers/${id}`,
      { method: "DELETE" },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Supprimé");
    await loadCouriers(shopId);
  }

  function addRateForZone(zoneId: string | null) {
    const z = zoneId ? zones.find((x) => x.id === zoneId) : null;
    setRates((prev) => [
      ...prev,
      {
        zoneId,
        pricingMode: z?.pricingMode ?? "PER_KM",
        baseCents: z?.baseCents ?? 250,
        ratePerKmCents: z?.ratePerKmCents ?? 55,
        flatCents: z?.flatCents ?? z?.baseCents ?? 500,
      },
    ]);
  }

  async function saveRates() {
    if (!shopId) return;
    setBusyId("rates");
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/shops/delivery/rates",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, rates }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Tarifs enregistrés");
    await loadRates(shopId);
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center text-sm text-muted-foreground">
        Connectez-vous pour gérer la livraison
      </div>
    );
  }
  if (loading) return <PageLoader />;
  if (shops.length === 0) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">Aucune boutique</p>
        <Link href="/shops" className="mt-3 text-sm text-primary underline">
          Mes boutiques
        </Link>
      </div>
    );
  }

  const usedZoneIds = new Set(rates.map((r) => r.zoneId).filter(Boolean));

  return (
    <div className="space-y-4 px-4 py-4 pb-24">
      <div>
        <h1 className="font-heading text-lg font-bold">Livraison</h1>
        <p className="text-xs text-muted-foreground">
          Livreurs et tarifs de{" "}
          <span className="font-semibold text-foreground">
            {activeShop?.name ?? "…"}
          </span>
        </p>
      </div>

      <ShopPicker shops={shops} value={shopId} onChange={setShopId} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("couriers")}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
            tab === "couriers"
              ? "bg-primary text-primary-foreground"
              : "border border-border",
          )}
        >
          <Bike className="size-3.5" />
          Livreurs
        </button>
        <button
          type="button"
          onClick={() => setTab("rates")}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
            tab === "rates"
              ? "bg-primary text-primary-foreground"
              : "border border-border",
          )}
        >
          Tarifs
        </button>
      </div>

      {tab === "couriers" && (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <p className="text-xs font-semibold">Ajouter un livreur</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nom"
                value={newCourier.name}
                onChange={(e) =>
                  setNewCourier({ ...newCourier, name: e.target.value })
                }
              />
              <Input
                placeholder="Téléphone"
                value={newCourier.phone}
                onChange={(e) =>
                  setNewCourier({ ...newCourier, phone: e.target.value })
                }
              />
              <Input
                className="col-span-2"
                placeholder="Adresse physique (quartier / avenue)"
                value={newCourier.address}
                onChange={(e) =>
                  setNewCourier({ ...newCourier, address: e.target.value })
                }
              />
              <Input
                placeholder="Lat"
                value={newCourier.lat}
                onChange={(e) =>
                  setNewCourier({ ...newCourier, lat: e.target.value })
                }
              />
              <Input
                placeholder="Lng"
                value={newCourier.lng}
                onChange={(e) =>
                  setNewCourier({ ...newCourier, lng: e.target.value })
                }
              />
              <select
                className="col-span-2 flex h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={newCourier.zoneId}
                onChange={(e) =>
                  setNewCourier({ ...newCourier, zoneId: e.target.value })
                }
              >
                <option value="">Zone (optionnel)</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.commune}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              className="w-full gap-1.5"
              disabled={
                busyId === "new" ||
                !newCourier.name.trim() ||
                !newCourier.phone.trim() ||
                !newCourier.address.trim()
              }
              onClick={() => void createCourier()}
            >
              <Plus className="size-3.5" />
              Ajouter
            </Button>
          </div>

          {couriers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun livreur pour cette boutique
            </p>
          ) : (
            <ul className="space-y-2">
              {couriers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.phone}
                      {c.zone ? ` · ${c.zone.commune}` : ""}
                    </p>
                    {c.address && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.address}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() =>
                      void patchCourier(c.id, {
                        isAvailable: !c.isAvailable,
                      })
                    }
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold",
                      c.isAvailable
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c.isAvailable ? "Dispo" : "Off"}
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="px-2 text-destructive"
                    disabled={busyId === c.id}
                    onClick={() => void deleteCourier(c.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "rates" && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Overrides boutique. Sans override, le devis utilise les tarifs
            plateforme de la commune.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {!rates.some((r) => r.zoneId === null) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => addRateForZone(null)}
              >
                + Défaut boutique
              </Button>
            )}
            {zones
              .filter((z) => !usedZoneIds.has(z.id))
              .slice(0, 8)
              .map((z) => (
                <Button
                  key={z.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => addRateForZone(z.id)}
                >
                  + {z.commune}
                </Button>
              ))}
          </div>

          {rates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun override — tarifs plateforme appliqués
            </p>
          ) : (
            <ul className="space-y-2">
              {rates.map((r, i) => (
                <li
                  key={`${r.zoneId ?? "default"}-${i}`}
                  className="space-y-2 rounded-xl border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {r.zoneId
                        ? (r.zone?.commune ??
                          zones.find((z) => z.id === r.zoneId)?.commune ??
                          "Zone")
                        : "Défaut boutique"}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="px-2 text-destructive"
                      onClick={() =>
                        setRates((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <select
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                    value={r.pricingMode}
                    onChange={(e) => {
                      const pricingMode = e.target.value as PricingMode;
                      setRates((prev) =>
                        prev.map((row, j) =>
                          j === i ? { ...row, pricingMode } : row,
                        ),
                      );
                    }}
                  >
                    {MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Base $
                      <Input
                        className="mt-1"
                        value={centsToUsd(r.baseCents)}
                        onChange={(e) => {
                          const baseCents = usdToCents(e.target.value);
                          setRates((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, baseCents } : row,
                            ),
                          );
                        }}
                      />
                    </label>
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                      $/km
                      <Input
                        className="mt-1"
                        value={centsToUsd(r.ratePerKmCents)}
                        onChange={(e) => {
                          const ratePerKmCents = usdToCents(e.target.value);
                          setRates((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, ratePerKmCents } : row,
                            ),
                          );
                        }}
                      />
                    </label>
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Forfait $
                      <Input
                        className="mt-1"
                        value={centsToUsd(r.flatCents ?? 0)}
                        onChange={(e) => {
                          const flatCents = usdToCents(e.target.value);
                          setRates((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, flatCents } : row,
                            ),
                          );
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Aperçu PER_KM 5 km :{" "}
                    {formatMoney(r.baseCents + 5 * r.ratePerKmCents)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            className="w-full gap-1.5"
            disabled={busyId === "rates"}
            onClick={() => void saveRates()}
          >
            <Save className="size-3.5" />
            Enregistrer les tarifs
          </Button>
        </div>
      )}
    </div>
  );
}
