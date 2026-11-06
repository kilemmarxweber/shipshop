export type ProductImageCategoryHint =
  | "robes"
  | "hauts"
  | "chaussures"
  | "sacs"
  | "bijoux"
  | "divers";

const CATEGORY_RATIO: Record<
  ProductImageCategoryHint,
  { label: string; target: number; alt?: number }
> = {
  robes: { label: "2:3", target: 2 / 3 },
  hauts: { label: "4:5", target: 4 / 5 },
  chaussures: { label: "1:1 ou 4:5", target: 1, alt: 4 / 5 },
  sacs: { label: "1:1", target: 1 },
  bijoux: { label: "1:1", target: 1 },
  divers: { label: "4:5", target: 4 / 5 },
};

const MIN_SHORT_SIDE = 1200;

export function hintFromSellCategory(category: string): ProductImageCategoryHint {
  const key = category.trim().toLowerCase();
  if (/robe|jupe|pantalon|long/.test(key)) return "robes";
  if (/chemise|haut|t-?shirt|top|veste|tech|mode/.test(key)) return "hauts";
  if (/chaussure|basket|talon|botte/.test(key)) return "chaussures";
  if (/sac|accessoire/.test(key)) return "sacs";
  if (/bijou|montre|collier/.test(key)) return "bijoux";
  return "divers";
}

export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "—";
  if (Math.abs(ratio - 1) < 0.04) return "1:1";
  if (Math.abs(ratio - 4 / 5) < 0.05) return "4:5";
  if (Math.abs(ratio - 2 / 3) < 0.05) return "2:3";
  if (Math.abs(ratio - 3 / 4) < 0.05) return "3:4";
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (ratio > 1) return `${ratio.toFixed(2)}:1`;
  return `1:${(1 / ratio).toFixed(2)}`;
}

export function recommendedRatioLabel(category: string): string {
  return CATEGORY_RATIO[hintFromSellCategory(category)].label;
}

export type ImageProbe = {
  width: number;
  height: number;
  ratio: number;
  warning?: string;
  tip: string;
};

export function probeImageFile(
  file: File,
  category?: string,
): Promise<ImageProbe> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const ratio = width / Math.max(1, height);
      const shortSide = Math.min(width, height);
      const hint = hintFromSellCategory(category ?? "divers");
      const reco = CATEGORY_RATIO[hint];
      let warning: string | undefined;
      if (shortSide > 0 && shortSide < MIN_SHORT_SIDE) {
        warning = `Résolution basse (${width}×${height}). Idéal ≥ ${MIN_SHORT_SIDE} px sur le petit côté.`;
      }
      if (ratio > 2.4 || ratio < 0.35) {
        warning = warning
          ? `${warning} Format inhabituel.`
          : "Format inhabituel — la fiche affichera toute l’image (contain).";
      }
      const closest = Math.min(
        Math.abs(ratio - reco.target),
        reco.alt != null ? Math.abs(ratio - reco.alt) : Infinity,
      );
      const tip =
        closest > 0.12
          ? `Conseil ${hint}: ~${reco.label} (ta photo ${formatRatio(ratio)}). Aucune obligation — contain par défaut.`
          : `Ratio ${formatRatio(ratio)} OK · conseil ${reco.label}.`;
      resolve({ width, height, ratio, warning, tip });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Lecture image impossible"));
    };
    img.src = url;
  });
}

export function probeImageUrl(
  src: string,
  category?: string,
): Promise<ImageProbe> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const ratio = width / Math.max(1, height);
      const hint = hintFromSellCategory(category ?? "divers");
      const reco = CATEGORY_RATIO[hint];
      const shortSide = Math.min(width, height);
      let warning: string | undefined;
      if (shortSide > 0 && shortSide < MIN_SHORT_SIDE) {
        warning = `Résolution basse (${width}×${height}).`;
      }
      const tip = `Ratio ${formatRatio(ratio)} · conseil ${reco.label} · fiche en contain`;
      resolve({ width, height, ratio, warning, tip });
    };
    img.onerror = () => reject(new Error("Lecture image impossible"));
    img.src = src;
  });
}
