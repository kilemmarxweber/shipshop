import { requirePlatformSession, ticketHttp } from "@/lib/tickets/auth";
import { checkInTicket } from "@/lib/tickets/ledger";
import { TICKET_QR_PREFIX, verifyTicketQrPayload } from "@/lib/tickets/qr";
import { NextResponse } from "next/server";
import { z } from "zod";

const hits = new Map<string, { n: number; at: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || now - row.at > 10_000) {
    hits.set(key, { n: 1, at: now });
    return true;
  }
  if (row.n >= 30) return false;
  row.n += 1;
  return true;
}

const schema = z.object({ payload: z.string().min(8).max(400) });

export async function POST(req: Request) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  if (!rateLimit(auth.session.user.id)) {
    return NextResponse.json({ error: "Trop de scans" }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "QR manquant" }, { status: 400 });
  }
  const raw = parsed.data.payload.trim();
  if (raw.startsWith("CHIPSHOP")) {
    return NextResponse.json(
      { error: "QR de remise commande — pas un billet" },
      { status: 400 },
    );
  }
  if (!raw.startsWith(TICKET_QR_PREFIX)) {
    return NextResponse.json({ error: "QR inconnu" }, { status: 400 });
  }
  const verified = verifyTicketQrPayload(raw);
  if (!verified) {
    return NextResponse.json(
      { error: "QR invalide ou falsifié" },
      { status: 400 },
    );
  }
  try {
    const result = await checkInTicket({
      payload: raw,
      actorUserId: auth.session.user.id,
      parsed: verified,
    });
    return NextResponse.json(result);
  } catch (error) {
    return ticketHttp(error);
  }
}
