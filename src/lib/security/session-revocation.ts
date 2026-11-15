import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";

/** Révoque une session Precise (Better Auth token row). */
export async function revokeSessionById(input: {
  sessionId: string;
  reason: string;
  actorUserId?: string | null;
}) {
  const deleted = await prisma.session.deleteMany({
    where: { id: input.sessionId },
  });
  logSecurityEvent({
    type: "session_revoked",
    severity: "high",
    sessionId: input.sessionId,
    userId: input.actorUserId ?? null,
    detail: { reason: input.reason, count: deleted.count },
  });
  return deleted.count;
}

/** Révoque toutes les sessions d'un compte (abus confirmé / admin). */
export async function revokeAllUserSessions(input: {
  userId: string;
  reason: string;
  actorUserId?: string | null;
}) {
  const deleted = await prisma.session.deleteMany({
    where: { userId: input.userId },
  });
  logSecurityEvent({
    type: "user_sessions_revoked",
    severity: "critical",
    userId: input.userId,
    detail: {
      reason: input.reason,
      count: deleted.count,
      actorUserId: input.actorUserId ?? null,
    },
  });
  return deleted.count;
}
