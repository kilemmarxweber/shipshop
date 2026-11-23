import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import {
  clampFeeBps,
  DEFAULT_FEE_SETTINGS,
  ensurePlatformFeeSettings,
  getPlatformFeeSettings,
  invalidatePlatformFeeSettingsCache,
  publicFeeSettings,
} from "@/lib/platform-fees";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const bps = z.number().int().min(0).max(5000);

const patchSchema = z.object({
  depositFeeBps: bps.optional(),
  depositCinetPayBps: bps.optional(),
  withdrawFeeBps: bps.optional(),
  withdrawCinetPayBps: bps.optional(),
  transferExternalFeeBps: bps.optional(),
  transferExternalCinetPayBps: bps.optional(),
  transferInternalFeeBps: bps.optional(),
  saleFeeBpsDefault: bps.optional(),
  shippingFeeBps: bps.optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé au owner" }, { status: 403 });
  }

  const settings = await getPlatformFeeSettings();
  return NextResponse.json({
    settings: publicFeeSettings(settings),
    defaults: publicFeeSettings(DEFAULT_FEE_SETTINGS),
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé au owner" }, { status: 403 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  await ensurePlatformFeeSettings();
  const data: Record<string, number> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value == null) continue;
    data[key] = clampFeeBps(value, 0);
  }
  if (Object.keys(data).length === 0) {
    const settings = await getPlatformFeeSettings();
    return NextResponse.json({ settings: publicFeeSettings(settings) });
  }

  const updated = await withDbRetry(() =>
    prisma.platformFeeSettings.update({
      where: { id: "default" },
      data,
    }),
  );
  invalidatePlatformFeeSettingsCache();

  return NextResponse.json({
    settings: publicFeeSettings(updated),
    ok: true,
  });
}
