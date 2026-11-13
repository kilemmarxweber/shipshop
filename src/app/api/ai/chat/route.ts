import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildCatalogReply,
  searchCatalogProducts,
} from "@/lib/ai/catalog-chat";
import { getSession } from "@/lib/session";

const bodySchema = z.object({
  message: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Message invalide" }, { status: 400 });
  }

  const { products } = await searchCatalogProducts(body.message, 6);
  const result = buildCatalogReply(body.message, products);

  return NextResponse.json({
    reply: result.reply,
    products: result.products.map((p) => ({
      id: p.id,
      title: p.title,
      priceCents: p.priceCents,
      currency: p.currency,
      images: p.images,
      category: p.category,
      quantity: p.quantity,
    })),
    provider: "catalog",
  });
}
