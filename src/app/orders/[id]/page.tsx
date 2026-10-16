"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  QrCode,
  Receipt,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { ISSUE_TYPE_LABELS, qrImageUrl } from "@/lib/handover";
import { formatMoney, cn } from "@/lib/utils";
import { usePageBack } from "@/components/back-nav-context";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const CourierLiveMap = dynamic(() => import("@/components/courier-live-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[280px] place-items-center rounded-2xl border border-border bg-surface-2">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  ),
});

type OrderIssue = {
  id: string;
  type: string;
  description: string;
  status: string;
  conversationId: string | null;
  createdAt: string;
};

type OrderDetail = {
  id: string;
  status: string;
  productCents: number;
  shippingCents: number;
  totalCents: number;
  amountCents: number;
  fulfillmentType: "DELIVERY" | "PICKUP";
  deliveryAddress: string | null;
  deliveryCommune: string | null;
  contactPhone: string | null;
  distanceKm: number | null;
  courierDistanceKm: number | null;
  etaMinutes: number | null;
  etaAt: string | null;
  proximityNotifiedAt: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  product: { title: string; images: string[] };
  shop: { id: string; name: string; lat?: number; lng?: number };
  courier: {
    id: string;
    name: string;
    phone: string;
    lat?: number;
    lng?: number;
    lastLat?: number | null;
    lastLng?: number | null;
  } | null;
  pickupReceipt: {
    code: string;
    qrPayload: string;
    scannedAt: string | null;
    redeemedAt: string | null;
  } | null;
  deliveryEvents: {
    id: string;
    status: string;
    note: string | null;
    createdAt: string;
  }[];
  issues?: OrderIssue[];
};

const REFUNDABLE = new Set([
  "PAID",
  "ASSIGNED",
  "FULFILLING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "FAILED",
]);

function OrderInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [issueType, setIssueType] = useState("WRONG_SIZE");
  const [issueDesc, setIssueDesc] = useState("");
  const [showIssue, setShowIssue] = useState(false);

  usePageBack({ fallbackHref: "/profile" });

  async function load() {
    const { res, data } = await fetchJson<{
      order?: OrderDetail;
      error?: string;
    }>(`/api/orders/${id}`);
    if (!res.ok || !data?.order) {
      toast.error(data?.error ?? "Commande introuvable");
      setOrder(null);
      return;
    }
    const issuesRes = await fetchJson<{ issues?: OrderIssue[] }>(
      `/api/orders/${id}/issues`,
    );
    setOrder({
      ...data.order,
      issues: issuesRes.data?.issues ?? [],
    });
  }

  useEffect(() => {
    if (session) load();
  }, [session, id]);

  async function confirmReceipt() {
    setBusy(true);
    const { res, data } = await fetchJson<{
      error?: string;
      message?: string;
      status?: string;
    }>(`/api/orders/${id}/confirm-receipt`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Confirmation impossible");
      return;
    }
    toast.success(data?.message ?? "Livraison confirmée");
    await load();
  }

  const awaitingConfirm =
    order?.status === "AWAITING_CONFIRM" ||
    Boolean(order?.pickupReceipt?.scannedAt && !order.pickupReceipt.redeemedAt);

  // Polling live pendant la course
  const liveTracking =
    order?.fulfillmentType === "DELIVERY" &&
    order.courier &&
    ["ASSIGNED", "FULFILLING", "OUT_FOR_DELIVERY"].includes(order.status);

  useEffect(() => {
    if (!session || (!liveTracking && !awaitingConfirm)) return;
    const t = setInterval(() => {
      load().catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, liveTracking, awaitingConfirm, id]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!liveTracking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [liveTracking]);

  const liveEtaText = useMemo(() => {
    if (!order?.etaAt) {
      if (order?.etaMinutes == null) return null;
      return order.etaMinutes < 60
        ? `${order.etaMinutes} min`
        : `${Math.floor(order.etaMinutes / 60)} h ${order.etaMinutes % 60} min`;
    }
    const ms = new Date(order.etaAt).getTime() - now;
    if (ms <= 0) return "imminent";
    const mins = Math.ceil(ms / 60000);
    return mins < 60
      ? `${mins} min`
      : `${Math.floor(mins / 60)} h ${mins % 60} min`;
  }, [order?.etaAt, order?.etaMinutes, now]);

  async function refund() {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/orders/${id}/refund`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Remboursement impossible");
      return;
    }
    toast.success("Remboursement crédité sur votre portefeuille");
    await load();
  }

  async function submitIssue() {
    if (issueDesc.trim().length < 10) {
      toast.error("Décrivez le problème (10 caractères min.)");
      return;
    }
    setBusy(true);
    const { res, data } = await fetchJson<{
      error?: string;
      conversationId?: string;
    }>(`/api/orders/${id}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: issueType, description: issueDesc }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Signalement impossible");
      return;
    }
    toast.success("Signalement urgent envoyé au vendeur");
    setShowIssue(false);
    setIssueDesc("");
    if (data?.conversationId) {
      router.push(`/messages/${data.conversationId}`);
      return;
    }
    await load();
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

  if (!order) {
    return (
      <PageLoader />
    );
  }

  const total = order.totalCents || order.amountCents;
  const handedOver = Boolean(order.pickupReceipt?.redeemedAt);
  const canRefund =
    REFUNDABLE.has(order.status) && !handedOver && !awaitingConfirm;
  const canReport =
    (order.status === "DELIVERED" || order.status === "PICKED_UP") &&
    handedOver &&
    !(order.issues ?? []).some((i) =>
      ["OPEN", "SELLER_REPLIED"].includes(i.status),
    );
  const openIssue = (order.issues ?? []).find((i) =>
    ["OPEN", "SELLER_REPLIED", "CHANGE_CONFIRMED"].includes(i.status),
  );

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-0">
      <div className="mb-4">
        <h1 className="font-heading text-lg font-bold">Suivi commande</h1>
        <p className="text-[11px] text-muted-foreground">{order.status}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex gap-3">
          <div
            className="size-14 rounded-xl bg-cover bg-center"
            style={{ backgroundImage: `url(${order.product.images[0]})` }}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{order.product.title}</p>
            <p className="text-xs text-muted-foreground">@{order.shop.name}</p>
            <p className="mt-1 font-heading font-bold text-trust">
              {formatMoney(total)}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>
            Produit{" "}
            {formatMoney(
              order.productCents || order.amountCents - order.shippingCents,
            )}{" "}
            + transport {formatMoney(order.shippingCents)}
          </p>
          <p className="flex items-center gap-1">
            {order.fulfillmentType === "DELIVERY" ? (
              <Truck className="size-3" />
            ) : (
              <Receipt className="size-3" />
            )}
            {order.fulfillmentType === "DELIVERY"
              ? `Livraison · ${order.deliveryCommune}`
              : "Retrait boutique"}
          </p>
          {order.deliveryAddress && (
            <p className="flex items-center gap-1">
              <MapPin className="size-3" />
              {order.deliveryAddress}
            </p>
          )}
          {order.courier && (
            <p>
              Livreur: {order.courier.name} · {order.courier.phone}
            </p>
          )}
          {order.fulfillmentType === "DELIVERY" &&
            (order.courierDistanceKm != null || liveEtaText) && (
              <p className="text-trust">
                Parcours ≈ {order.courierDistanceKm ?? "—"} km
                {liveEtaText ? ` · ETA live ~${liveEtaText}` : ""}
                {order.etaAt
                  ? ` · arrivée ~${new Date(order.etaAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </p>
            )}
          {order.proximityNotifiedAt && (
            <p className="text-amber-400">
              Livreur signalé à proximité (&lt; 100 m)
            </p>
          )}
        </div>
      </div>

      {order.fulfillmentType === "DELIVERY" && order.courier && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-heading text-sm font-bold">Suivi live 🛵</p>
            {liveTracking && (
              <span className="animate-pulse text-[10px] font-semibold text-trust">
                ● Temps réel
              </span>
            )}
          </div>
          <CourierLiveMap
            courier={
              order.courier.lastLat != null && order.courier.lastLng != null
                ? { lat: order.courier.lastLat, lng: order.courier.lastLng }
                : order.courier.lat != null && order.courier.lng != null
                  ? { lat: order.courier.lat, lng: order.courier.lng }
                  : null
            }
            destination={
              order.deliveryLat != null && order.deliveryLng != null
                ? { lat: order.deliveryLat, lng: order.deliveryLng }
                : null
            }
            etaText={liveEtaText}
            distanceKm={order.courierDistanceKm}
          />
        </div>
      )}

      {order.pickupReceipt && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/15 to-[#13131a] p-5 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-primary">
            <QrCode className="size-4" />
            <p className="text-xs font-bold tracking-wide uppercase">
              QR de remise
            </p>
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground">
            Présentez ce QR au vendeur ou livreur. Après le scan, confirmez la
            réception ici pour clôturer la commande.
          </p>
          {awaitingConfirm && !handedOver ? (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-left">
              <p className="text-sm font-semibold text-amber-300">
                QR scanné par le vendeur
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Confirmez que vous avez bien reçu le colis. Le statut boutique
                passera alors à livré (SUCCESS).
              </p>
              <Button
                className="mt-3 h-10 w-full cursor-pointer"
                disabled={busy}
                onClick={confirmReceipt}
              >
                {busy ? "…" : "Confirmer la réception"}
              </Button>
            </div>
          ) : null}
          {!handedOver ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrImageUrl(order.pickupReceipt.qrPayload, 220)}
              alt="QR remise"
              width={220}
              height={220}
              className="mx-auto rounded-2xl bg-white p-3"
            />
          ) : (
            <div className="rounded-2xl border border-trust/30 bg-trust/10 px-4 py-8 text-sm font-semibold text-trust">
              Remise confirmée
              <p className="mt-1 text-[11px] font-normal text-muted-foreground">
                {new Date(order.pickupReceipt.redeemedAt!).toLocaleString(
                  "fr-FR",
                )}
              </p>
            </div>
          )}
          <Link
            href={`/api/orders/${order.id}/receipt`}
            target="_blank"
            className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-lg bg-primary px-3 text-xs font-bold text-white"
          >
            Ouvrir le QR plein écran
          </Link>
        </div>
      )}

      {openIssue && (
        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-400">
            <AlertTriangle className="size-4" />
            Signalement {ISSUE_TYPE_LABELS[openIssue.type] ?? openIssue.type}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {openIssue.description}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-amber-300">
            Statut : {openIssue.status}
          </p>
          {openIssue.conversationId && (
            <Link
              href={`/messages/${openIssue.conversationId}`}
              className="mt-3 inline-flex text-xs font-bold text-primary"
            >
              Voir la conversation urgente →
            </Link>
          )}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-bold">Timeline</h2>
          {liveTracking && liveEtaText && (
            <span className="rounded-full bg-trust/15 px-2.5 py-0.5 text-[10px] font-semibold text-trust">
              ETA estimée · {liveEtaText}
              {order.etaAt
                ? ` (~${new Date(order.etaAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})`
                : ""}
            </span>
          )}
        </div>
        <ul className="space-y-3">
          {order.deliveryEvents.map((e, i) => {
            const isLast = i === order.deliveryEvents.length - 1;
            return (
              <li key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      isLast && liveTracking
                        ? "animate-pulse bg-trust"
                        : isLast
                          ? "bg-primary"
                          : "bg-muted/30",
                    )}
                  />
                  {(i < order.deliveryEvents.length - 1 ||
                    (liveTracking && isLast)) && (
                    <span
                      className={cn(
                        "w-px flex-1",
                        liveTracking && isLast
                          ? "bg-trust/40"
                          : "bg-white/10",
                      )}
                    />
                  )}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-semibold">{e.status}</p>
                  {e.note && (
                    <p className="text-xs text-muted-foreground">{e.note}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              </li>
            );
          })}
          {liveTracking && (
            <li className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="size-2.5 animate-pulse rounded-full border-2 border-trust bg-transparent" />
              </div>
              <div className="pb-1">
                <p className="text-sm font-semibold text-trust">
                  Arrivée estimée
                </p>
                <p className="text-xs text-muted-foreground">
                  {liveEtaText
                    ? `Dans ~${liveEtaText}`
                    : "Calcul en cours…"}
                  {order.courierDistanceKm != null
                    ? ` · ${order.courierDistanceKm} km restants`
                    : ""}
                </p>
                {order.etaAt && (
                  <p className="text-[10px] text-muted-foreground">
                    ~{new Date(order.etaAt).toLocaleString("fr-FR")}
                  </p>
                )}
              </div>
            </li>
          )}
        </ul>
      </div>

      {canReport && (
        <div className="mt-6">
          {!showIssue ? (
            <Button
              variant="outline"
              className="h-11 w-full cursor-pointer gap-2 border-amber-500/40 text-amber-400"
              onClick={() => setShowIssue(true)}
            >
              <AlertTriangle className="size-4" />
              Signaler un souci (taille / erreur)
            </Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-surface p-4">
              <p className="text-xs text-muted-foreground">
                Le vendeur reçoit un message urgent. Il reste non lu jusqu&apos;à
                sa réponse ou confirmation du changement (délai 48 h après
                remise).
              </p>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm"
              >
                {Object.entries(ISSUE_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <Textarea
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
                placeholder="Ex. taille M trop petite, je veux du L…"
                className="min-h-24 bg-surface-2"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 cursor-pointer"
                  onClick={() => setShowIssue(false)}
                >
                  Annuler
                </Button>
                <Button
                  disabled={busy}
                  className="flex-1 cursor-pointer bg-amber-500 text-black hover:bg-amber-400"
                  onClick={submitIssue}
                >
                  {busy ? "…" : "Envoyer l'urgence"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {canRefund && (
        <Button
          disabled={busy}
          variant="outline"
          className="mt-4 h-11 w-full cursor-pointer border-destructive/40 text-destructive"
          onClick={refund}
        >
          {busy ? "…" : "Demander un remboursement"}
        </Button>
      )}

      {handedOver && !canRefund && (
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Remise confirmée — remboursement fermé. Utilisez « Signaler un souci »
          si besoin.
        </p>
      )}
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <OrderInner />
    </Suspense>
  );
}
