import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { assertChipShopOwner } from "@/lib/kyc";
import {
  passwordResetMessage,
  sendDirectEmail,
  sendDirectSms,
  sendDirectWhatsapp,
} from "@/lib/messaging/direct";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function generatePassword(length = 12) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Owner plateforme : reset MDP + envoi e-mail + WhatsApp (SMS en secours). */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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

  const { id: userId } = await ctx.params;

  try {
    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      }),
    );
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const temporaryPassword = generatePassword(12);
    const hashed = await hashPassword(temporaryPassword);

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const account = await tx.account.findFirst({
          where: {
            userId: user.id,
            providerId: "credential",
          },
        });
        if (account) {
          await tx.account.update({
            where: { id: account.id },
            data: { password: hashed },
          });
        } else {
          await tx.account.create({
            data: {
              userId: user.id,
              accountId: user.id,
              providerId: "credential",
              password: hashed,
            },
          });
        }
        // Force reconnexion
        await tx.session.deleteMany({ where: { userId: user.id } });
      }),
    );

    const body = passwordResetMessage({
      name: user.name,
      email: user.email,
      password: temporaryPassword,
    });

    const channels: {
      email?: { ok: boolean; provider?: string; error?: string };
      whatsapp?: { ok: boolean; provider?: string; error?: string };
      sms?: { ok: boolean; provider?: string; error?: string };
    } = {};

    try {
      const emailResult = await sendDirectEmail({
        to: user.email,
        subject: `${process.env.NEXT_PUBLIC_APP_NAME || "ShipShop"} — nouveau mot de passe`,
        text: body,
      });
      channels.email = { ok: true, provider: emailResult.provider };
    } catch (err) {
      channels.email = {
        ok: false,
        error: err instanceof Error ? err.message : "Échec e-mail",
      };
    }

    if (user.phone?.trim()) {
      try {
        const wa = await sendDirectWhatsapp(user.phone, body);
        channels.whatsapp = { ok: true, provider: wa.provider };
      } catch (waErr) {
        channels.whatsapp = {
          ok: false,
          error: waErr instanceof Error ? waErr.message : "Échec WhatsApp",
        };
        try {
          const sms = await sendDirectSms(user.phone, body);
          channels.sms = { ok: true, provider: sms.provider };
        } catch (smsErr) {
          channels.sms = {
            ok: false,
            error: smsErr instanceof Error ? smsErr.message : "Échec SMS",
          };
        }
      }
    } else {
      channels.whatsapp = {
        ok: false,
        error: "Aucun téléphone sur le profil",
      };
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      temporaryPassword,
      channels,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Reset impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
