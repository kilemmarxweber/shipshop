import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sendDirectEmail,
  sendDirectSms,
  sendDirectWhatsapp,
} from "@/lib/messaging/direct";
import {
  expiresAtFromNow,
  generateOtpCode,
  hashOtp,
  parseResetIdentifier,
  passwordResetIdentifier,
  PASSWORD_RESET_TTL_MINUTES,
} from "@/lib/password-reset";
import { prisma, withDbRetry } from "@/lib/prisma";

const schema = z.object({
  identifier: z.string().trim().min(3).max(120),
});

export async function POST(req: Request) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Identifiant invalide", code: "IDENTIFIER_INVALID" },
      { status: 400 },
    );
  }

  const parsed = parseResetIdentifier(body.identifier);
  if (!parsed) {
    return NextResponse.json(
      { error: "Identifiant invalide", code: "IDENTIFIER_INVALID" },
      { status: 400 },
    );
  }

  const user = await withDbRetry(() =>
    prisma.user.findFirst({
      where:
        parsed.kind === "email"
          ? { email: parsed.email }
          : { phone: parsed.phone },
      select: { id: true, name: true, email: true, phone: true },
    }),
  );

  if (!user) {
    return NextResponse.json(
      {
        error: "Aucun compte trouvé avec cet identifiant",
        code: "ACCOUNT_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const code = generateOtpCode();
  const otpId = passwordResetIdentifier(user.id);
  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.verification.deleteMany({
        where: { identifier: otpId },
      });
      await tx.verification.create({
        data: {
          identifier: otpId,
          value: hashOtp(code),
          expiresAt: expiresAtFromNow(),
        },
      });
    }),
  );

  const text =
    `ShipShop — code de réinitialisation\n\n` +
    `Bonjour ${user.name},\n` +
    `Votre code OTP est : ${code}\n` +
    `Il expire dans ${PASSWORD_RESET_TTL_MINUTES} minutes.`;

  const channels: {
    email?: { ok: boolean; provider?: string; error?: string };
    whatsapp?: { ok: boolean; provider?: string; error?: string };
    sms?: { ok: boolean; provider?: string; error?: string };
  } = {};

  if (parsed.kind === "email") {
    try {
      const result = await sendDirectEmail({
        to: user.email,
        subject: "ShipShop — code OTP",
        title: "Code de réinitialisation",
        text,
      });
      channels.email = { ok: true, provider: result.provider };
    } catch (error) {
      channels.email = {
        ok: false,
        error: error instanceof Error ? error.message : "Envoi e-mail impossible",
      };
      return NextResponse.json(
        { error: "Impossible d'envoyer l'OTP par e-mail", code: "OTP_SEND_FAILED" },
        { status: 502 },
      );
    }
  } else {
    try {
      const wa = await sendDirectWhatsapp(user.phone || parsed.phone, text);
      channels.whatsapp = { ok: true, provider: wa.provider };
    } catch (waError) {
      channels.whatsapp = {
        ok: false,
        error: waError instanceof Error ? waError.message : "Envoi WhatsApp impossible",
      };
      try {
        const sms = await sendDirectSms(user.phone || parsed.phone, text);
        channels.sms = { ok: true, provider: sms.provider };
      } catch (smsError) {
        channels.sms = {
          ok: false,
          error: smsError instanceof Error ? smsError.message : "Envoi SMS impossible",
        };
        return NextResponse.json(
          { error: "Impossible d'envoyer l'OTP au téléphone", code: "OTP_SEND_FAILED" },
          { status: 502 },
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    delivery:
      parsed.kind === "email"
        ? "email"
        : channels.whatsapp?.ok
          ? "whatsapp"
          : "sms",
    channels,
  });
}
