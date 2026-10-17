"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bike, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PricingMode = "PER_KM" | "FLAT_ZONE" | "COMMUNE" | "BUS_STOP";

type Zone = {
  id: string;
  name: string;
  commune: string;
  kind: "CENTER" | "REMOTE";
  pricingMode: PricingMode;
  baseCents: number;
  ratePerKmCents: number;
  flatCents: number | null;
  busStops: { name: string; lat?: number | null; lng?: number | null; cents: number }[] | null;
  centerLat: number;
  centerLng: number;
  isActive: boolean;
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
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export default function AdminDeliveryPage() {
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<"zones" | "couriers">("zones");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [shops, setShops] = useState<ShopOpt[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [newCourier, setNewCourier] = useState({
    name: "",
    phone: "",
    address: "",
    lat: "-4.305",
    lng: "15.311",
    zoneId: "",
    shopId: "",
  });

  async function load() {
    const [z, c] = await Promise.all([
      fetchJson<{ zones?: Zone[]; error?: string }>("/api/admin/delivery-zones"),
      fetchJson<{
        couriers?: Courier[];
        shops?: ShopOpt[];
        error?: string;
      }>("/api/shops/delivery/couriers"),
    ]);
    if (z.res.status === 403 || c.res.status === 403) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setZones(z.data?.zones ?? []);
    setCouriers(c.data?.couriers ?? []);
    setShops(c.data?.shops ?? []);
  }

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    load().finally(() => setLoading(false));
  }, [session]);

  async function saveZone(zone: Zone) {
    setBusyId(zone.id);
    const { res, data } = await fetchJson<{ zone?: Zone; error?: string }>(
      `/api/admin/delivery-zones/${zone.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: zone.name,
          commune: zone.commune,
          kind: zone.kind,
          pricingMode: zone.pricingMode,
          baseCents: zone.baseCents,
          ratePerKmCents: zone.ratePerKmCents,
          flatCents: zone.flatCents,
          busStops: zone.busStops,
          isActive: zone.isActive,
        }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Zone enregistrée");
    setEditZone(null);
    await load();
  }

  async function deactivateZone(id: string) {
    setBusyId(id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/admin/delivery-zones/${id}`,
      { method: "DELETE" },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Zone désactivée");
    await load();
  }

  async function createCourier() {
    setBusyId("new-courier");
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
          shopId: newCourier.shopId || null,
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
      shopId: "",
    });
    await load();
  }

  async function patchCourier(id: string, patch: Partial<Courier>) {
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
    await load();
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
    toast.success("Livreur supprimé");
    await load();
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center text-sm text-muted-foreground">
        Connectez-vous
      </div>
    );
  }
  if (loading) return <PageLoader className="h-[40dvh]" />;
  if (allowed === false) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">Accès admin requis</p>
        <Link href="/shops" className="mt-4 text-sm text-primary underline">
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-24">
      <div>
        <h1 className="font-heading text-lg font-bold">Zones & livreurs</h1>
        <p className="text-xs text-muted-foreground">
          Tarifs plateforme (km, forfait, commune, arrêt bus) + flotte
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("zones")}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
            tab === "zones"
              ? "bg-primary text-primary-foreground"
              : "border border-border",
          )}
        >
          <MapPin className="size-3.5" />
          Zones
        </button>
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
      </div>

      {tab === "zones" && (
        <ul className="space-y-2">
          {zones.map((z) => {
            const open = editZone?.id === z.id;
            const draft = open ? editZone : z;
            return (
              <li
                key={z.id}
                className={cn(
                  "rounded-xl border border-border p-3",
                  !z.isActive && "opacity-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{z.commune}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {z.name} · {z.kind} · {z.pricingMode}
                      {" · "}
                      {z.pricingMode === "PER_KM"
                        ? `${formatMoney(z.baseCents)} + ${formatMoney(z.ratePerKmCents)}/km`
                        : formatMoney(z.flatCents ?? z.baseCents)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() =>
                        setEditZone(open ? null : { ...z, busStops: z.busStops ?? [] })
                      }
                    >
                      {open ? "Fermer" : "Éditer"}
                    </Button>
                    {z.isActive && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] text-destructive"
                        disabled={busyId === z.id}
                        onClick={() => void deactivateZone(z.id)}
                      >
                        Off
                      </Button>
                    )}
                  </div>
                </div>

                {open && draft && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <label className="block text-[10px] font-semibold uppercase text-muted-foreground">
                      Mode
                      <select
                        className="mt-1 flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                        value={draft.pricingMode}
                        onChange={(e) =>
                          setEditZone({
                            ...draft,
                            pricingMode: e.target.value as PricingMode,
                          })
                        }
                      >
                        {MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-[10px] font-semibold uppercase text-muted-foreground">
                        Base ($)
                        <Input
                          className="mt-1"
                          value={centsToUsd(draft.baseCents)}
                          onChange={(e) =>
                            setEditZone({
                              ...draft,
                              baseCents: usdToCents(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="block text-[10px] font-semibold uppercase text-muted-foreground">
                        $/km
                        <Input
                          className="mt-1"
                          value={centsToUsd(draft.ratePerKmCents)}
                          onChange={(e) =>
                            setEditZone({
                              ...draft,
                              ratePerKmCents: usdToCents(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="col-span-2 block text-[10px] font-semibold uppercase text-muted-foreground">
                        Forfait ($)
                        <Input
                          className="mt-1"
                          value={centsToUsd(draft.flatCents ?? 0)}
                          onChange={(e) =>
                            setEditZone({
                              ...draft,
                              flatCents: usdToCents(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                    {draft.pricingMode === "BUS_STOP" && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                          Arrêts de bus
                        </p>
                        {(draft.busStops ?? []).map((stop, i) => (
                          <div key={i} className="flex gap-1.5">
                            <Input
                              placeholder="Nom"
                              value={stop.name}
                              onChange={(e) => {
                                const busStops = [...(draft.busStops ?? [])];
                                busStops[i] = {
                                  ...stop,
                                  name: e.target.value,
                                };
                                setEditZone({ ...draft, busStops });
                              }}
                            />
                            <Input
                              className="w-24"
                              placeholder="$"
                              value={centsToUsd(stop.cents)}
                              onChange={(e) => {
                                const busStops = [...(draft.busStops ?? [])];
                                busStops[i] = {
                                  ...stop,
                                  cents: usdToCents(e.target.value),
                                };
                                setEditZone({ ...draft, busStops });
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="px-2"
                              onClick={() => {
                                const busStops = (draft.busStops ?? []).filter(
                                  (_, j) => j !== i,
                                );
                                setEditZone({ ...draft, busStops });
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() =>
                            setEditZone({
                              ...draft,
                              busStops: [
                                ...(draft.busStops ?? []),
                                { name: "", cents: 500 },
                              ],
                            })
                          }
                        >
                          <Plus className="size-3" /> Arrêt
                        </Button>
                      </div>
                    )}
                    <Button
                      type="button"
                      className="w-full gap-1.5"
                      disabled={busyId === draft.id}
                      onClick={() => void saveZone(draft)}
                    >
                      <Save className="size-3.5" />
                      Enregistrer
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {tab === "couriers" && (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <p className="text-xs font-semibold">Nouveau livreur</p>
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
                {zones
                  .filter((z) => z.isActive)
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.commune}
                    </option>
                  ))}
              </select>
              <select
                className="col-span-2 flex h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={newCourier.shopId}
                onChange={(e) =>
                  setNewCourier({ ...newCourier, shopId: e.target.value })
                }
              >
                <option value="">Plateforme (toutes boutiques)</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              className="w-full gap-1.5"
              disabled={
                busyId === "new-courier" ||
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
                    {c.shop ? ` · ${c.shop.name}` : " · Plateforme"}
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
                    void patchCourier(c.id, { isAvailable: !c.isAvailable })
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
        </div>
      )}
    </div>
  );
}
