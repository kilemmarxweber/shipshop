import { defineField, defineType } from "sanity";

export const appConfigType = defineType({
  name: "appConfig",
  title: "Réglages ShipShop",
  type: "document",
  fields: [
    defineField({
      name: "montage",
      title: "Montage",
      type: "object",
      fields: [
        defineField({
          name: "clipSeconds",
          title: "Durée de l’extrait (secondes)",
          type: "number",
          initialValue: 60,
          validation: (Rule) => Rule.min(5).max(120),
        }),
        defineField({
          name: "maxImages",
          title: "Images max par annonce",
          type: "number",
          initialValue: 12,
          validation: (Rule) => Rule.min(1).max(12),
        }),
        defineField({
          name: "motions",
          title: "Animations",
          type: "array",
          of: [{ type: "string" }],
          options: {
            list: [
              { title: "Zoom avant", value: "zoom-in" },
              { title: "Zoom arrière", value: "zoom-out" },
              { title: "Travelling gauche", value: "pan-left" },
              { title: "Travelling droit", value: "pan-right" },
              { title: "Travelling haut", value: "pan-up" },
            ],
          },
          initialValue: [
            "zoom-in",
            "zoom-out",
            "pan-left",
            "pan-right",
            "pan-up",
          ],
        }),
      ],
    }),
    defineField({
      name: "nsfw",
      title: "NSFW",
      type: "object",
      fields: [
        defineField({
          name: "forbidden",
          title: "Pornographie interdite",
          type: "boolean",
          initialValue: true,
          readOnly: true,
        }),
        defineField({
          name: "blockedLabels",
          title: "Libellés bloqués (en plus du scan)",
          type: "array",
          of: [{ type: "string" }],
        }),
        defineField({
          name: "rejectFr",
          title: "Message de refus (FR)",
          type: "string",
          initialValue: "Contenu pornographique interdit sur ShipShop",
        }),
        defineField({
          name: "rejectEn",
          title: "Reject message (EN)",
          type: "string",
          initialValue: "Pornographic content is forbidden on ShipShop",
        }),
        defineField({
          name: "rejectPt",
          title: "Mensagem de recusa (PT)",
          type: "string",
          initialValue: "Conteúdo pornográfico é proibido no ShipShop",
        }),
      ],
    }),
    defineField({
      name: "experimentId",
      title: "Expérience de contenu (optionnel)",
      type: "string",
    }),
  ],
  preview: {
    prepare: () => ({ title: "Réglages ShipShop" }),
  },
});
