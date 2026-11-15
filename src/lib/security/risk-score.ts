import { takeRateLimit } from "@/lib/rate-limit";
import { RISK } from "@/lib/security/policies";
import { logSecurityEvent } from "@/lib/security/security-events";

export type RiskLevel =
  | "normal"
  | "low"
  | "moderate"
  | "high";

export type RiskSignals = {
  hasCursor: boolean;
  hasSearch: boolean;
  endpoint: string;
  ipHash: string;
  userId?: string | null;
};

/**
 * Score soft in-process : signaux de parcours (cursor / search).
 * Ne déclenche jamais un ban permanent seul — sert à durcir le quota.
 */
export function evaluateRisk(signals: RiskSignals): {
  level: RiskLevel;
  throttleFactor: number;
} {
  const subject = signals.userId
    ? `u:${signals.userId}`
    : `ip:${signals.ipHash}`;
  let score = 0;

  if (signals.hasCursor) {
    const ok = takeRateLimit(
      `risk:cursor:${subject}:${signals.endpoint}`,
      RISK.cursorPagesPer5Min,
      5 * 60_000,
    );
    if (!ok) score += 2;
  }

  if (signals.hasSearch) {
    const ok = takeRateLimit(
      `risk:search:${subject}`,
      RISK.searchVariantsPer5Min,
      5 * 60_000,
    );
    if (!ok) score += 2;
  }

  if (score >= 4) {
    logSecurityEvent({
      type: "risk_high",
      severity: "high",
      endpoint: signals.endpoint,
      ipHash: signals.ipHash,
      userId: signals.userId,
      detail: { score, hasCursor: signals.hasCursor, hasSearch: signals.hasSearch },
    });
    return { level: "high", throttleFactor: RISK.highRiskThrottleFactor };
  }
  if (score >= 2) {
    logSecurityEvent({
      type: "risk_moderate",
      severity: "moderate",
      endpoint: signals.endpoint,
      ipHash: signals.ipHash,
      userId: signals.userId,
      detail: { score },
    });
    return { level: "moderate", throttleFactor: 0.65 };
  }
  if (score >= 1) {
    return { level: "low", throttleFactor: 0.85 };
  }
  return { level: "normal", throttleFactor: 1 };
}
