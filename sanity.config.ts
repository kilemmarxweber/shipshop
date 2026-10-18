"use client";

import { visionTool } from "@sanity/vision";
import { buildLegacyTheme, defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { media } from "sanity-plugin-media";
import { deskStructure } from "./sanity/desk";
import { schemaTypes, singletonTypes } from "./sanity/schemaTypes";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "unset";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

const shipshopTheme = buildLegacyTheme({
  "--black": "#0b1220",
  "--white": "#ffffff",
  "--gray": "#8b95a7",
  "--gray-base": "#8b95a7",
  "--brand-primary": "#ff5722",
  "--main-navigation-color": "#0b1220",
  "--main-navigation-color--inverted": "#ffffff",
  "--focus-color": "#00d68f",
});

export default defineConfig({
  name: "shipshop",
  title: "ShipShop",
  projectId,
  dataset,
  basePath: "/studio",
  theme: shipshopTheme,
  plugins: [
    structureTool({ structure: deskStructure }),
    visionTool(),
    media(),
  ],
  schema: {
    types: schemaTypes,
    templates: (templates) =>
      templates.filter((template) => !singletonTypes.has(template.schemaType)),
  },
  document: {
    actions: (prev, context) =>
      singletonTypes.has(context.schemaType)
        ? prev.filter(
            ({ action }) => action !== "delete" && action !== "duplicate",
          )
        : prev,
  },
});
