import { defineField, defineType } from "sanity";

export const seoDefaultsType = defineType({
  name: "seoDefaults",
  title: "SEO / AEO",
  type: "document",
  fields: [
    defineField({
      name: "titleTemplate",
      title: "Modèle de titre",
      type: "string",
      initialValue: "ShipShop — Marketplace de confiance",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      initialValue:
        "Achetez et vendez en sécurité avec portefeuille Mobile Money prépayé.",
    }),
    defineField({
      name: "faq",
      title: "FAQ courte (AEO)",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "question", type: "string", title: "Question" }),
            defineField({ name: "answer", type: "text", title: "Réponse" }),
          ],
        },
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "SEO / AEO" }),
  },
});
