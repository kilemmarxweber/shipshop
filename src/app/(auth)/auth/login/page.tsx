"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { AuthPrefsBar } from "@/components/auth-prefs-bar";
import { BackButton } from "@/components/back-button";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? t("auth.failed"));
      return;
    }
    toast.success(t("auth.welcome"));
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col justify-center px-5 py-10">
      <BackButton />
      <AuthPrefsBar />
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#ff5722] to-[#ff7a45] font-heading text-xl font-bold shadow-[0_8px_24px_rgba(255,87,34,0.35)]">
          CS
        </div>
        <h1 className="font-heading text-2xl font-bold">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.loginHint")}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@email.com"
            className="h-11 bg-muted"
          />
        </div>
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
