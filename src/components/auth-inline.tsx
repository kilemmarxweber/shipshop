"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-errors";
import { emailFromPhone, registerSchema } from "@/lib/auth-register";
import {
  isValidContactPhone,
  looksLikeEmail,
  looksLikeEmailInput,
} from "@/lib/phone";
import { useI18n } from "@/components/i18n-provider";
import { PhoneField } from "@/components/phone-field";
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
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "up") {
      const parsed = registerSchema.safeParse({
        name,
        email,
        phone,
        password,
      });
      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path[0];
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
      setLoading(true);
      const result = await authClient.signUp.email({
        name: parsed.data.name,
        email: parsed.data.email || emailFromPhone(parsed.data.phone),
        password: parsed.data.password,
        phone: parsed.data.phone,
      });
      setLoading(false);
      if (result.error) {
        toast.error(mapAuthError(result.error, t, t("auth.registerFailed")));
        return;
      }
      toast.success(t("auth.registerWelcome"));
      onSuccess?.();
      return;
    }

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
    const result = await authClient.signIn.email({
      email: id,
      password,
    });
    setLoading(false);
    if (result.error) {
      toast.error(mapAuthError(result.error, t, t("auth.failed")));
      return;
    }
    toast.success(t("auth.welcome"));
    onSuccess?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-sm font-semibold">{t("buy.loginTitle")}</p>
      <p className="text-xs text-muted-foreground">{t("buy.loginHint")}</p>
      {mode === "up" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="auth-inline-name">{t("auth.name")}</Label>
            <Input
              id="auth-inline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 bg-surface-2"
            />
          </div>
          <PhoneField
            id="auth-inline-phone"
            label={t("auth.phone")}
            value={phone}
            onChange={setPhone}
            required
            autoComplete="tel"
          />
          <div className="space-y-1">
            <Label htmlFor="auth-inline-email">{t("auth.emailOptional")}</Label>
            <Input
              id="auth-inline-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-surface-2"
            />
          </div>
        </>
      ) : (
        <PhoneField
          id="auth-inline-id"
          label={t("auth.identifier")}
          value={identifier}
          onChange={setIdentifier}
          required
          emailOrPhone
        />
      )}
      <div className="space-y-1">
        <Label htmlFor="auth-inline-password">{t("auth.password")}</Label>
        <Input
          id="auth-inline-password"
          type="password"
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
