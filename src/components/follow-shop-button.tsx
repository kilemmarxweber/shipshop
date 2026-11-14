"use client";

import { useRouter } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/components/i18n-provider";
import { fetchJson } from "@/lib/fetch-json";
import { compactCount } from "@/lib/growth/challenge-look";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  followedByMe: boolean;
  isOwnShop?: boolean;
  compact?: boolean;
  icon?: boolean;
  count?: number;
  className?: string;
  onChange?: (followed: boolean, followersCount?: number) => void;
  /** When already following, open conversation instead of unfollow (mobile parity). */
  onMessage?: () => void;
};

export function FollowShopButton({
  slug,
  followedByMe,
  isOwnShop = false,
  compact = false,
  icon = false,
  count = 0,
  className,
  onChange,
  onMessage,
}: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data: session } = authClient.useSession();

  if (isOwnShop) return null;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!session) {
      router.push("/auth/login");
      return;
    }
    if (followedByMe && onMessage) {
      onMessage();
      return;
    }
    const method = followedByMe ? "DELETE" : "POST";
    onChange?.(!followedByMe);
    const { res, data } = await fetchJson<{
      followedByMe?: boolean;
      followersCount?: number;
      error?: string;
    }>(`/api/shops/${slug}/follow`, { method });
    if (!res.ok) {
      onChange?.(followedByMe, count);
      toast.error(data?.error ?? t("follow.failed"));
      return;
    }
    onChange?.(Boolean(data?.followedByMe), data?.followersCount);
  }

  if (icon) {
    const Icon = followedByMe ? Send : Plus;
    return (
      <button
        type="button"
        onClick={toggle}
        className={cn("grid cursor-pointer place-items-center", className)}
        aria-label={
          followedByMe
            ? onMessage
              ? t("feed.messageSeller")
              : t("follow.following")
            : t("follow.follow")
        }
      >
        <span
          className={cn(
            "grid size-10 place-items-center rounded-full border-2 border-white transition hover:scale-105 active:scale-95 sm:size-12",
            followedByMe ? "bg-[#FF4D8D] text-white" : "bg-[#FF453A] text-white",
          )}
        >
          <Icon className="size-5" strokeWidth={2.4} />
        </span>
        <span className="mt-0.5 text-[10px] font-bold text-white drop-shadow">
          {compactCount(Math.max(0, count), locale)}
        </span>
      </button>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold backdrop-blur transition",
          followedByMe
            ? "border border-white/25 bg-white/15 text-white"
            : "bg-primary text-white",
          className,
        )}
      >
        {followedByMe ? t("follow.following") : t("follow.follow")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex h-9 items-center rounded-full px-3.5 text-xs font-bold transition",
        followedByMe
          ? "border border-border bg-muted/50 text-foreground"
          : "bg-primary text-primary-foreground",
        className,
      )}
    >
      {followedByMe ? t("follow.subscribed") : t("follow.subscribe")}
    </button>
  );
}
