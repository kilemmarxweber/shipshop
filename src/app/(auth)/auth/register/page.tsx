"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-errors";
import { emailFromPhone, registerSchema } from "@/lib/auth-register";
import { AuthPrefsBar } from "@/components/auth-prefs-bar";
import { BackButton } from "@/components/back-button";
import { PhoneField } from "@/components/phone-field";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneTaken, setPhoneTaken] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse({ name, email, phone, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0];
      toast.error(
        field === "name"
          ? t("auth.nameInvalid")
          : field === "email"
            ? t("auth.emailInvalid")
            : field === "phone"
              ? t("auth.phoneInvalid")
              : t("auth.registerFailed"),
      );
      return;
    }
    setPhoneTaken(false);
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email || emailFromPhone(parsed.data.phone),
      password: parsed.data.password,
      phone: parsed.data.phone,
    });
    setLoading(false);
    if (error) {
      if (error.code === "PHONE_TAKEN") {
        setPhoneTaken(true);
      }
      toast.error(mapAuthError(error, t, t("auth.registerFailed")));
      return;
    }
    toast.success(t("auth.registerWelcome"));
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <BackButton fallbackHref="/auth/login" />
      <AuthPrefsBar />
      <div className="mb-8 text-center">
        <h1 className="font-heading text-2xl font-bold">{t("auth.registerTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.registerHint")}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">{t("auth.name")}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jean Kabila"
            className="h-11 bg-muted"
          />
        </div>
        <PhoneField
          id="register-phone"
          label={t("auth.phone")}
          value={phone}
          onChange={setPhone}
          required
          autoComplete="tel"
        />
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.emailOptional")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 bg-muted"
          />
        </div>
        {phoneTaken ? (
          <div className="rounded-xl border border-primary/35 bg-primary/10 p-3 text-xs">
            <p className="font-semibold text-primary">{t("auth.phoneTaken")}</p>
            <p className="mt-1 text-muted-foreground">{t("auth.phoneTakenHelp")}</p>
            <Link
              href={`/auth/forgot-password?identifier=${encodeURIComponent(phone)}`}
              className="mt-2 inline-flex text-sm font-semibold text-primary underline"
            >
              {t("auth.goForgotPassword")}
            </Link>
          </div>
        ) : null}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-base font-bold"
        >
          {loading ? t("auth.registerSubmitting") : t("auth.registerSubmit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.hasAccount")}{" "}
        <Link href="/auth/login" className="font-semibold text-primary">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
