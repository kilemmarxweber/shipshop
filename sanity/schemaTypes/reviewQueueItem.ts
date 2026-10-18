import { defineField, defineType } from "sanity";

export const reviewQueueItemType = defineType({
  name: "reviewQueueItem",
  title: "Média à revoir",
  type: "document",
  fields: [
    defineField({
      name: "productId",
      title: "Id produit Prisma",
      type: "string",
    }),
    defineField({
      name: "userId",
      title: "Id utilisateur Prisma",
      type: "string",
    }),
    defineField({
      name: "contentHash",
      title: "Empreinte (pas le fichier)",
      type: "string",
    }),
    defineField({
      name: "kind",
      title: "Type",
      type: "string",
    }),
    defineField({
      name: "note",
      title: "Note",
      type: "text",
    }),
    defineField({
      name: "status",
      title: "Statut",
      type: "string",
      initialValue: "pending",
      options: {
        list: [
          { title: "En attente", value: "pending" },
          { title: "Traité", value: "done" },
        ],
      },
    }),
  ],
  preview: {
    select: { title: "contentHash", subtitle: "productId" },
    prepare: ({ title, subtitle }) => ({
      title: title ? `Hash ${String(title).slice(0, 10)}…` : "À revoir",
      subtitle: subtitle ? `Produit ${subtitle}` : "Pas de fichier stocké",
    }),
  },
});
