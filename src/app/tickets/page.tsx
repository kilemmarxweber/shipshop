"use client";

import { usePageBack } from "@/components/back-nav-context";
import { useI18n } from "@/components/i18n-provider";
import { PageLoader } from "@/components/page-loader";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { useEffect, useState } from "react";

type TicketRow = {
  id: string;
  status: string;
  purchaseCents: number;
  currency: string;
  code: string;
  event: { id: string; title: string; startsAt: string; organizerName: string };
  type: { name: string };
};

export default function TicketsPage() {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  usePageBack({ fallbackHref: "/profile" });

  useEffect(() => {
    fetchJson<{ tickets?: TicketRow[] }>("/api/tickets").then(
      ({ res, data }) => {
        if (!res.ok) {
          setTickets([]);
          return;
        }
        setTickets(data?.tickets ?? []);
      },
    );
  }, []);

  if (!tickets) return <PageLoader />;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-xl font-bold">
        {t("tickets.myTickets")}
      </h1>
      {tickets.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Aucun billet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/tickets/${ticket.id}`}
                className="block rounded-xl border border-border bg-card px-3 py-3 no-underline"
              >
                <p className="font-medium">{ticket.event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.type.name} · {ticket.status} ·{" "}
                  {formatMoney(ticket.purchaseCents, ticket.currency)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
