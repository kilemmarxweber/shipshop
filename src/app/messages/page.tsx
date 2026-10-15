"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";

type Conversation = {
  id: string;
  updatedAt: string;
  urgentPending?: boolean;
  shop: { id: string; name: string };
  product: { id: string; title: string; images: string[] } | null;
  buyer: { id: string; name: string };
  messages: {
    body: string;
    createdAt: string;
    senderId: string;
    isUrgent?: boolean;
    requiresAck?: boolean;
  }[];
};

export default function MessagesPage() {
  const { data: session } = authClient.useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    fetchJson<{ conversations?: Conversation[] }>("/api/conversations")
      .then(({ data }) => {
        const list = data?.conversations ?? [];
        list.sort((a, b) => {
          if (a.urgentPending === b.urgentPending) {
            return (
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          }
          return a.urgentPending ? -1 : 1;
        });
        setConversations(list);
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">
          Connectez-vous pour voir vos messages
        </p>
        <Link
          href="/auth/login"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-3">
      <div className="border-b border-white/8 px-4 pb-3">
        <h1 className="font-heading text-lg font-bold">Messages</h1>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Shield className="size-3 text-trust" />
          Conversations protégées — les urgences restent non lues jusqu&apos;à
          réponse
        </p>
      </div>

      {loading ? (
        <PageLoader className="h-[40dvh]" />
      ) : conversations.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Aucune conversation. Touchez l&apos;icône message sur un produit.
        </p>
      ) : (
        <ul>
          {conversations.map((c) => {
            const last = c.messages[0];
            const title =
              c.buyer.id === session.user.id ? c.shop.name : c.buyer.name;
            const urgent = Boolean(c.urgentPending);
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className={cn(
                    "flex gap-3 border-b border-white/5 px-4 py-3 transition hover:bg-white/3",
                    urgent && "bg-amber-500/8",
                  )}
                >
                  <div className="relative grid size-11 place-items-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-sm font-bold">
                    {title.slice(0, 1)}
                    {urgent && (
                      <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-amber-500 text-black shadow">
                        <AlertTriangle className="size-3" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
                        <span className="truncate">{title}</span>
                        {urgent && (
                          <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
                            Urgent
                          </span>
                        )}
                      </p>
                      {last && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(last.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    {c.product && (
                      <p className="truncate text-[10px] text-primary">
                        {c.product.title}
                      </p>
                    )}
                    <p
                      className={cn(
                        "truncate text-xs",
                        urgent
                          ? "font-semibold text-amber-300"
                          : "text-muted-foreground",
                      )}
                    >
                      {urgent ? "⚠ " : ""}
                      {last?.body ?? "Nouvelle conversation"}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
