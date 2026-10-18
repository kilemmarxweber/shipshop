import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { RAIL_PROVIDERS, type RailProvider } from "@/lib/payments/provider";

const putSchema = z.object({
  contacts: z
    .array(
      z.object({
        provider: z.enum(["MPESA", "ORANGE", "AIRTEL"]),
        phone: z.string(),
      }),
    )
    .max(3),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const contacts = await withDbRetry(() =>
    prisma.userMoneyContact.findMany({
      where: { userId: session.user.id },
      select: { provider: true, phone: true },
    }),
  );

  return NextResponse.json({ contacts });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = putSchema.parse(await req.json());
    const seen = new Set<RailProvider>();
    const phones = new Set<string>();
    const normalized: { provider: RailProvider; phone: string }[] = [];

    for (const row of body.contacts) {
      if (seen.has(row.provider)) {
        return NextResponse.json(
          { error: "Un seul numéro par réseau" },
          { status: 400 },
        );
      }
      seen.add(row.provider);
      if (!row.phone.trim()) continue;
      const parts = splitPhone(row.phone);
      const e164 = composePhone(parts.dial, parts.national);
      if (!e164 || !isValidContactPhone(e164)) {
        return NextResponse.json(
          { error: `Numéro invalide (${row.provider})` },
          { status: 400 },
        );
      }
      if (phones.has(e164)) {
        return NextResponse.json(
          { error: "Numéros en double" },
          { status: 400 },
        );
      }
      phones.add(e164);
      normalized.push({ provider: row.provider, phone: e164 });
    }

    for (const row of normalized) {
      const taken = await prisma.userMoneyContact.findFirst({
        where: { phone: row.phone, userId: { not: session.user.id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(
          { error: `Ce numéro est déjà lié à un autre compte (${row.provider})` },
          { status: 409 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.userMoneyContact.deleteMany({
        where: {
          userId: session.user.id,
          provider: { in: [...RAIL_PROVIDERS] },
        },
      });
      if (normalized.length) {
        await tx.userMoneyContact.createMany({
          data: normalized.map((c) => ({
            userId: session.user.id,
            provider: c.provider,
            phone: c.phone,
          })),
        });
      }
    });

    const contacts = await prisma.userMoneyContact.findMany({
      where: { userId: session.user.id },
      select: { provider: true, phone: true },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Contacts non enregistrés";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
