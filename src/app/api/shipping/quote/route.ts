import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { quoteShipping } from "@/lib/shipping";

const schema = z.object({
  shopId: z.string().min(1),
  city: z.string().min(1).optional().nullable(),
  commune: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});

export async function GET() {
  const zones = await withDbRetry(() =>
    prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: [{ kind: "asc" }, { commune: "asc" }],
    }),
  );
  return NextResponse.json({ zones });
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const quote = await quoteShipping(body);
    return NextResponse.json({ quote });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Devis transport impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
