import { deliverMail, isSmtpConfigured } from "@/lib/email/smtp";
import type {
    SecurityEventInput,
    SecuritySeverity,
} from "@/lib/security/security-events";

/** Destinataire d’urgence (typo .ocm → .com). Surcharge : SECURITY_ALERT_EMAIL. */
export const DEFAULT_SECURITY_ALERT_EMAIL = "kilem@klambocore.com";

const ALERT_DEDUPE_MS = 30 * 60_000;
const lastAlertAt = new Map<string, number>();

const MAIL_SEVERITIES = new Set<SecuritySeverity>(["high", "critical"]);

export function securityAlertRecipient() {
  const fromEnv = process.env.SECURITY_ALERT_EMAIL?.trim();
  if (fromEnv && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEnv)) return fromEnv;
  return DEFAULT_SECURITY_ALERT_EMAIL;
}

function dedupeKey(input: SecurityEventInput) {
  const subject =
    input.userId?.slice(0, 32) ||
    input.sessionId?.slice(0, 32) ||
    input.ipHash?.slice(0, 32) ||
    "unknown";
  return `${input.type}:${subject}`;
}

function shouldMail(severity: SecuritySeverity) {
  return MAIL_SEVERITIES.has(severity);
}

function canSendNow(key: string) {
  const now = Date.now();
  const prev = lastAlertAt.get(key) ?? 0;
  if (now - prev < ALERT_DEDUPE_MS) return false;
  lastAlertAt.set(key, now);
  // Évite une Map infinie sur process long-lived.
  if (lastAlertAt.size > 500) {
    for (const [k, t] of lastAlertAt) {
      if (now - t > ALERT_DEDUPE_MS) lastAlertAt.delete(k);
    }
  }
  return true;
}

/**
 * Mail d’urgence ops via SMTP shop.
 * Best-effort, dédupliqué 30 min par type+sujet — ne bloque jamais la requête.
 */
export function notifySecurityAlert(input: SecurityEventInput) {
  if (!shouldMail(input.severity)) return;
  if (!isSmtpConfigured()) {
    console.warn("[security-alert] SMTP non configuré — alerte non envoyée", {
      type: input.type,
      severity: input.severity,
    });
    return;
  }

  const key = dedupeKey(input);
  if (!canSendNow(key)) return;

  const to = securityAlertRecipient();
  const when = new Date().toISOString();
  const detail =
    input.detail && typeof input.detail === "object"
      ? JSON.stringify(input.detail).slice(0, 800)
      : "";

  const subject = `[ShipShop URGENCE] ${input.severity.toUpperCase()} — ${input.type}`;
  const text = [
    "Alerte sécurité ShipShop (anti-scraping / anti-bot)",
    "",
    `Type      : ${input.type}`,
    `Sévérité  : ${input.severity}`,
    `Quand     : ${when}`,
    `Endpoint  : ${input.method ?? "—"} ${input.endpoint ?? "—"}`,
    `UserId    : ${input.userId ?? "anon"}`,
    `SessionId : ${input.sessionId ?? "—"}`,
    `IP hash   : ${input.ipHash ?? "—"}`,
    detail ? `Détail    : ${detail}` : "",
    "",
    "Action : ouvrir /shops/admin/security",
    "Aucun mot de passe / jeton n’est inclus dans cet e-mail.",
  ]
    .filter(Boolean)
    .join("\n");

  void deliverMail({ to, subject, text })
    .then(() => {
      console.info("[security-alert] mailed", { to, type: input.type });
    })
    .catch((error) => {
      console.error("[security-alert] mail failed", {
        type: input.type,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
}
