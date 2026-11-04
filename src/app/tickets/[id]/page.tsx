"use client";

import { usePageBack } from "@/components/back-nav-context";
import { useI18n } from "@/components/i18n-provider";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import { qrImageUrl } from "@/lib/handover";
import { formatMoney } from "@/lib/money";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Ticket = {
  id: string;
  status: string;
  purchaseCents: number;
  currency: string;
  code: string;
  qrPayload: string;
  event: {
    title: string;
    venue: string;
    city: string;
    startsAt: string;
    organizerName: string;
    accessNote: string | null;
  };
  type: { name: string };
  refundRequest: { status: string; reason: string } | null;
};

export default function TicketPassPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  usePageBack({ fallbackHref: "/tickets" });

  useEffect(() => {
    fetchJson<{ ticket?: Ticket; error?: string }>(`/api/tickets/${id}`).then(
      ({ res, data }) => {
        if (!res.ok || !data?.ticket) {
          setError(data?.error ?? "Introuvable");
          return;
        }
        setTicket(data.ticket);
      },
    );
  }, [id]);

  async function requestRefund() {
    if (!ticket) return;
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/tickets/${ticket.id}/refund-request`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Impossible");
      return;
    }
    toast.success("Demande envoyée");
    setTicket({
      ...ticket,
      refundRequest: { status: "PENDING", reason },
    });
  }

  if (!ticket && !error) return <PageLoader />;
  if (error || !ticket) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        {error}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-xl font-bold">{ticket.event.title}</h1>
      <p className="text-sm text-muted-foreground">
        {ticket.event.organizerName} · {ticket.type.name}
      </p>
      <p className="text-sm text-muted-foreground">
        {ticket.event.venue}, {ticket.event.city}
      </p>
      <p className="mt-1 text-sm">
        {formatMoney(ticket.purchaseCents, ticket.currency)} · {ticket.status}
      </p>
      <div className="mt-4 flex justify-center rounded-2xl bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImageUrl(ticket.qrPayload, 280)}
          alt={t("tickets.showQr")}
          className="size-56"
        />
      </div>
      <p className="mt-2 text-center font-mono text-sm tracking-widest">
        {ticket.code}
      </p>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {t("tickets.access")}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        {t("tickets.nonRefundable")}
      </p>
      {ticket.status === "PAID" && !ticket.refundRequest ? (
        <div className="mt-4 space-y-2">
          <Input
            placeholder={t("tickets.requestRefund")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || reason.trim().length < 8}
            onClick={() => void requestRefund()}
          >
            {t("tickets.requestRefund")}
          </Button>
        </div>
      ) : ticket.refundRequest ? (
        <p className="mt-3 text-sm">Demande : {ticket.refundRequest.status}</p>
      ) : null}
    </div>
  );
}
