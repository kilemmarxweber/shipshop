import { NextResponse } from "next/server";
import { z } from "zod";
import { listKinshasaCatalog, saveGeoTerms } from "@/lib/geo-catalog";
import { getSession } from "@/lib/session";

const saveSchema = z.object({
  commune: z.string().trim().min(2).max(80),
  quartier: z.string().trim().max(80).optional(),
  avenue: z.string().trim().max(80).optional(),
  lat: z.number().finite().optional().nullable(),
  lng: z.number().finite().optional().nullable(),
});

export async function GET() {
  try {
    const catalog = await listKinshasaCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    console.error("[geo/kinshasa] GET", error);
    return NextResponse.json(
      { error: "Catalogue d'adresses indisponible" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  try {
    const catalog = await saveGeoTerms(parsed.data);
    return NextResponse.json(catalog);
  } catch (error) {
    console.error("[geo/kinshasa] POST", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le lieu" },
      { status: 500 },
    );
  }
}
