import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformDeliveryAdmin } from "@/lib/delivery-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  legalName: z.string().min(2).max(160),
  rccm: z.string().max(80).optional().nullable(),
  idnat: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const admin = await requirePlatformDeliveryAdmin(session.user.id);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const companies = await withDbRetry(() =>
    prisma.courierCompany.findMany({ orderBy: { legalName: "asc" } }),
  );
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const admin = await requirePlatformDeliveryAdmin(session.user.id);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  try {
    const body = schema.parse(await req.json());
    const company = await withDbRetry(() =>
      prisma.courierCompany.create({
        data: {
          legalName: body.legalName.trim(),
          rccm: body.rccm?.trim() || null,
          idnat: body.idnat?.trim() || null,
          phone: body.phone?.trim() || null,
          email: body.email?.trim() || null,
          isActive: body.isActive ?? true,
        },
      }),
    );
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Création impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
