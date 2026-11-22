import { BASE_CATEGORIES } from "@/lib/catalog-category";
import { readExtraCategories } from "@/lib/catalog-vision.server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const extras = await readExtraCategories();
  let fromProducts: string[] = [];
  try {
    const rows = await withDbRetry(() =>
      prisma.product.groupBy({
        by: ["category"],
        where: { category: { not: "" } },
      }),
    );
    fromProducts = rows.map((row) => row.category);
  } catch {
    fromProducts = [];
  }
  const categories: string[] = [];
  for (const name of [...BASE_CATEGORIES, ...extras, ...fromProducts]) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    if (categories.some((item) => item.toLowerCase() === trimmed.toLowerCase())) continue;
    categories.push(trimmed);
  }
  return NextResponse.json({ categories });
}
