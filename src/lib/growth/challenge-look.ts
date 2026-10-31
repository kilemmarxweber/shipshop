import type { UserLocale } from "@/lib/user-locale";

type MoodCopy = Record<UserLocale, string>;

export const CATEGORY_LOOK: Record<
  string,
  { mood: MoodCopy; wash: string }
> = {
  Beauté: {
    mood: {
      fr: "Beauté & Bien-être",
      en: "Beauty & Wellness",
      pt: "Beleza & Bem-estar",
    },
    wash: "from-[#f6d7c8] via-[#f3c8b6] to-[#efb8a4]",
  },
  Mode: {
    mood: {
      fr: "Mode & Style",
      en: "Fashion & Style",
      pt: "Moda & Estilo",
    },
    wash: "from-[#1d4ed8] via-[#2563eb] to-[#93c5fd]",
  },
  Tech: {
    mood: {
      fr: "Tech & Gadgets",
      en: "Tech & Gadgets",
      pt: "Tech & Gadgets",
    },
    wash: "from-[#312e81] via-[#6d28d9] to-[#a78bfa]",
  },
  Maison: {
    mood: {
      fr: "Maison & Déco",
      en: "Home & Decor",
      pt: "Casa & Decoração",
    },
    wash: "from-[#065f46] via-[#0d9488] to-[#5eead4]",
  },
  Sport: {
    mood: {
      fr: "Sport & Mouvement",
      en: "Sport & Motion",
      pt: "Desporto & Movimento",
    },
    wash: "from-[#14532d] via-[#16a34a] to-[#bef264]",
  },
  Gaming: {
    mood: {
      fr: "Gaming & Play",
      en: "Gaming & Play",
      pt: "Gaming & Play",
    },
    wash: "from-[#7f1d1d] via-[#7c3aed] to-[#c084fc]",
  },
  Auto: {
    mood: {
      fr: "Auto & Mobilité",
      en: "Auto & Mobility",
      pt: "Auto & Mobilidade",
    },
    wash: "from-[#334155] via-[#64748b] to-[#cbd5e1]",
  },
  Livres: {
    mood: {
      fr: "Livres & Culture",
      en: "Books & Culture",
      pt: "Livros & Cultura",
    },
    wash: "from-[#92400e] via-[#f59e0b] to-[#fde68a]",
  },
};

const FALLBACK_LOOK = {
  mood: {
    fr: "Lifestyle",
    en: "Lifestyle",
    pt: "Lifestyle",
  } satisfies MoodCopy,
  wash: "from-[#2a1830] via-[#5b2a4a] to-[#f3c6b5]",
};

export function categoryLook(category?: string | null) {
  if (!category) return FALLBACK_LOOK;
  return CATEGORY_LOOK[category] ?? FALLBACK_LOOK;
}

export function categoryMood(
  category: string | null | undefined,
  locale: UserLocale,
) {
  return categoryLook(category).mood[locale];
}

/** Compteurs type TikTok : 9999 → 9999, 10000 → 10.0K, 1e6 → 1.0M, 1e9 → 1.0B. */
export function compactCount(value: number, _locale?: UserLocale) {
  const n = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  if (n < 10_000) return String(n);
  const format = (div: number, suffix: "K" | "M" | "B") =>
    `${(Math.floor(n / div) / 10).toFixed(1)}${suffix}`;
  if (n < 1_000_000) return format(100, "K");
  if (n < 1_000_000_000) return format(100_000, "M");
  return format(100_000_000, "B");
}

export function firstVisualUrl(images: string[]) {
  const still = images.find((url) => !isProbablyVideo(url));
  if (still) return still;
  const video = images.find(isProbablyVideo);
  return video ? video.replace(/\.(mp4|webm|mov|m4v|mkv)(\?|$)/i, ".jpg$2") : null;
}

export function isProbablyVideo(url: string) {
  return /\.(mp4|webm|mov|m4v|mkv|avi|3gp)(\?|$)/i.test(url);
}
