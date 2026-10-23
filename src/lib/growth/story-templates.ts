/** Templates visuels des Stories partenaires (stockés dans BrandCampaign.category). */

export const STORY_TEMPLATES = [
  {
    id: "cover",
    label: "Couverture",
    hint: "Image plein cadre + titre en bas",
  },
  {
    id: "quote",
    label: "Citation",
    hint: "Texte central sur fond image flou",
  },
  {
    id: "split",
    label: "Image + texte",
    hint: "Photo en haut, bloc texte en bas",
  },
  {
    id: "product",
    label: "Produit",
    hint: "Visuel + titre + accroche CTA",
  },
] as const;

export type StoryTemplateId = (typeof STORY_TEMPLATES)[number]["id"];

export function isStoryTemplateId(value: string | null | undefined): value is StoryTemplateId {
  return STORY_TEMPLATES.some((t) => t.id === value);
}

export function normalizeStoryTemplate(
  value: string | null | undefined,
): StoryTemplateId {
  return isStoryTemplateId(value) ? value : "cover";
}
