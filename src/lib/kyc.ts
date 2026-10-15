import { prisma, withDbRetry } from "@/lib/prisma";
import { ensureSystemOrganization } from "@/lib/system-org";

export async function assertChipShopOwner(userId: string) {
  const org = await ensureSystemOrganization();
  const member = await withDbRetry(() =>
    prisma.member.findFirst({
      where: { userId, organizationId: org.id, role: "owner" },
    }),
  );
  return { org, isOwner: Boolean(member) };
}

export function kycPublic(kyc: {
  id: string;
  status: string;
  sellerType: string | null;
  legalName: string | null;
  phone: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: kyc.id,
    status: kyc.status,
    sellerType: kyc.sellerType,
    legalName: kyc.legalName,
    phone: kyc.phone,
    idNumber: kyc.idNumber,
    idFrontUrl: kyc.idFrontUrl,
    idBackUrl: kyc.idBackUrl,
    selfieUrl: kyc.selfieUrl,
    submittedAt: kyc.submittedAt,
    reviewedAt: kyc.reviewedAt,
    rejectReason: kyc.rejectReason,
    createdAt: kyc.createdAt,
    updatedAt: kyc.updatedAt,
    step1Complete: Boolean(
      kyc.sellerType && kyc.legalName?.trim() && kyc.phone?.trim() && kyc.idNumber?.trim(),
    ),
    step2Complete: Boolean(kyc.idFrontUrl && kyc.idBackUrl && kyc.selfieUrl),
  };
}

export function isUploadUrl(url: string) {
  const u = url.trim();
  return (
    u.startsWith("/uploads/") ||
    u.startsWith("http://") ||
    u.startsWith("https://")
  );
}
