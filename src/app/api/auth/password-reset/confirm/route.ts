import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { sendDirectEmail } from "@/lib/messaging/direct";
import { looksLikeEmail } from "@/lib/phone";
import {
  hashOtp,
  parseAttemptCount,
  parseResetIdentifier,
  passwordForceChangeIdentifier,
  passwordResetAttemptsIdentifier,
  passwordResetIdentifier,
  registerOtpFailure,
} from "@/lib/password-reset";
import {
  passwordResetRateLimited,
  takePasswordResetRate,
} from "@/lib/password-reset-rate";
import { prisma, withDbRetry } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";

const schema = z
  .object({
    identifier: z.string().trim().min(3).max(120),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "PASSWORD_CONFIRM_MISMATCH",
  });

function invalidCode() {
  return NextResponse.json(
    { error: "Code OTP invalide", code: "OTP_INVALID" },
    { status: 400 },
  );
}

function expiredCode() {
  return NextResponse.json(
    { error: "Code OTP expiré", code: "OTP_EXPIRED" },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Données invalides", code: "RESET_INVALID" },
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
  const limited = await takePasswordResetRate(req, "confirm", subject);
  if (!limited.allowed) return passwordResetRateLimited(limited);

  const user = await withDbRetry(() =>
    prisma.user.findFirst({
      where:
        parsed.kind === "email"
          ? { email: parsed.email }
          : { phone: parsed.phone },
      select: { id: true, name: true, email: true },
    }),
  );
  if (!user) return invalidCode();

  const otpId = passwordResetIdentifier(user.id);
  const attemptsId = passwordResetAttemptsIdentifier(user.id);
  const forceId = passwordForceChangeIdentifier(user.id);
  const codeHash = hashOtp(body.code);

  const gate = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const verification = await tx.verification.findFirst({
        where: { identifier: otpId },
        orderBy: { createdAt: "desc" },
        select: { id: true, value: true, expiresAt: true },
      });

      if (!verification) return "invalid" as const;
      if (verification.expiresAt.getTime() < Date.now()) {
        await tx.verification.deleteMany({
          where: { identifier: { in: [otpId, attemptsId] } },
        });
        return "expired" as const;
      }

      if (verification.value !== codeHash) {
        const attemptRow = await tx.verification.findFirst({
          where: { identifier: attemptsId },
          select: { id: true, value: true },
        });
        const next = registerOtpFailure(parseAttemptCount(attemptRow?.value));
        if (next.invalidate) {
          await tx.verification.deleteMany({
            where: { identifier: { in: [otpId, attemptsId] } },
          });
          return "locked" as const;
        }
        if (attemptRow) {
          await tx.verification.update({
            where: { id: attemptRow.id },
            data: { value: String(next.attempts) },
          });
        } else {
          await tx.verification.create({
            data: {
              identifier: attemptsId,
              value: String(next.attempts),
              expiresAt: verification.expiresAt,
            },
          });
        }
        return "invalid" as const;
      }

      return "ok" as const;
    }),
  );

  if (gate === "expired") return expiredCode();
  if (gate === "invalid") return invalidCode();
  if (gate === "locked") {
    logSecurityEvent({
      type: "password_reset_locked",
      severity: "moderate",
      endpoint: "/api/auth/password-reset/confirm",
      method: "POST",
      userId: user.id,
    });
    return invalidCode();
  }

  const hashed = await hashPassword(body.password);
  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
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

      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.verification.deleteMany({
        where: { identifier: { in: [otpId, attemptsId, forceId] } },
      });
    }),
  );

  if (looksLikeEmail(user.email)) {
    try {
      await sendDirectEmail({
        to: user.email,
        subject: "ShipShop — mot de passe modifié",
        title: "Mot de passe modifié",
        text:
          `Bonjour ${user.name},\n` +
          `Le mot de passe de votre compte ShipShop vient d'être modifié.\n` +
          `Si vous n'êtes pas à l'origine de ce changement, contactez le support.`,
      });
    } catch {
      logSecurityEvent({
        type: "password_reset_notice_failed",
        severity: "low",
        endpoint: "/api/auth/password-reset/confirm",
        method: "POST",
        userId: user.id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
