export const USER_LOCALE_VALUES = ["fr", "en", "pt"] as const;

export type UserLocale = (typeof USER_LOCALE_VALUES)[number];

export const USER_LOCALE_COOKIE = "chipshop-locale";

export const LOCALE_OPTIONS = [
  { value: "fr", label: "Français", nativeLabel: "Français" },
  { value: "en", label: "English", nativeLabel: "English" },
  {
    value: "pt",
    label: "Português (Portugal)",
    nativeLabel: "Português (Portugal)",
  },
] as const;

export function isUserLocale(value: unknown): value is UserLocale {
  return (
    typeof value === "string" &&
    (USER_LOCALE_VALUES as readonly string[]).includes(value)
  );
}

export function normalizeUserLocale(value: unknown): UserLocale {
  if (typeof value !== "string") return "fr";
  const base = value.trim().toLowerCase().split("-")[0];
  if (base === "pt") return "pt";
  if (base === "en") return "en";
  if (base === "fr") return "fr";
  return "fr";
}

export function intlLocaleFromUserLocale(locale: UserLocale): string {
  if (locale === "en") return "en-GB";
  if (locale === "pt") return "pt-PT";
  return "fr-FR";
}

export function userLocaleStorageKey(userId: string) {
  return `chipshop-locale-${userId}`;
}

export function readLocaleFromDocumentCookie(): UserLocale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${USER_LOCALE_COOKIE}=`));
  if (!match) return null;
  return normalizeUserLocale(decodeURIComponent(match.split("=")[1] ?? ""));
}

export function writeLocaleCookie(locale: UserLocale) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${USER_LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function readUserLocalePreference(userId?: string | null): UserLocale {
  if (typeof window === "undefined") return "fr";
  if (userId) {
    const scoped = localStorage.getItem(userLocaleStorageKey(userId));
    if (isUserLocale(scoped)) return scoped;
  }
  const cookie = readLocaleFromDocumentCookie();
  if (cookie) return cookie;
  return "fr";
}

export function writeUserLocalePreference(
  locale: UserLocale,
  userId?: string | null,
) {
  writeLocaleCookie(locale);
  if (typeof window === "undefined") return;
  if (userId) {
    localStorage.setItem(userLocaleStorageKey(userId), locale);
  }
}
