"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { notifyInboxSeen } from "@/lib/inbox-events";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ProductCommentItem = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; image: string | null };
};

type Props = {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountChange?: (productId: string, count: number) => void;
};

export function ProductCommentsSheet({
  productId,
  open,
  onOpenChange,
  onCountChange,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [comments, setComments] = useState<ProductCommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !productId) {
      setComments([]);
      return;
    }
    setLoading(true);
    fetchJson<{ comments?: ProductCommentItem[] }>(
      `/api/products/${productId}/comments`,
    )
      .then(({ data }) => {
        const list = data?.comments ?? [];
        setComments(list);
        const unreadIds = list
          .filter((c) => c.user.id !== session?.user?.id)
          .map((c) => c.id);
        if (unreadIds.length) {
          notifyInboxSeen({ productId });
          void fetchJson("/api/comments/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ commentIds: unreadIds }),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [open, productId, session?.user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  async function send() {
    if (!productId) return;
    if (!session) {
      router.push("/auth/login");
      return;
    }
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { res, data } = await fetchJson<{
      comment?: ProductCommentItem;
      commentsCount?: number;
      error?: string;
    }>(`/api/products/${productId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setSending(false);
    if (!res.ok || !data?.comment) {
      toast.error(data?.error ?? t("feed.commentFailed"));
      return;
    }
    setBody("");
    setComments((prev) => [...prev, data.comment!]);
    if (typeof data.commentsCount === "number") {
      onCountChange?.(productId, data.commentsCount);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="font-heading text-base">
            {t("feed.commentsTitle")}
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("feed.commentEmpty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-bold">
                    {c.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.user.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      c.user.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {c.user.name}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div ref={bottomRef} />
        </div>
        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            placeholder={t("feed.commentPlaceholder")}
            className="bg-surface-2"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !body.trim()}
            className={cn("shrink-0")}
            aria-label={t("feed.commentSend")}
          >
            <Send className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
