import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import {
  passwordForceChangeIdentifier,
  PASSWORD_RESET_CODE_LENGTH,
} from "@/lib/password-reset";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z
  .object({
    oldPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "PASSWORD_CONFIRM_MISMATCH",
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "PASSWORD_SAME_AS_OLD",
  });

async function hasForcePasswordChange(userId: string) {
  const row = await withDbRetry(() =>
    prisma.verification.findFirst({
      where: {
        identifier: passwordForceChangeIdentifier(userId),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true },
    }),
  );
  if (!row) return false;
  if (row.expiresAt.getTime() < Date.now()) {
    await withDbRetry(() =>
      prisma.verification.deleteMany({
        where: { identifier: passwordForceChangeIdentifier(userId) },
      }),
    );
    return false;
  }
  return true;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const required = await hasForcePasswordChange(session.user.id);
  return NextResponse.json({
    required,
    minLength: 8,
    otpLength: PASSWORD_RESET_CODE_LENGTH,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Données invalides", code: "CHANGE_INVALID" },
      { status: 400 },
    );
  }

  const required = await hasForcePasswordChange(session.user.id);
  if (!required) {
    return NextResponse.json({
      ok: true,
      required: false,
    });
  }

  const account = await withDbRetry(() =>
    prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "credential",
      },
      select: { id: true, password: true },
    }),
  );

  if (!account?.password) {
    return NextResponse.json(
      { error: "Compte mot de passe introuvable", code: "ACCOUNT_PASSWORD_MISSING" },
      { status: 400 },
    );
  }

  const oldMatches = await verifyPassword({
    hash: account.password,
    password: body.oldPassword,
  });
  if (!oldMatches) {
    return NextResponse.json(
      { error: "Ancien mot de passe incorrect", code: "OLD_PASSWORD_INVALID" },
      { status: 400 },
    );
  }

  const hashed = await hashPassword(body.newPassword);
  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: account.id },
        data: { password: hashed },
      });
      await tx.verification.deleteMany({
        where: { identifier: passwordForceChangeIdentifier(session.user.id) },
      });
    }),
  );

  return NextResponse.json({ ok: true, required: false });
}
