import { createHash, randomInt } from "crypto";
import { looksLikeEmail, normalizeAccountPhone } from "@/lib/phone";

/** Défaut 15 minutes. Borné à 1–60 pour éviter un TTL absurde en env. */
const DEFAULT_TTL_MINUTES = 15;

export const PASSWORD_RESET_CODE_LENGTH = 6;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const PASSWORD_FORCE_CHANGE_TTL_DAYS = 30;

export function passwordResetTtlMinutes(
  raw = process.env.PASSWORD_RESET_TTL_MINUTES,
) {
  const parsed = Number(raw ?? DEFAULT_TTL_MINUTES);
  if (!Number.isFinite(parsed)) return DEFAULT_TTL_MINUTES;
  const minutes = Math.floor(parsed);
  if (minutes < 1 || minutes > 60) return DEFAULT_TTL_MINUTES;
  return minutes;
}

export function passwordResetAck() {
  return {
    ok: true as const,
    expiresInMinutes: passwordResetTtlMinutes(),
  };
}

/** Un essai de plus. Au plafond, le code doit être détruit. */
export function registerOtpFailure(currentAttempts: number) {
  const attempts = Math.max(0, currentAttempts) + 1;
  return {
    attempts,
    invalidate: attempts >= PASSWORD_RESET_MAX_ATTEMPTS,
  };
}

export function parseAttemptCount(value: string | null | undefined) {
  const parsed = Number(value ?? "0");
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

export type ResetIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string };

export function parseResetIdentifier(raw: string): ResetIdentifier | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return looksLikeEmail(email) ? { kind: "email", email } : null;
  }
  const phone = normalizeAccountPhone(value);
  return phone ? { kind: "phone", phone } : null;
}

export function passwordResetIdentifier(userId: string) {
  return `pwd-reset:${userId}`;
}

export function passwordResetAttemptsIdentifier(userId: string) {
  return `pwd-reset-attempts:${userId}`;
}

export function passwordForceChangeIdentifier(userId: string) {
  return `pwd-force-change:${userId}`;
}

export function generateOtpCode() {
  const min = 10 ** (PASSWORD_RESET_CODE_LENGTH - 1);
  const max = 10 ** PASSWORD_RESET_CODE_LENGTH;
  return String(randomInt(min, max));
}

export function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function expiresAtFromNow(minutes = passwordResetTtlMinutes()) {
  return new Date(Date.now() + minutes * 60_000);
}

export function expiresAtDaysFromNow(days = PASSWORD_FORCE_CHANGE_TTL_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60_000);
}
