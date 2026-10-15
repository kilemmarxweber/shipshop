export const PRESET_COLORS = [
  { name: "Noir", hex: "#111111" },
  { name: "Blanc", hex: "#f5f5f5" },
  { name: "Rouge", hex: "#ef4444" },
  { name: "Bleu", hex: "#3b82f6" },
  { name: "Vert", hex: "#22c55e" },
  { name: "Or", hex: "#f59e0b" },
  { name: "Argent", hex: "#94a3b8" },
  { name: "Rose", hex: "#ec4899" },
] as const;

export const PRESET_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "Unique",
] as const;

export function colorHex(name: string) {
  return PRESET_COLORS.find((c) => c.name === name)?.hex ?? name;
}
