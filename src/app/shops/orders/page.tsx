"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QrCode, ScanLine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { parseHandoverQrPayload } from "@/lib/handover";
import {
  CANCEL_REASONS,
  type CancelReasonCode,
  isOrderCancellable,
} from "@/lib/order-cancel";
import { formatMoney, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Shop = { id: string; name: string };
type Courier = { id: string; name: string; phone: string; isAvailable: boolean };
type Order = {
  id: string;
  status: string;
  totalCents: number;
  amountCents: number;
  shippingCents: number;
  fulfillmentType: string;
  deliveryCommune: string | null;
  deliveryAddress: string | null;
  contactPhone: string | null;
  product: { title: string; images: string[] };
  buyer: { name: string; phone: string | null };
  courier: { id: string; name: string } | null;
  pickupReceipt: { code: string; redeemedAt: string | null } | null;
};

export default function VendorOrdersPage() {
  const { data: session } = authClient.useSession();
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [pickupCodes, setPickupCodes] = useState<Record<string, string>>({});
  const [scanInput, setScanInput] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] =
    useState<CancelReasonCode>("OUT_OF_STOCK");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  async function loadShops() {
    const res = await fetch("/api/shops?mine=1");
    const json = await res.json();
    setShops(json.shops ?? []);
    if (json.shops?.[0]) setShopId(json.shops[0].id);
  }

  async function loadOrders(id: string) {
    const { data } = await fetchJson<{ orders?: Order[] }>(
      `/api/orders?shopId=${id}&status=all`,
    );
    setOrders(data?.orders ?? []);
  }

  useEffect(() => {
    if (session) {
      loadShops();
      fetchJson<{ couriers?: Courier[] }>("/api/couriers").then(({ data }) =>
        setCouriers(data?.couriers ?? []),
      );
    }
  }, [session]);

  useEffect(() => {
    if (shopId) loadOrders(shopId);
  }, [shopId]);

  async function confirmHandover(input: {
    orderId?: string;
    code?: string;
    qrPayload?: string;
  }) {
    setScanBusy(true);
    const { res, data } = await fetchJson<{
      error?: string;
      status?: string;
      message?: string;
    }>("/api/orders/confirm-handover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setScanBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Validation impossible");
      return;
    }
    toast.success(data?.message ?? `Remise → ${data?.status}`);
    setScanInput("");
    if (shopId) loadOrders(shopId);
  }

  async function onScanSubmit() {
    const raw = scanInput.trim();
    if (!raw) return;
    const parsed = parseHandoverQrPayload(raw);
    if (parsed) {
      await confirmHandover({ qrPayload: raw });
      return;
    }
    // Saisie code seul : chercher dans les commandes chargées
    const match = orders.find(
      (o) =>
        o.pickupReceipt &&
        !o.pickupReceipt.redeemedAt &&
        o.pickupReceipt.code.toUpperCase() === raw.toUpperCase(),
    );
    if (!match) {
      toast.error("Code introuvable dans les commandes ouvertes");
      return;
    }
    await confirmHandover({ orderId: match.id, code: raw });
  }

  async function setStatus(
    orderId: string,
    status: string,
    extra?: { pickupCode?: string; courierId?: string },
  ) {
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/orders/${orderId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      },
    );
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success(`Statut → ${status}`);
    loadOrders(shopId);
  }

  async function vendorCancel() {
    if (!cancelOrderId) return;
    setCancelBusy(true);
    const { res, data } = await fetchJson<{
      error?: string;
      message?: string;
      conversationId?: string;
    }>(`/api/orders/${cancelOrderId}/vendor-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: cancelReason,
        note: cancelNote.trim() || undefined,
      }),
    });
    setCancelBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Annulation impossible");
      return;
    }
    toast.success(data?.message ?? "Commande annulée — client remboursé");
    setCancelOrderId(null);
    setCancelNote("");
    setCancelReason("OUT_OF_STOCK");
    if (shopId) loadOrders(shopId);
  }

  async function assignCourier(orderId: string, courierId?: string) {
    const { res, data } = await fetchJson<{
      error?: string;
      eta?: { etaText: string; distanceKm: number };
    }>(`/api/orders/${orderId}/assign-courier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(courierId ? { courierId } : { auto: true }),
    });
    if (!res.ok) {
      toast.error(data?.error ?? "Assignation impossible");
      return;
    }
    toast.success(
      data?.eta
        ? `Livreur assigné · ${data.eta.distanceKm} km · ETA ${data.eta.etaText}`
        : "Livreur assigné",
    );
    loadOrders(shopId);
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-0 md:px-8">
      <div className="mb-4">
        <h1 className="font-heading text-xl font-bold">Commandes boutique</h1>
        <p className="text-xs text-muted-foreground">
          Scan QR / code pour confirmer la remise
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
          <ScanLine className="size-4" />
          Valider une remise (QR ou code)
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder='Collez le JSON QR ou saisissez le code (ex. "AB12CD")'
            className="bg-[#1c1c26] text-xs"
          />
          <Button
            disabled={scanBusy || !scanInput.trim()}
            className="cursor-pointer shrink-0"
            onClick={onScanSubmit}
          >
            <QrCode className="mr-1 size-4" />
            {scanBusy ? "…" : "Confirmer"}
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Après confirmation, le client ne peut plus demander de remboursement.
        </p>
      </div>

      {shops.length > 0 && (
        <select
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          className="mb-4 h-10 w-full max-w-sm rounded-lg border border-white/10 bg-[#1c1c26] px-3 text-sm"
        >
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {cancelOrderId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13131a] p-5 shadow-xl">
            <p className="font-heading text-sm font-bold">
              Annuler la commande
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Le client sera remboursé et recevra un message d&apos;excuse avec
              le motif.
            </p>
            <select
              value={cancelReason}
              onChange={(e) =>
                setCancelReason(e.target.value as CancelReasonCode)
              }
              className="mt-3 h-10 w-full rounded-lg border border-white/10 bg-[#1c1c26] px-3 text-sm"
            >
              {(
                Object.entries(CANCEL_REASONS) as [
                  CancelReasonCode,
                  (typeof CANCEL_REASONS)[CancelReasonCode],
                ][]
              ).map(([code, meta]) => (
                <option key={code} value={code}>
                  {meta.label}
                </option>
              ))}
            </select>
            <Textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder="Précision optionnelle (ex. rupture fournisseur…)"
              className="mt-2 min-h-20 bg-[#1c1c26] text-sm"
            />
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 cursor-pointer"
                disabled={cancelBusy}
                onClick={() => {
                  setCancelOrderId(null);
                  setCancelNote("");
                }}
              >
                Retour
              </Button>
              <Button
                variant="destructive"
                className="flex-1 cursor-pointer"
                disabled={cancelBusy}
                onClick={vendorCancel}
              >
                {cancelBusy ? "…" : "Annuler & rembourser"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {orders.map((o) => {
          const redeemed = Boolean(o.pickupReceipt?.redeemedAt);
          const delivered =
            o.status === "DELIVERED" || o.status === "PICKED_UP" || redeemed;
          const canCancel = isOrderCancellable(
            o.status,
            o.pickupReceipt?.redeemedAt
              ? new Date(o.pickupReceipt.redeemedAt)
              : null,
          );
          return (
            <li
              key={o.id}
              className="rounded-2xl border border-white/8 bg-[#13131a] p-4"
            >
              <div className="flex gap-3">
                <div
                  className="size-12 rounded-xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${o.product.images[0]})` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.product.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {o.buyer.name} · {o.contactPhone || o.buyer.phone || "—"}
                  </p>
                  <p className="text-xs">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold",
                        "bg-primary/15 text-primary",
                      )}
                    >
                      {o.status}
                    </span>{" "}
                    · {o.fulfillmentType} ·{" "}
                    {formatMoney(o.totalCents || o.amountCents)}
                    {redeemed && (
                      <span className="ml-1 text-trust">· Remis ✓</span>
                    )}
                  </p>
                  {o.deliveryAddress && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {o.deliveryCommune} — {o.deliveryAddress}
                    </p>
                  )}
                  {o.courier && (
                    <p className="text-[11px] text-trust">
                      Livreur: {o.courier.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/orders/${o.id}`}
                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold"
                >
                  Suivi
                </Link>

                {o.fulfillmentType === "DELIVERY" && !redeemed && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => assignCourier(o.id)}
                    >
                      Auto-livreur
                    </Button>
                    <select
                      className="h-8 rounded-lg border border-white/10 bg-[#1c1c26] px-2 text-[11px]"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) assignCourier(o.id, e.target.value);
                      }}
                    >
                      <option value="">Changer livreur…</option>
                      {couriers
                        .filter((c) => c.isAvailable)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setStatus(o.id, "OUT_FOR_DELIVERY")}
                    >
                      En livraison
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setStatus(o.id, "FAILED")}
                    >
                      Échec
                    </Button>
                  </>
                )}

                {o.pickupReceipt && !redeemed && (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <Input
                      placeholder="Code client / QR"
                      value={pickupCodes[o.id] ?? ""}
                      onChange={(e) =>
                        setPickupCodes((p) => ({
                          ...p,
                          [o.id]: e.target.value,
                        }))
                      }
                      className="h-8 max-w-[180px] bg-[#1c1c26] text-xs"
                    />
                    <Button
                      size="sm"
                      className="cursor-pointer"
                      disabled={scanBusy}
                      onClick={() => {
                        const raw = (pickupCodes[o.id] ?? "").trim();
                        if (!raw) {
                          toast.error("Saisissez le code ou collez le QR");
                          return;
                        }
                        if (parseHandoverQrPayload(raw)) {
                          confirmHandover({ qrPayload: raw });
                        } else {
                          confirmHandover({ orderId: o.id, code: raw });
                        }
                      }}
                    >
                      <QrCode className="mr-1 size-3.5" />
                      Confirmer remise
                    </Button>
                  </div>
                )}

                {canCancel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer border-destructive/40 text-destructive"
                    onClick={() => {
                      setCancelOrderId(o.id);
                      setCancelReason("OUT_OF_STOCK");
                      setCancelNote("");
                    }}
                  >
                    <XCircle className="mr-1 size-3.5" />
                    Annuler
                  </Button>
                )}

                {delivered && (
                  <span className="flex items-center gap-1 text-[11px] text-trust">
                    Remise validée — annulation / remboursement fermés
                  </span>
                )}

                {(o.status === "CANCELLED" || o.status === "REFUNDED") && (
                  <span className="text-[11px] text-muted-foreground">
                    Commande {o.status === "CANCELLED" ? "annulée" : "remboursée"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
        {orders.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune commande
          </p>
        )}
      </ul>
    </div>
  );
}
