"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { notifyInboxSeen, notifyInboxUpdated } from "@/lib/inbox-events";
import { ISSUE_TYPE_LABELS } from "@/lib/handover";
import { useI18n } from "@/components/i18n-provider";
import { usePageBack } from "@/components/back-nav-context";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  isUrgent?: boolean;
  requiresAck?: boolean;
  kind?: string | null;
  orderIssueId?: string | null;
  sender: { id: string; name: string };
};

type OpenIssue = {
  id: string;
  orderId: string;
  type: string;
  description: string;
  status: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  shop: { id: string; name: string };
  product: { id: string; title: string; images: string[] } | null;
  wantedRequest?: {
    id: string;
    title: string;
    condition: string;
    budgetCents: number;
  } | null;
  buyer: { id: string; name: string };
};

function ChatInner() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { data: session, isPending } = authClient.useSession();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [openIssues, setOpenIssues] = useState<OpenIssue[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);

  usePageBack({ fallbackHref: "/messages" });

  async function load() {
    const { res, data } = await fetchJson<{
      conversation?: Conversation;
      messages?: Message[];
      openIssues?: OpenIssue[];
      error?: string;
    }>(`/api/conversations/${id}`);
    if (!res.ok) {
      toast.error(data?.error ?? "Conversation introuvable");
      return;
    }
    setConversation(data?.conversation ?? null);
    setMessages(data?.messages ?? []);
    setOpenIssues(data?.openIssues ?? []);
    notifyInboxSeen({ conversationId: id });
  }

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [session, isPending, id]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = body.trim();
    if (!text || sending || !session) return;
    const tempId = `temp:${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      body: text,
      createdAt: new Date().toISOString(),
      senderId: session.user.id,
      sender: { id: session.user.id, name: session.user.name ?? "Moi" },
    };
    setBody("");
    setSending(true);
    setMessages((prev) => [...prev, optimistic]);
    const { res, data } = await fetchJson<{
      message?: Message;
      error?: string;
    }>(`/api/conversations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setSending(false);
    if (!res.ok || !data?.message) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setBody(text);
      toast.error(data?.error ?? "Envoi impossible");
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? data.message! : m)),
    );
    toast.success("Message envoyé");
    notifyInboxUpdated();
    void load();
  }

  async function resolveIssue(
    issue: OpenIssue,
    action: "confirm_change" | "reject" | "resolve",
  ) {
    setActing(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/orders/${issue.orderId}/issues/${issue.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    setActing(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return;
    }
    toast.success(
      action === "confirm_change"
        ? "Changement confirmé"
        : action === "reject"
          ? "Signalement refusé"
          : "Signalement clôturé",
    );
    await load();
  }

  if (isPending || loading) {
    return <PageLoader />;
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  const isBuyer = conversation?.buyer.id === session.user.id;
  const title = isBuyer
    ? conversation?.shop.name
    : conversation?.buyer.name;
  const hasUrgent = messages.some((m) => m.isUrgent && m.requiresAck);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-background px-4 pb-3 pt-0">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-heading text-sm font-bold">
            {title}
            {hasUrgent && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                <AlertTriangle className="size-3" />
                {t("messages.urgent")}
              </span>
            )}
          </p>
          {conversation?.wantedRequest && (
            <Link
              href={`/wanted/${conversation.wantedRequest.id}`}
              className="truncate text-[11px] text-primary"
            >
              Je cherche · {conversation.wantedRequest.title}
            </Link>
          )}
          {conversation?.product && (
            <Link
              href={`/product/${conversation.product.id}`}
              className="truncate text-[11px] text-primary"
            >
              {conversation.product.title}
            </Link>
          )}
        </div>
      </div>

      {!isBuyer && openIssues.length > 0 && (
        <div className="shrink-0 space-y-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-3">
          {openIssues.map((issue) => (
            <div key={issue.id} className="rounded-xl border border-amber-500/40 bg-surface p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <AlertTriangle className="size-3.5" />
                {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {issue.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={acting}
                  className="h-8 cursor-pointer bg-amber-500 text-black hover:bg-amber-400"
                  onClick={() => resolveIssue(issue, "confirm_change")}
                >
                  Confirmer le changement
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={acting}
                  className="h-8 cursor-pointer"
                  onClick={() => resolveIssue(issue, "resolve")}
                >
                  Clôturer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting}
                  className="h-8 cursor-pointer border-destructive/40 text-destructive"
                  onClick={() => resolveIssue(issue, "reject")}
                >
                  Refuser
                </Button>
                <Link
                  href={`/orders/${issue.orderId}`}
                  className="inline-flex h-8 items-center text-[11px] font-semibold text-primary"
                >
                  Voir commande →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        ref={threadRef}
        className="min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto px-3 py-4"
      >
        {messages.map((m) => {
          const mine = m.senderId === session.user.id;
          const urgent = Boolean(m.isUrgent);
          const pending = Boolean(m.requiresAck);
          return (
            <div
              key={m.id}
              className={cn(
                "flex min-w-0",
                mine ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "min-w-0 max-w-[min(80%,22rem)] overflow-hidden rounded-2xl px-3 py-2 text-sm",
                  urgent
                    ? "rounded-bl-md border border-amber-500/50 bg-amber-500/15 text-amber-50"
                    : mine
                      ? "rounded-br-md bg-primary text-white"
                      : "rounded-bl-md bg-muted text-foreground",
                )}
              >
                {urgent && (
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                    <AlertTriangle className="size-3" />
                    Urgence
                    {pending && " · non lu"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {m.body}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    urgent
                      ? "text-amber-200/70"
                      : mine
                        ? "text-white/70"
                        : "text-muted-foreground",
                  )}
                >
                  {new Date(m.createdAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border bg-background p-3">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            !isBuyer && hasUrgent
              ? t("messages.ackPlaceholder")
              : t("messages.writePlaceholder")
          }
          className="h-11 bg-surface-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          onClick={send}
          disabled={sending || !body.trim()}
          className="h-11 shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ConversationPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<PageLoader />}>
        <ChatInner />
      </Suspense>
    </div>
  );
}
