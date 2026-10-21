import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import {
  sendDirectEmail,
  sendDirectSms,
  sendDirectWhatsapp,
} from "@/lib/messaging/direct";
import { getSession } from "@/lib/session";

const schema = z.object({
  channel: z.enum(["whatsapp", "sms", "email"]),
  to: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(1200),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Réservé à l'owner ou à un admin Chip Shop" },
      { status: 403 },
    );
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Données de test invalides" },
      { status: 400 },
    );
  }

  try {
    if (body.channel === "email") {
      const sent = await sendDirectEmail({
        to: body.to,
        subject: "ShipShop — message test",
        title: "Test configuration messaging",
        text: body.message,
      });
      return NextResponse.json({ ok: true, provider: sent.provider });
    }
    if (body.channel === "sms") {
      const sent = await sendDirectSms(body.to, body.message);
      return NextResponse.json({ ok: true, provider: sent.provider });
    }
    const sent = await sendDirectWhatsapp(body.to, body.message);
    return NextResponse.json({ ok: true, provider: sent.provider });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Envoi test impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
