import { CATEGORIES } from "@/lib/categories";

export const BASE_CATEGORIES = CATEGORIES.map((item) => item.id);

export type CatalogStyle = {
  style: string;
  soundQuery: string;
  modelId: string;
};

const STYLE_BY_CATEGORY: Record<string, CatalogStyle> = {
  Mode: { style: "mode", soundQuery: "afro pop", modelId: "defile" },
  Beauté: { style: "beaute", soundQuery: "rnb chill", modelId: "gros-plan" },
  Coiffure: { style: "beaute", soundQuery: "rnb chill", modelId: "gros-plan" },
  Tech: { style: "tech", soundQuery: "electronic", modelId: "vitrine" },
  Gaming: { style: "tech", soundQuery: "electronic", modelId: "story" },
  Aliment: { style: "aliment", soundQuery: "soul", modelId: "ambiance" },
  Maison: { style: "maison", soundQuery: "jazz", modelId: "ambiance" },
  Auto: { style: "auto", soundQuery: "cinematic", modelId: "defile" },
  Livres: { style: "maison", soundQuery: "jazz", modelId: "vitrine" },
  Sport: { style: "sport", soundQuery: "hip hop", modelId: "story" },
};

const LABEL_CATEGORY: { category: string; words: string[] }[] = [
  {
    category: "Beauté",
    words: [
      "cosmetic",
      "makeup",
      "lipstick",
      "perfume",
      "fragrance",
      "lotion",
      "skincare",
      "mascara",
      "nail polish",
      "beauty",
    ],
  },
  {
    category: "Coiffure",
    words: ["hair", "hairstyle", "wig", "barber", "salon"],
  },
  {
    category: "Mode",
    words: [
      "clothing",
      "apparel",
      "dress",
      "shirt",
      "pants",
      "jeans",
      "skirt",
      "jacket",
      "coat",
      "shoe",
      "sneaker",
      "boot",
      "handbag",
      "purse",
      "bag",
      "backpack",
      "hat",
      "sunglass",
      "fashion",
      "jewelry",
      "watch",
      "wallet",
      "luggage",
      "scarf",
    ],
  },
  {
    category: "Aliment",
    words: [
      "food",
      "meal",
      "dish",
      "fruit",
      "vegetable",
      "dessert",
      "beverage",
      "snack",
      "bread",
      "cake",
      "coffee",
    ],
  },
  {
    category: "Tech",
    words: [
      "phone",
      "laptop",
      "computer",
      "electronics",
      "headphone",
      "camera",
      "tablet",
      "monitor",
      "keyboard",
      "television",
    ],
  },
  { category: "Gaming", words: ["video game", "game controller", "joystick"] },
  {
    category: "Maison",
    words: [
      "furniture",
      "couch",
      "sofa",
      "chair",
      "lamp",
      "bed",
      "kitchen",
      "interior",
      "home decor",
      "plant",
      "flower",
      "vase",
    ],
  },
  {
    category: "Auto",
    words: ["car", "automobile", "vehicle", "motorcycle", "truck", "tire"],
  },
  { category: "Livres", words: ["book", "magazine", "novel"] },
  {
    category: "Sport",
    words: ["sport", "football", "soccer", "basketball", "gym", "fitness", "bicycle"],
  },
];

const EXTRA_LABELS: { category: string; words: string[] }[] = [
  { category: "Jouets", words: ["toy", "doll"] },
  { category: "Animaux", words: ["dog", "cat", "pet"] },
  { category: "Bébé", words: ["baby", "infant"] },
  { category: "Musique", words: ["guitar", "piano", "musical instrument"] },
];

export type PixelStats = {
  skin: number;
  pink: number;
  food: number;
  green: number;
  blue: number;
  vivid: number;
  bright: number;
  hueBins: number;
  centerSkin: number;
};

export function styleForCategory(category: string): CatalogStyle {
  return (
    STYLE_BY_CATEGORY[category] ?? {
      style: "lifestyle",
      soundQuery: "pop",
      modelId: "vitrine",
    }
  );
}

export function categoryFromLabel(name: string) {
  const text = name.trim().toLowerCase();
  if (!text) return null;
  for (const row of LABEL_CATEGORY) {
    if (row.words.some((word) => text.includes(word))) return row.category;
  }
  for (const row of EXTRA_LABELS) {
    if (row.words.some((word) => text.includes(word))) return row.category;
  }
  return null;
}

export function categoryFromPixels(stats: PixelStats) {
  if (stats.pink > 0.1 || (stats.skin > 0.2 && stats.pink > 0.04)) return "Beauté";
  if (stats.centerSkin > 0.42 && stats.skin > 0.3) return "Coiffure";
  if (stats.food > 0.26 && stats.vivid > 0.32) return "Aliment";
  if (stats.green > 0.32) return "Maison";
  if (stats.blue > 0.36 && stats.bright < 0.62) return "Tech";
  if (stats.hueBins >= 4 && stats.vivid > 0.2) return "Mode";
  return "Mode";
}

export function isKnownCategory(category: string, extras: string[] = []) {
  const key = category.trim().toLowerCase();
  return [...BASE_CATEGORIES, ...extras].some(
    (item) => item.trim().toLowerCase() === key,
  );
}

export function cleanCategoryName(raw: string) {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 24);
  if (name.length < 2) return null;
  if (!/^[\p{L}0-9][\p{L}0-9 '&+-]*$/u.test(name)) return null;
  return name;
}
