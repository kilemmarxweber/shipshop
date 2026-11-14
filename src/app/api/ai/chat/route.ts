import { assistShipShop } from "@/lib/ai/assist-shipshop";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

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

  try {
    const result = await assistShipShop(body.message, {
      userId: session.user?.id ?? null,
      take: 6,
    });

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
      links: result.links,
      provider: result.provider,
    });
  } catch (cause) {
    console.error("[api/ai/chat]", cause);
    return NextResponse.json(
      {
        error: "Assistant indisponible",
        reply:
          "Je n’ai pas pu interroger le catalogue. Réessayez, ou ouvrez Découvrir.",
        products: [],
        links: [
          {
            id: "discover",
            kind: "route",
            title: "Découvrir",
            href: "/(tabs)/boutique",
          },
        ],
      },
      { status: 500 },
    );
  }
}
