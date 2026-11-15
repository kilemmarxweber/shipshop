import { fingerprintIp } from "@/lib/auth-login-security";
import { prisma } from "@/lib/prisma";

export type RestrictionScope = "USER" | "SESSION" | "IP";

export async function findActiveRestriction(input: {
  userId?: string | null;
  sessionId?: string | null;
  ip?: string | null;
}) {
  const now = new Date();
  const or: Array<{ scope: string; subjectKey: string }> = [];
  if (input.userId) or.push({ scope: "USER", subjectKey: input.userId });
  if (input.sessionId)
    or.push({ scope: "SESSION", subjectKey: input.sessionId });
  if (input.ip && input.ip !== "unknown") {
    or.push({ scope: "IP", subjectKey: fingerprintIp(input.ip) });
  }
  if (!or.length) return null;

  return prisma.securityRestriction.findFirst({
    where: {
      liftedAt: null,
      expiresAt: { gt: now },
      OR: or,
    },
    orderBy: { expiresAt: "desc" },
  });
}

export async function createRestriction(input: {
  scope: RestrictionScope;
  subjectKey: string;
  reason: string;
  source: string;
  expiresAt: Date;
  createdBy?: string | null;
}) {
  return prisma.securityRestriction.create({
    data: {
      scope: input.scope,
      subjectKey: input.subjectKey.slice(0, 128),
      reason: input.reason.slice(0, 280),
      source: input.source.slice(0, 40),
      expiresAt: input.expiresAt,
      createdBy: input.createdBy?.slice(0, 64) ?? null,
    },
  });
}

export async function liftRestriction(id: string) {
  return prisma.securityRestriction.update({
    where: { id },
    data: { liftedAt: new Date() },
  });
}
