"use client";

import { AuthInline } from "@/components/auth-inline";
import { usePageBack } from "@/components/back-nav-context";
import { useI18n } from "@/components/i18n-provider";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/money";
import {
    clearPaymentIdempotencyKey,
    fetchPaymentJson,
    paymentIdempotencyKey,
} from "@/lib/payments/idempotency-client";
import { notifyWalletUpdated } from "@/lib/wallet-events";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type EventDetail = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  venue: string;
  city: string;
  currency: string;
  status: string;
  organizerKind: string;
  organizerName: string;
  startsAt: string;
  endsAt: string;
  accessNote: string | null;
  ticketTypes: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    remaining: number;
  }[];
};

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  usePageBack({ fallbackHref: "/discover" });

  useEffect(() => {
    fetchJson<{ event?: EventDetail; error?: string }>(`/api/events/${id}`)
      .then(({ res, data }) => {
        if (!res.ok || !data?.event) {
          setError(data?.error ?? "Introuvable");
          return;
        }
        setEvent(data.event);
        setTypeId(data.event.ticketTypes[0]?.id ?? null);
      })
      .catch(() => setError("Introuvable"));
  }, [id]);

  async function buy() {
    if (!event || !typeId) return;
    if (!session?.user) {
      toast.error("Connecte-toi pour acheter");
      return;
    }
    if (!accepted) {
      toast.error(t("tickets.acceptPolicy"));
      return;
    }
    setBusy(true);
    const key = paymentIdempotencyKey(`ticket:${event.id}:${typeId}`);
    try {
      const { res, data } = await fetchPaymentJson<{
        error?: string;
        tickets?: { id: string }[];
      }>(`/api/events/${event.id}/checkout`, {
        method: "POST",
        idempotencyKey: key,
        replayScope: "TICKET",
        body: JSON.stringify({
          ticketTypeId: typeId,
          qty: 1,
          acceptedNonRefundable: true,
        }),
      });
      setBusy(false);
      if (!res.ok) {
        toast.error(data?.error ?? "Achat impossible");
        return;
      }
      clearPaymentIdempotencyKey(`ticket:${event.id}:${typeId}`);
      notifyWalletUpdated();
      const first = data.tickets?.[0]?.id;
      toast.success("Billet acheté");
      router.push(first ? `/tickets/${first}` : "/tickets");
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Achat impossible");
    }
  }

  if (!event && !error) return <PageLoader />;
  if (error || !event) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        {error}
      </p>
    );
  }

  const onSale = event.status === "ON_SALE";

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {event.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl}
          alt=""
          className="mb-4 aspect-[16/10] w-full rounded-2xl object-cover"
        />
      ) : null}
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {event.organizerKind === "ARTIST" ? "Artiste" : "Organisation"} ·{" "}
        {event.organizerName}
      </p>
      <h1 className="font-heading text-2xl font-bold">{event.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {event.venue}, {event.city}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {new Date(event.startsAt).toLocaleString()} —{" "}
        {new Date(event.endsAt).toLocaleString()}
      </p>
      {event.description ? (
        <p className="mt-3 whitespace-pre-wrap text-sm">{event.description}</p>
      ) : null}
      {event.accessNote ? (
        <p className="mt-2 text-sm text-muted-foreground">{event.accessNote}</p>
      ) : null}

      <div className="mt-5 space-y-2">
        {event.ticketTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setTypeId(type.id)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${
              typeId === type.id
                ? "border-primary bg-primary/10"
                : "border-border"
            }`}
          >
            <span>
              <span className="block font-medium">{type.name}</span>
              <span className="text-xs text-muted-foreground">
                {type.remaining > 0
                  ? `${type.remaining} restants`
                  : t("tickets.soldOut")}
              </span>
            </span>
            <span className="font-semibold">
              {formatMoney(type.priceCents, event.currency)}
            </span>
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1"
        />
        <span>{t("tickets.nonRefundable")}</span>
      </label>

      {!session?.user ? (
        <div className="mt-4">
          <AuthInline />
        </div>
      ) : (
        <Button
          className="mt-4 w-full"
          disabled={busy || !onSale || !typeId}
          onClick={() => void buy()}
        >
          {t("tickets.buy")}
        </Button>
      )}
      <Link
        href="/tickets"
        className="mt-3 block text-center text-sm text-primary"
      >
        {t("tickets.myTickets")}
      </Link>
    </div>
  );
}
