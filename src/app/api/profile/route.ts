import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { isPhoneBackedEmail } from "@/lib/auth-register";
import { normalizeAccountPhone } from "@/lib/phone";
import { getSession } from "@/lib/session";
import { isPublicUploadPath } from "@/lib/upload-url";

const schema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.union([z.string().email().max(120), z.literal("")]).optional(),
  phone: z
    .union([z.string().max(24), z.literal(""), z.null()])
    .optional(),
  image: z.string().min(1).max(500).optional().nullable(),
  locale: z.enum(["fr", "en", "pt"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          locale: true,
          theme: true,
        },
      }),
    );
    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Profil indisponible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());

    if (body.email) {
      const email = body.email.trim().toLowerCase();
      if (isPhoneBackedEmail(email)) {
        return NextResponse.json(
          { error: "E-mail invalide" },
          { status: 400 },
        );
      }
      const taken = await withDbRetry(() =>
        prisma.user.findFirst({
          where: {
            email,
            NOT: { id: session.user.id },
          },
          select: { id: true },
        }),
      );
      if (taken) {
        return NextResponse.json(
          { error: "Cet e-mail est déjà utilisé" },
          { status: 409 },
        );
      }
    }

    let nextPhone: string | null | undefined;
    if (body.phone !== undefined) {
      const raw = body.phone?.trim() || "";
      if (!raw) {
        nextPhone = null;
      } else {
        const phone = normalizeAccountPhone(raw);
        if (!phone) {
          return NextResponse.json(
            { error: "Numéro de téléphone invalide" },
            { status: 400 },
          );
        }
        const taken = await withDbRetry(() =>
          prisma.user.findFirst({
            where: { phone, NOT: { id: session.user.id } },
            select: { id: true },
          }),
        );
        if (taken) {
          return NextResponse.json(
            { error: "Ce numéro est déjà utilisé" },
            { status: 409 },
          );
        }
        nextPhone = phone;
      }
    }

    if (body.image !== undefined && body.image !== null) {
      const img = body.image.trim();
      const ok =
        isPublicUploadPath(img) ||
        img.startsWith("http://") ||
        img.startsWith("https://");
      if (!ok) {
        return NextResponse.json(
          { error: "URL d'image invalide" },
          { status: 400 },
        );
      }
    }

    const user = await withDbRetry(() =>
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.email !== undefined
            ? { email: body.email.trim().toLowerCase() }
            : {}),
          ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
          ...(body.image !== undefined ? { image: body.image } : {}),
          ...(body.locale !== undefined ? { locale: body.locale } : {}),
          ...(body.theme !== undefined ? { theme: body.theme } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          locale: true,
          theme: true,
        },
      }),
    );
    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
