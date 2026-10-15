import { NextResponse } from "next/server";
import { z } from "zod";
import { KycStatus, SellerType } from "@/generated/prisma/client";
import { assertChipShopOwner, isUploadUrl, kycPublic } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const patchSchema = z.object({
  sellerType: z.enum(["INDIVIDUAL", "BUSINESS"]).optional().nullable(),
  legalName: z.string().max(120).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  idNumber: z.string().max(80).optional().nullable(),
  idFrontUrl: z.string().max(500).optional().nullable(),
  idBackUrl: z.string().max(500).optional().nullable(),
  selfieUrl: z.string().max(500).optional().nullable(),
});

async function loadKyc(userId: string) {
  return withDbRetry(() =>
    prisma.sellerKyc.findUnique({ where: { userId } }),
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const [kyc, owner] = await Promise.all([
    loadKyc(session.user.id),
    assertChipShopOwner(session.user.id),
  ]);

  return NextResponse.json({
    kyc: kyc ? kycPublic(kyc) : null,
    isOwner: owner.isOwner,
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    const existing = await loadKyc(session.user.id);

    if (existing?.status === "PENDING") {
      return NextResponse.json(
        { error: "Dossier déjà en revue" },
        { status: 409 },
      );
    }
    if (existing?.status === "APPROVED") {
      return NextResponse.json(
        { error: "Dossier déjà approuvé" },
        { status: 409 },
      );
    }

    for (const key of ["idFrontUrl", "idBackUrl", "selfieUrl"] as const) {
      const value = body[key];
      if (value && !isUploadUrl(value)) {
        return NextResponse.json(
          { error: "URL de document invalide" },
          { status: 400 },
        );
      }
    }

    const data = {
      sellerType:
        body.sellerType === undefined
          ? existing?.sellerType
          : (body.sellerType as SellerType | null),
      legalName:
        body.legalName === undefined
          ? existing?.legalName
          : body.legalName?.trim() || null,
      phone:
        body.phone === undefined
          ? existing?.phone
          : body.phone?.trim() || null,
      idNumber:
        body.idNumber === undefined
          ? existing?.idNumber
          : body.idNumber?.trim() || null,
      idFrontUrl:
        body.idFrontUrl === undefined
          ? existing?.idFrontUrl
          : body.idFrontUrl?.trim() || null,
      idBackUrl:
        body.idBackUrl === undefined
          ? existing?.idBackUrl
          : body.idBackUrl?.trim() || null,
      selfieUrl:
        body.selfieUrl === undefined
          ? existing?.selfieUrl
          : body.selfieUrl?.trim() || null,
      status: KycStatus.DRAFT,
      rejectReason: null,
      reviewedAt: null,
      reviewedById: null,
    };

    const kyc = await withDbRetry(() =>
      prisma.sellerKyc.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, ...data },
        update: data,
      }),
    );

    return NextResponse.json({ kyc: kycPublic(kyc) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const existing = await loadKyc(session.user.id);
  if (!existing) {
    return NextResponse.json(
      { error: "Complétez d’abord le formulaire" },
      { status: 400 },
    );
  }
  if (existing.status === "PENDING") {
    return NextResponse.json(
      { error: "Dossier déjà en revue" },
      { status: 409 },
    );
  }
  if (existing.status === "APPROVED") {
    return NextResponse.json(
      { error: "Dossier déjà approuvé" },
      { status: 409 },
    );
  }

  const pub = kycPublic(existing);
  if (!pub.step1Complete) {
    return NextResponse.json(
      { error: "Complétez le formulaire (étape 1)" },
      { status: 400 },
    );
  }
  if (!pub.step2Complete) {
    return NextResponse.json(
      { error: "Joignez recto, verso et selfie" },
      { status: 400 },
    );
  }

  const kyc = await withDbRetry(() =>
    prisma.sellerKyc.update({
      where: { id: existing.id },
      data: {
        status: KycStatus.PENDING,
        submittedAt: new Date(),
        rejectReason: null,
        reviewedAt: null,
        reviewedById: null,
      },
    }),
  );

  return NextResponse.json({ kyc: kycPublic(kyc) });
}
