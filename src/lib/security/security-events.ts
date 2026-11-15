import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notifySecurityAlert } from "@/lib/security/alert-mail";

export type SecuritySeverity =
  | "info"
  | "low"
  | "moderate"
  | "high"
  | "critical";

export type SecurityEventInput = {
  type: string;
  severity: SecuritySeverity;
  endpoint?: string | null;
  method?: string | null;
  ipHash?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  detail?: Prisma.InputJsonValue | null;
};

/** Journalise sans bloquer la requête métier (best-effort). */
export function logSecurityEvent(input: SecurityEventInput) {
  void prisma.securityEvent
    .create({
      data: {
        type: input.type.slice(0, 80),
        severity: input.severity,
        endpoint: input.endpoint?.slice(0, 200) ?? null,
        method: input.method?.slice(0, 16) ?? null,
        ipHash: input.ipHash?.slice(0, 64) ?? null,
        userId: input.userId?.slice(0, 64) ?? null,
        sessionId: input.sessionId?.slice(0, 64) ?? null,
        detail: input.detail ?? undefined,
      },
    })
    .catch(() => undefined);

  // high / critical → mail urgence SMTP (dédupliqué).
  notifySecurityAlert(input);
}
