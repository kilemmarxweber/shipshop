"use client";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ProductCard = {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  images?: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: ProductCard[];
};

const SUGGESTIONS = [
  "Quel est le meilleur smartphone ?",
  "Montre-moi des robes élégantes",
  "Aide-moi à trouver un produit",
];

export default function AiChatPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Bonjour ! Je suis votre assistant ShipShop. Posez-moi une question sur le catalogue réel.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!session) {
      router.push("/auth/login");
      return;
    }
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", text: trimmed },
    ]);
    setBusy(true);
    try {
      const { res, data } = await fetchJson<{
        reply?: string;
        products?: ProductCard[];
        error?: string;
      }>("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) {
        throw new Error(data?.error ?? "Assistant indisponible");
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          text:
            data?.reply ??
            "Je n’ai pas trouvé de réponse. Reformulez ou ouvrez Découvrir.",
          products: data?.products ?? [],
        },
      ]);
    } catch (cause) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          text:
            cause instanceof Error
              ? cause.message
              : "Assistant indisponible. Réessayez plus tard.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-4 pt-3">
      <div className="mb-3 flex items-center gap-2">
        <BackButton fallbackHref="/" />
        <h1 className="font-heading text-lg font-bold">IA Chat</h1>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        {messages.length <= 1 ? (
          <div className="mb-4 flex flex-col items-center gap-3 px-2 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-muted text-primary">
              <Sparkles className="size-7" />
            </span>
            <p className="text-sm text-muted-foreground">
              Recherche guidée sur le catalogue ShipShop — prix et stocks réels
              uniquement.
            </p>
            <div className="flex w-full flex-col gap-2">
              {SUGGESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void send(label)}
                  className="rounded-2xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((item) => (
          <div
            key={item.id}
            className={cn(
              "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              item.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-card text-foreground",
            )}
          >
            <p>{item.text}</p>
            {item.products?.length ? (
              <div className="mt-2 space-y-2">
                {item.products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/product/${p.id}`}
                    className="flex gap-2 rounded-xl border border-border/60 bg-background/70 p-2"
                  >
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt=""
                        className="size-12 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="grid size-12 place-items-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-xs font-bold text-foreground">
                        {p.title}
                      </span>
                      <span className="mt-0.5 block text-xs font-extrabold text-emerald-600">
                        {formatMoney(p.priceCents, p.currency)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {busy ? (
          <p className="text-xs text-muted-foreground">Recherche…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez votre question…"
          disabled={busy}
          className="h-11 flex-1 bg-card"
        />
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0"
          disabled={busy || !input.trim()}
          aria-label="Envoyer"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
