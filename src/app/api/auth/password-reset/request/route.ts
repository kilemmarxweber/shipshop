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
  passwordResetAck,
  passwordResetAttemptsIdentifier,
  passwordResetIdentifier,
  passwordResetTtlMinutes,
} from "@/lib/password-reset";
import {
  passwordResetRateLimited,
  takePasswordResetRate,
} from "@/lib/password-reset-rate";
import { prisma, withDbRetry } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";

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

  const subject = parsed.kind === "email" ? parsed.email : parsed.phone;
  const limited = await takePasswordResetRate(req, "request", subject);
  if (!limited.allowed) return passwordResetRateLimited(limited);

  const user = await withDbRetry(() =>
    prisma.user.findFirst({
      where:
        parsed.kind === "email"
          ? { email: parsed.email }
          : { phone: parsed.phone },
      select: { id: true, name: true, email: true, phone: true },
    }),
  );

  // Même réponse qu'un envoi réussi : ne pas révéler si le compte existe.
  if (!user) return NextResponse.json(passwordResetAck());

  const code = generateOtpCode();
  const minutes = passwordResetTtlMinutes();
  const otpId = passwordResetIdentifier(user.id);
  const attemptsId = passwordResetAttemptsIdentifier(user.id);
  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.verification.deleteMany({
        where: { identifier: { in: [otpId, attemptsId] } },
      });
      await tx.verification.create({
        data: {
          identifier: otpId,
          value: hashOtp(code),
          expiresAt: expiresAtFromNow(minutes),
        },
      });
    }),
  );

  const text =
    `ShipShop — code de réinitialisation\n\n` +
    `Bonjour ${user.name},\n` +
    `Votre code OTP est : ${code}\n` +
    `Il expire dans ${minutes} minutes.`;

  try {
    if (parsed.kind === "email") {
      await sendDirectEmail({
        to: user.email,
        subject: "ShipShop — code OTP",
        title: "Code de réinitialisation",
        text,
      });
    } else {
      const phone = user.phone || parsed.phone;
      try {
        await sendDirectWhatsapp(phone, text);
      } catch {
        await sendDirectSms(phone, text);
      }
    }
  } catch {
    logSecurityEvent({
      type: "password_reset_send_failed",
      severity: "moderate",
      endpoint: "/api/auth/password-reset/request",
      method: "POST",
      userId: user.id,
      detail: { channel: parsed.kind },
    });
  }

  return NextResponse.json(passwordResetAck());
}
