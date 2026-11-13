import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestCisEvents } from "@/lib/cis/events";
import { getSession } from "@/lib/session";

const eventSchema = z.object({
  clientEventId: z.string().min(8).max(80),
  type: z.string().min(1).max(64),
  productId: z.string().min(1).max(64).nullable().optional(),
  shopId: z.string().min(1).max(64).nullable().optional(),
  category: z.string().min(1).max(120).nullable().optional(),
  query: z.string().max(200).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  occurredAt: z.union([z.string(), z.number()]).nullable().optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
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
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const result = await ingestCisEvents(session.user.id, body.events);
  if (!result.accepted) {
    return NextResponse.json(
      {
        error: "Consentement CIS requis",
        code: result.reason,
        inserted: 0,
        duplicates: 0,
        rejected: result.rejected,
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    duplicates: result.duplicates,
    rejected: result.rejected,
  });
}
