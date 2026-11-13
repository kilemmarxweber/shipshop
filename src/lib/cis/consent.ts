import {
    CIS_CONSENT_STATUSES,
    CIS_DEFAULT_SCOPES,
    CIS_POLICY_VERSION,
    type CisConsentStatus,
} from "@/lib/cis/constants";
import { prisma, withDbRetry } from "@/lib/prisma";

export function isCisConsentStatus(value: unknown): value is CisConsentStatus {
  return (
    typeof value === "string" &&
    (CIS_CONSENT_STATUSES as readonly string[]).includes(value)
  );
}

export async function getLatestCisConsent(userId: string) {
  try {
    return await withDbRetry(() =>
      prisma.cisConsent.findFirst({
        where: { userId },
        orderBy: { decidedAt: "desc" },
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cis_consent|CisConsent|does not exist|P2021|P2022/i.test(message)) {
      return null;
    }
    throw error;
  }
}

export async function hasActiveCisConsent(userId: string) {
  try {
    const latest = await getLatestCisConsent(userId);
    return latest?.status === "accepted";
  } catch {
    return false;
  }
}

export async function recordCisConsent(input: {
  userId: string;
  status: CisConsentStatus;
  policyVersion?: string;
  scopes?: string[];
}) {
  const now = new Date();
  return withDbRetry(() =>
    prisma.cisConsent.create({
      data: {
        userId: input.userId,
        status: input.status,
        policyVersion: input.policyVersion ?? CIS_POLICY_VERSION,
        scopes: input.scopes ?? [...CIS_DEFAULT_SCOPES],
        decidedAt: now,
        withdrawnAt:
          input.status === "withdrawn" || input.status === "refused"
            ? now
            : null,
      },
    }),
  );
}

export async function eraseCisUserData(userId: string) {
  await withDbRetry(async () => {
    await prisma.$transaction([
      prisma.cisEvent.deleteMany({ where: { userId } }),
      prisma.cisPreference.deleteMany({ where: { userId } }),
      prisma.cisRecommendation.deleteMany({ where: { userId } }),
    ]);
  });
}
