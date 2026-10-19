"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onSuccess?: () => void;
};

export function AuthInline({ onSuccess }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result =
      mode === "up"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? t("auth.failed"));
      return;
    }
    toast.success(mode === "up" ? t("auth.registerWelcome") : t("auth.welcome"));
    onSuccess?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm font-semibold">{t("buy.loginTitle")}</p>
      <p className="text-xs text-muted-foreground">{t("buy.loginHint")}</p>
      {mode === "up" ? (
        <div className="space-y-1">
          <Label htmlFor="auth-inline-name">{t("auth.name")}</Label>
          <Input
            id="auth-inline-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 bg-surface-2"
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="auth-inline-email">{t("auth.email")}</Label>
        <Input
          id="auth-inline-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 bg-surface-2"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="auth-inline-password">{t("auth.password")}</Label>
        <Input
          id="auth-inline-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-surface-2"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full font-bold"
      >
        {loading
          ? t("auth.submitting")
          : mode === "up"
            ? t("auth.registerSubmit")
            : t("auth.submit")}
      </Button>
      <button
        type="button"
        className="w-full text-center text-xs text-primary"
        onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
      >
        {mode === "in" ? t("auth.createAccount") : t("auth.hasAccount")}
      </button>
    </form>
  );
}
