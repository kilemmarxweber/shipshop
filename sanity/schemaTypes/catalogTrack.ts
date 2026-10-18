import { defineField, defineType } from "sanity";

export const catalogTrackType = defineType({
  name: "catalogTrack",
  title: "Son catalogue",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titre",
      type: "string",
      validation: (Rule) => Rule.required().min(2).max(80),
    }),
    defineField({
      name: "artist",
      title: "Artiste",
      type: "string",
      initialValue: "ShipShop",
    }),
    defineField({
      name: "mood",
      title: "Ambiance",
      type: "string",
    }),
    defineField({
      name: "durationMs",
      title: "Durée (ms)",
      type: "number",
    }),
    defineField({
      name: "audio",
      title: "Fichier audio",
      type: "file",
      options: { accept: "audio/*" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "isActive",
      title: "Actif",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "artist" },
  },
});
