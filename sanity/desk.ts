import type { StructureResolver } from "sanity/structure";

export const deskStructure: StructureResolver = (S) =>
  S.list()
    .title("ShipShop")
    .items([
      S.listItem()
        .title("Réglages")
        .id("appConfig")
        .child(S.document().schemaType("appConfig").documentId("appConfig")),
      S.listItem()
        .title("SEO / AEO")
        .id("seoDefaults")
        .child(S.document().schemaType("seoDefaults").documentId("seoDefaults")),
      S.divider(),
      S.documentTypeListItem("catalogTrack").title("Sons catalogue"),
      S.documentTypeListItem("catalogMedia").title("Médias catalogue"),
      S.divider(),
      S.documentTypeListItem("legalPage").title("Pages légales"),
      S.documentTypeListItem("helpPage").title("Aide"),
      S.divider(),
      S.documentTypeListItem("reviewQueueItem").title("File à revoir"),
    ]);
