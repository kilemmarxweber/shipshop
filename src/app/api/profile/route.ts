import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isPublicUploadPath } from "@/lib/upload-url";

const schema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().max(120).optional(),
  phone: z
    .union([z.string().min(9).max(20), z.literal(""), z.null()])
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
          ...(body.phone !== undefined
            ? { phone: body.phone?.trim() || null }
            : {}),
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
