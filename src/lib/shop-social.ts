import { z } from "zod";

export const SOCIAL_KINDS = [
  "tiktok",
  "facebook",
  "instagram",
  "x",
] as const;

export type SocialKind = (typeof SOCIAL_KINDS)[number];

const HOSTS: Record<SocialKind, string[]> = {
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
};

const PROFILE_URL: Record<SocialKind, (handle: string) => string> = {
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  facebook: (h) => `https://www.facebook.com/${h}`,
  instagram: (h) => `https://www.instagram.com/${h}`,
  x: (h) => `https://x.com/${h}`,
};

function stripHandle(raw: string) {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split(/[?#]/)[0]
    ?.trim() ?? "";
}

function hostOf(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function hostAllowed(kind: SocialKind, hostname: string) {
  const bare = hostname.toLowerCase().replace(/^www\./, "");
  return HOSTS[kind].some((h) => h.replace(/^www\./, "") === bare);
}

/** Accepte @handle, handle, ou URL complète → URL de profil normalisée. */
export function normalizeSocialLink(
  kind: SocialKind,
  value: string | null | undefined,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    try {
      const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
      if (!hostAllowed(kind, url.hostname)) return null;
      const path = stripHandle(url.pathname);
      if (!path || path === "/") {
        // Keep full URL for short links (vm.tiktok) etc.
        return url.toString();
      }
      const handle = path.replace(/^@/, "").split("/")[0] ?? "";
      if (!handle) return url.toString();
      return PROFILE_URL[kind](handle);
    } catch {
      return null;
    }
  }

  const handle = stripHandle(raw);
  if (!handle || handle.includes(" ")) return null;
  if (handle.length > 80) return null;
  return PROFILE_URL[kind](handle);
}

const socialField = z
  .string()
  .max(220)
  .optional()
  .nullable()
  .or(z.literal(""));

export const shopSocialBodySchema = z.object({
  tiktokUrl: socialField,
  facebookUrl: socialField,
  instagramUrl: socialField,
  xUrl: socialField,
});

export type ShopSocialBody = z.infer<typeof shopSocialBodySchema>;

export function normalizeShopSocials(body: ShopSocialBody) {
  return {
    tiktokUrl: normalizeSocialLink("tiktok", body.tiktokUrl || null),
    facebookUrl: normalizeSocialLink("facebook", body.facebookUrl || null),
    instagramUrl: normalizeSocialLink("instagram", body.instagramUrl || null),
    xUrl: normalizeSocialLink("x", body.xUrl || null),
  };
}

export const SHOP_SOCIAL_SELECT = {
  tiktokUrl: true,
  facebookUrl: true,
  instagramUrl: true,
  xUrl: true,
} as const;
