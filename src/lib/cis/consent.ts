import { prisma, withDbRetry } from "@/lib/prisma";
import {
  CIS_CONSENT_STATUSES,
  CIS_DEFAULT_SCOPES,
  CIS_POLICY_VERSION,
  type CisConsentStatus,
} from "@/lib/cis/constants";

export function isCisConsentStatus(value: unknown): value is CisConsentStatus {
  return (
    typeof value === "string" &&
    (CIS_CONSENT_STATUSES as readonly string[]).includes(value)
  );
}

export async function getLatestCisConsent(userId: string) {
  return withDbRetry(() =>
    prisma.cisConsent.findFirst({
      where: { userId },
      orderBy: { decidedAt: "desc" },
    }),
  );
}

export async function hasActiveCisConsent(userId: string) {
  const latest = await getLatestCisConsent(userId);
  return latest?.status === "accepted";
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
