import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import {
  hashOtp,
  parseResetIdentifier,
  passwordResetIdentifier,
} from "@/lib/password-reset";
import { prisma, withDbRetry } from "@/lib/prisma";

const schema = z
  .object({
    identifier: z.string().trim().min(3).max(120),
    code: z.string().trim().regex(/^\d{6}$/),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "PASSWORD_CONFIRM_MISMATCH",
  });

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

  const user = await withDbRetry(() =>
    prisma.user.findFirst({
      where:
        parsed.kind === "email"
          ? { email: parsed.email }
          : { phone: parsed.phone },
      select: { id: true },
    }),
  );
  if (!user) {
    return NextResponse.json(
      { error: "Compte introuvable", code: "ACCOUNT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const otpId = passwordResetIdentifier(user.id);
  const verification = await withDbRetry(() =>
    prisma.verification.findFirst({
      where: { identifier: otpId },
      orderBy: { createdAt: "desc" },
      select: { id: true, value: true, expiresAt: true },
    }),
  );

  if (!verification || verification.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Code OTP expiré", code: "OTP_EXPIRED" },
      { status: 400 },
    );
  }

  if (verification.value !== hashOtp(body.code)) {
    return NextResponse.json(
      { error: "Code OTP invalide", code: "OTP_INVALID" },
      { status: 400 },
    );
  }

  const hashed = await hashPassword(body.password);
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

      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.verification.deleteMany({ where: { identifier: otpId } });
    }),
  );

  return NextResponse.json({ ok: true });
}
