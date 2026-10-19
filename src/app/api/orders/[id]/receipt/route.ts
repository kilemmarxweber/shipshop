import { NextResponse } from "next/server";
import { qrImageUrl } from "@/lib/handover";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Reçu client = QR à présenter (pas les détails complets).
 * Le vendeur / livreur scanne pour valider la remise.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const order = await withDbRetry(() =>
    prisma.order.findUnique({
      where: { id },
      include: {
        pickupReceipt: true,
        handover: true,
        product: { select: { title: true } },
        shop: { select: { name: true, organizationId: true } },
      },
    }),
  );

  if (!order || !order.pickupReceipt) {
    return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });
  }

  const isBuyer = order.buyerId === session.user.id;
  const member = await withDbRetry(() =>
    prisma.member.findFirst({
      where: {
        userId: session.user.id,
        organizationId: order.shop.organizationId,
      },
    }),
  );
  if (!isBuyer && !member) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const qrPayload = order.handover?.qrPayload ?? order.pickupReceipt.qrPayload;
  const qr = qrImageUrl(qrPayload, 280);
  const redeemed = Boolean(order.pickupReceipt.redeemedAt);
  const mode =
    order.fulfillmentType === "PICKUP" ? "Retrait boutique" : "Livraison";

  // Client : QR only. Vendeur : QR + code pour saisie manuelle.
  const showCode = Boolean(member);

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>QR remise Chip Shop</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#fff;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:100%;max-width:380px;background:#13131a;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:28px 24px;text-align:center}
  h1{font-size:18px;margin:0 0 4px}
  .muted{color:#9ca3af;font-size:12px;margin:0 0 20px;line-height:1.4}
  .qr{background:#fff;border-radius:16px;padding:16px;display:inline-block}
  .qr img{display:block;width:240px;height:240px}
  .badge{display:inline-block;margin-top:16px;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700}
  .ok{background:rgba(0,214,143,.15);color:#00d68f}
  .wait{background:rgba(255,87,34,.15);color:#ff7a45}
  .hint{margin-top:18px;font-size:11px;color:#6b7280}
  .code{margin-top:14px;font-size:22px;font-weight:800;letter-spacing:3px;color:#ff7a45;font-family:ui-monospace,monospace}
</style></head><body>
  <div class="card">
    <h1>Chip Shop — QR de remise</h1>
    <p class="muted">${mode} · ${order.shop.name}<br/>Présentez ce QR au vendeur ou au livreur.<br/>Les détails restent masqués jusqu'au scan.</p>
    <div class="qr"><img src="${qr}" alt="QR remise" width="240" height="240"/></div>
    ${
      showCode
        ? `<div class="code">${order.handover?.code ?? order.pickupReceipt.code}</div><p class="hint">Code boutique (vendeur)</p>`
        : `<p class="hint">Ne partagez ce QR qu'au moment de la remise</p>`
    }
    <div class="badge ${redeemed ? "ok" : "wait"}">
      ${redeemed ? "Remise déjà confirmée" : "En attente de scan / validation"}
    </div>
  </div>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
