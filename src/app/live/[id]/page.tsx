"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { notifyWalletUpdated } from "@/lib/wallet-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";
import { GIFT_CATALOG } from "@/lib/growth/constants";

type LiveDetail = {
  id: string;
  title: string;
  status: string;
  giftCents: number;
  user: { id: string; name: string };
  product: {
    id: string;
    title: string;
    images: string[];
    priceCents: number;
    shop: { name: string };
  } | null;
  chats: { id: string; body: string; user: { name: string } }[];
};

export default function LiveRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = authClient.useSession();
  usePageBack({ fallbackHref: "/live" });
  const [live, setLive] = useState<LiveDetail | null>(null);
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await fetchJson<{ live?: LiveDetail }>(
      `/api/growth/lives/${id}`,
    );
    if (data?.live) setLive(data.live);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [id]);

  if (!live) return <PageLoader />;

  const isHost = session?.user?.id === live.user.id;

  async function send(action: "chat" | "gift" | "end", extra?: object) {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/growth/lives/${id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return;
    }
    if (action === "gift") {
      notifyWalletUpdated();
      toast.success("Cadeau envoyé");
    }
    if (action === "chat") setChat("");
    await load();
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 py-4">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface">
        <div
          className="aspect-[9/14] bg-surface-2"
          style={
            live.product?.images[0]
              ? {
                  backgroundImage: `url(${live.product.images[0]})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <p className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
            {live.status === "LIVE" ? "LIVE" : "FINI"}
          </p>
          <p className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
            {live.user.name} · {formatMoney(live.giftCents)}
          </p>
        </div>
        {live.product ? (
          <Link
            href={`/product/${live.product.id}`}
            className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-black/55 p-2 backdrop-blur"
          >
            <p className="text-xs font-bold text-white">{live.product.title}</p>
            <p className="text-[10px] text-trust">
              {formatMoney(live.product.priceCents)} · {live.product.shop.name}
            </p>
          </Link>
        ) : null}
      </div>

      <h1 className="mt-3 font-heading text-lg font-bold">{live.title}</h1>

      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto rounded-2xl border border-border bg-surface p-3 text-xs">
        {live.chats.map((m) => (
          <p key={m.id}>
            <span className="font-semibold">{m.user.name}: </span>
            {m.body}
          </p>
        ))}
        {live.chats.length === 0 ? (
          <p className="text-muted-foreground">Soyez le premier à écrire.</p>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          placeholder="Message"
          className="bg-surface-2"
        />
        <Button
          disabled={busy || !chat.trim()}
          onClick={() => void send("chat", { body: chat.trim() })}
        >
          Envoyer
        </Button>
      </div>

      <div className="mt-3 flex gap-2">
        {GIFT_CATALOG.map((g) => (
          <button
            key={g.kind}
            type="button"
            disabled={busy || isHost}
            onClick={() => void send("gift", { kind: g.kind })}
            className="flex-1 rounded-xl border border-border bg-surface py-2 text-[10px] font-bold"
          >
            {g.label}
            <span className="block text-trust">{formatMoney(g.amountCents)}</span>
          </button>
        ))}
      </div>

      {isHost ? (
        <Button
          variant="outline"
          className="mt-3"
          disabled={busy}
          onClick={() => void send("end")}
        >
          Terminer le live
        </Button>
      ) : null}
    </div>
  );
}
