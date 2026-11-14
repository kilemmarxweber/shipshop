"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ShopSocialDraft = {
  tiktok: string;
  facebook: string;
  instagram: string;
  x: string;
};

export const EMPTY_SOCIAL_DRAFT: ShopSocialDraft = {
  tiktok: "",
  facebook: "",
  instagram: "",
  x: "",
};

export function socialDraftFromUrls(urls?: {
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
}): ShopSocialDraft {
  return {
    tiktok: urls?.tiktokUrl?.trim() ?? "",
    facebook: urls?.facebookUrl?.trim() ?? "",
    instagram: urls?.instagramUrl?.trim() ?? "",
    x: urls?.xUrl?.trim() ?? "",
  };
}

export function socialPayloadFromDraft(draft: ShopSocialDraft) {
  return {
    tiktokUrl: draft.tiktok.trim() || null,
    facebookUrl: draft.facebook.trim() || null,
    instagramUrl: draft.instagram.trim() || null,
    xUrl: draft.x.trim() || null,
  };
}

const FIELDS = [
  ["tiktok", "TikTok — @compte ou lien"],
  ["instagram", "Instagram — @compte ou lien"],
  ["facebook", "Facebook — page ou lien"],
  ["x", "X — @compte ou lien"],
] as const;

export function ShopSocialFields({
  value,
  onChange,
  idPrefix = "social",
}: {
  value: ShopSocialDraft;
  onChange: (next: ShopSocialDraft) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>Réseaux sociaux (optionnel)</Label>
      <p className="text-[11px] text-muted-foreground">
        Contact boutique — @handle ou lien complet.
      </p>
      {FIELDS.map(([key, placeholder]) => (
        <Input
          key={key}
          id={`${idPrefix}-${key}`}
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          className="h-10 bg-surface-2"
        />
      ))}
    </div>
  );
}
