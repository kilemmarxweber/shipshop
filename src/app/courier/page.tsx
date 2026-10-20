"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Bike, Loader2, MapPin, Wallet } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/page-loader";

const CourierLiveMap = dynamic(() => import("@/components/courier-live-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[240px] place-items-center rounded-2xl border border-border">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  ),
});

type Job = {
  id: string;
  status: string;
  shippingCents: number;
  shippingFeeCents: number;
  deliveryAddress: string | null;
  deliveryCommune: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  product: { title: string; images: string[]; currency?: string };
  shop: { name: string };
  buyer: { name: string; phone: string | null };
};

type Payout = {
  id: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  metadata?: { gross?: number; fee?: number; net?: number; orderId?: string } | null;
};

export default function CourierPortalPage() {
  const { data: session } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [courier, setCourier] = useState<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    lastLat?: number | null;
    lastLng?: number | null;
  } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [wallet, setWallet] = useState<{
    currency: string;
    courierCents: number;
  } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { res, data } = await fetchJson<{
      courier?: typeof courier;
      jobs?: Job[];
      payouts?: Payout[];
      wallet?: { currency: string; courierCents: number };
      error?: string;
    }>("/api/courier/me");
    if (!res.ok) {
      setCourier(null);
      return;
    }
    setCourier(data.courier ?? null);
    setJobs(data.jobs ?? []);
    setPayouts(data.payouts ?? []);
    setWallet(data.wallet ?? null);
  }, []);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    load().finally(() => setLoading(false));
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [session, load]);

  useEffect(() => {
    if (!courier) return;
    let watch: number | null = null;
    const active = jobs.some((j) => j.status === "OUT_FOR_DELIVERY");
    if (!active || !navigator.geolocation) return;
    watch = navigator.geolocation.watchPosition(
      (pos) => {
        void fetch(`/api/couriers/${courier.id}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 4000 },
    );
    return () => {
      if (watch != null) navigator.geolocation.clearWatch(watch);
    };
  }, [courier, jobs]);

  async function depart(orderId: string) {
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/courier/jobs/${orderId}/depart`,
      { method: "POST" },
    );
    if (!res.ok) {
      toast.error(data?.error ?? "Impossible de partir");
      return;
    }
    toast.success("En route");
    await load();
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-sm text-primary">
          Connectez-vous
        </Link>
      </div>
    );
  }
  if (loading) return <PageLoader className="h-[40dvh]" />;
  if (!courier) {
    return (
      <p className="px-5 py-16 text-center text-sm text-muted-foreground">
        Aucun compte livreur lié à cet utilisateur.
      </p>
    );
  }

  const open = jobs.find((j) => j.id === openId) ?? jobs[0] ?? null;
  const here = {
    lat: courier.lastLat ?? courier.lat,
    lng: courier.lastLng ?? courier.lng,
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-2">
      <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
        <Bike className="size-5 text-primary" /> Courses
      </h1>
      <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="size-3.5" /> Pot courses (retrait 5 %)
        </p>
        <p className="mt-1 font-heading text-2xl font-extrabold text-trust">
          {formatMoney(wallet?.courierCents ?? 0, wallet?.currency)}
        </p>
        <Link href="/wallet" className="mt-2 inline-block text-xs text-primary">
          Retirer
        </Link>
      </div>

      <ul className="mt-5 space-y-3">
        {jobs.map((job) => {
          const net = Math.max(0, job.shippingCents - (job.shippingFeeCents || 50));
          const selected = open?.id === job.id;
          return (
            <li
              key={job.id}
              className={cn(
                "rounded-2xl border p-4",
                selected ? "border-primary/50 bg-primary/5" : "border-border bg-surface",
              )}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setOpenId(job.id)}
              >
                <p className="text-sm font-semibold">{job.product.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {job.shop.name} · {job.status}
                </p>
                <p className="mt-1 text-xs">
                  Brut {formatMoney(job.shippingCents)} · Frais 0,50 $US · Net{" "}
                  {formatMoney(net)}
                </p>
                {job.deliveryAddress && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" />
                    {job.deliveryAddress} {job.deliveryCommune}
                  </p>
                )}
              </button>
              {["ASSIGNED", "FULFILLING"].includes(job.status) && (
                <Button
                  className="mt-3 w-full"
                  onClick={() => void depart(job.id)}
                >
                  Je pars
                </Button>
              )}
            </li>
          );
        })}
        {jobs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune course en cours
          </p>
        )}
      </ul>

      {open && open.deliveryLat != null && open.deliveryLng != null && (
        <div className="mt-4">
          <CourierLiveMap
            mode="courier"
            courier={here}
            destination={{ lat: open.deliveryLat, lng: open.deliveryLng }}
          />
        </div>
      )}

      <h2 className="mt-8 font-heading text-sm font-bold">Budget (une ligne / commande)</h2>
      <ul className="mt-2 space-y-2">
        {payouts.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs"
          >
            <p className="font-semibold">
              {formatMoney(p.metadata?.net ?? p.amountCents, p.currency)}
            </p>
            <p className="text-muted-foreground">
              Brut {formatMoney(p.metadata?.gross ?? 0, p.currency)} · Frais{" "}
              {formatMoney(p.metadata?.fee ?? 50, p.currency)} ·{" "}
              {new Date(p.createdAt).toLocaleString("fr-FR")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
