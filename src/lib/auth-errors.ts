import type { MessagePath } from "@/components/i18n-provider";

type AuthErr = { code?: string; message?: string } | null | undefined;

export function mapAuthError(
  error: AuthErr,
  t: (key: MessagePath) => string,
  fallback: string,
) {
  const code = error?.code ?? "";
  const msg = error?.message ?? "";
  if (code === "PHONE_INVALID") return t("auth.phoneInvalid");
  if (code === "PHONE_TAKEN") return t("auth.phoneTaken");
  if (code === "EMAIL_INVALID") return t("auth.emailInvalid");
  if (code === "ACCOUNT_DISABLED" || /désactivé|disabled/i.test(msg)) {
    return t("auth.accountDisabled");
  }
  return msg || fallback;
}
