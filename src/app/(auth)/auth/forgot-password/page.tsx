"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { useI18n } from "@/components/i18n-provider";
import { PhoneField } from "@/components/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/fetch-json";

type RequestResponse = {
  error?: string;
  code?: string;
  expiresInMinutes?: number;
};

type ConfirmResponse = {
  error?: string;
  code?: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const preset = searchParams.get("identifier");
    if (preset) setIdentifier(preset);
  }, [searchParams]);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { res, data } = await fetchJson<RequestResponse>(
      "/api/auth/password-reset/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      },
    );
    setBusy(false);

    if (!res.ok) {
      toast.error(data?.error ?? t("auth.resetRequestFailed"));
      return;
    }

    toast.success(t("auth.otpSent"));
    setStep("confirm");
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    const { res, data } = await fetchJson<ConfirmResponse>(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code, password, confirmPassword }),
      },
    );
    setBusy(false);

    if (!res.ok) {
      const codeError =
        data?.code === "OTP_INVALID"
          ? t("auth.otpInvalid")
          : data?.code === "OTP_EXPIRED"
            ? t("auth.otpExpired")
            : data?.error ?? t("auth.resetConfirmFailed");
      toast.error(codeError);
      return;
    }

    toast.success(t("auth.resetDone"));
    router.push("/auth/login");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <BackButton fallbackHref="/auth/login" />
      <div className="mb-8 text-center">
        <h1 className="font-heading text-2xl font-bold">{t("auth.forgotTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "request" ? t("auth.forgotHint") : t("auth.forgotOtpHint")}
        </p>
      </div>

      {step === "request" ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <PhoneField
            id="forgot-id"
            label={t("auth.identifier")}
            value={identifier}
            onChange={setIdentifier}
            required
            emailOrPhone
          />
          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-base font-bold"
          >
            {busy ? t("auth.sendingOtp") : t("auth.sendOtp")}
          </Button>
        </form>
      ) : (
        <form onSubmit={confirmReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp-code">{t("auth.otpCode")}</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="h-11 bg-muted text-center tracking-[0.35em]"
              placeholder="000000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("auth.confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11 bg-muted"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-base font-bold"
          >
            {busy ? t("auth.resetting") : t("auth.resetPassword")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={() => setStep("request")}
          >
            {t("auth.resendOtp")}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/auth/login" className="font-semibold text-primary">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
