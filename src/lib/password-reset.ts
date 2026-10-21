import { createHash, randomInt } from "crypto";
import { looksLikeEmail, normalizeAccountPhone } from "@/lib/phone";

export const PASSWORD_RESET_TTL_MINUTES = 10;
export const PASSWORD_RESET_CODE_LENGTH = 6;

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

export function generateOtpCode() {
  const min = 10 ** (PASSWORD_RESET_CODE_LENGTH - 1);
  const max = 10 ** PASSWORD_RESET_CODE_LENGTH;
  return String(randomInt(min, max));
}

export function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function expiresAtFromNow(minutes = PASSWORD_RESET_TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60_000);
}
