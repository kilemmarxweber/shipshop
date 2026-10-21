"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-errors";
import { fetchJson } from "@/lib/fetch-json";
import {
  isValidContactPhone,
  looksLikeEmail,
  looksLikeEmailInput,
} from "@/lib/phone";
import { AuthPrefsBar } from "@/components/auth-prefs-bar";
import { BackButton } from "@/components/back-button";
import { PhoneField } from "@/components/phone-field";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const preset = searchParams.get("identifier");
    if (preset) setIdentifier(preset);
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    if (looksLikeEmailInput(id)) {
      if (!looksLikeEmail(id)) {
        toast.error(t("auth.failed"));
        return;
      }
    } else if (!isValidContactPhone(id)) {
      toast.error(t("auth.phoneInvalid"));
      return;
    }
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email: id,
      password,
    });
    setLoading(false);
    if (error) {
      toast.error(mapAuthError(error, t, t("auth.failed")));
      return;
    }

    const forceCheck = await fetchJson<{ required?: boolean }>(
      "/api/auth/password-reset/first-login",
    );
    if (forceCheck.res.ok && forceCheck.data?.required) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("ss:first-login-identifier", id);
        window.sessionStorage.setItem("ss:first-login-old-password", password);
      }
      toast.info("Change ton mot de passe avant de continuer");
      router.push("/auth/first-login-password");
      router.refresh();
      return;
    }

    toast.success(t("auth.welcome"));
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <BackButton fallbackHref="/" />
      <AuthPrefsBar />
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shipshop-logo.png"
            alt="Shipshop"
            className="size-14 object-contain"
          />
        </div>
        <h1 className="font-heading text-2xl font-bold">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.loginHint")}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <PhoneField
          id="login-id"
          label={t("auth.identifier")}
          value={identifier}
          onChange={setIdentifier}
          required
          emailOrPhone
        />
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 bg-muted"
          />
          <div className="text-right">
            <Link href="/auth/forgot-password" className="text-xs font-medium text-primary">
              {t("auth.forgotLink")}
            </Link>
          </div>
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-base font-bold"
        >
          {loading ? t("auth.submitting") : t("auth.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/auth/register" className="font-semibold text-primary">
          {t("auth.createAccount")}
        </Link>
      </p>
    </div>
  );
}
