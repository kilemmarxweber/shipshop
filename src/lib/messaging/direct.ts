import { decryptSecret } from "@/lib/crypto";
import {
  appDisplayName,
  emailInfoCard,
  emailLayoutHtml,
  emailSecretValue,
  escapeHtml,
  publicAppUrl,
  wrapTextEmail,
} from "@/lib/email/email-layout";
import { deliverMail, isSmtpConfigured } from "@/lib/email/smtp";
import { getMessagingConfig } from "@/lib/messaging/config";
import { KlamboClient } from "@/lib/messaging/klambo";
import { sendInfobipWhatsappText } from "@/lib/messaging/infobip-whatsapp";
import { sendInfobipSms } from "@/lib/messaging/infobip-sms";

/** Envoi WhatsApp texte (Klambo ou Infobip) selon la config plateforme. */
export async function sendDirectWhatsapp(to: string, text: string) {
  const phone = to.trim();
  if (!phone) throw new Error("Téléphone manquant");

  const config = await getMessagingConfig();
  if (!config.notifyWhatsapp) {
    throw new Error("WhatsApp désactivé dans la config messaging");
  }

  if (config.whatsappProvider === "klambo") {
    if (!config.klamboApiKeyEnc) throw new Error("Klambo non configuré");
    const client = new KlamboClient(
      decryptSecret(config.klamboApiKeyEnc),
      config.klamboBaseUrl,
    );
    const result = await client.sendText(phone, text);
    return { channel: "whatsapp" as const, provider: "klambo", id: result.id };
  }

  if (!config.waApiKeyEnc || !config.waFromNumber) {
    throw new Error("WhatsApp Infobip non configuré");
  }
  const result = await sendInfobipWhatsappText({
    apiKey: decryptSecret(config.waApiKeyEnc),
    baseUrl: config.waBaseUrl,
    from: config.waFromNumber,
    to: phone,
    text,
  });
  return {
    channel: "whatsapp" as const,
    provider: "infobip-wa",
    id: result.messageId,
  };
}

/** SMS Infobip (fallback si WhatsApp échoue). */
export async function sendDirectSms(to: string, text: string) {
  const phone = to.trim();
  if (!phone) throw new Error("Téléphone manquant");
  const config = await getMessagingConfig();
  if (!config.notifySms || !config.smsApiKeyEnc) {
    throw new Error("SMS Infobip non configuré / désactivé");
  }
  const result = await sendInfobipSms({
    apiKey: decryptSecret(config.smsApiKeyEnc),
    baseUrl: config.smsBaseUrl,
    sender: config.smsSender,
    to: phone,
    text,
  });
  return {
    channel: "sms" as const,
    provider: "infobip-sms",
    id: result.messageId,
  };
}

/**
 * E-mail transactionnel SMTP (Hostinger comme Eteyelo) + layout HTML.
 */
export async function sendDirectEmail(input: {
  to: string;
  subject: string;
  text: string;
  title?: string;
  html?: string;
  cta?: { href: string; label: string };
}) {
  const to = input.to.trim();
  if (!to) throw new Error("E-mail manquant");

  const html =
    input.html ??
    wrapTextEmail({
      title: input.title || input.subject,
      text: input.text,
      cta: input.cta,
    });

  if (!isSmtpConfigured()) {
    console.log(
      `[email] SMTP off — to=${to} subject=${input.subject}\n${input.text}`,
    );
    return {
      channel: "email" as const,
      provider: "console",
      id: "logged",
    };
  }

  const result = await deliverMail({
    to,
    subject: input.subject,
    text: input.text,
    html,
  });
  return {
    channel: "email" as const,
    provider: "smtp",
    id: result.messageId,
  };
}

export function passwordResetMessage(input: {
  name: string;
  email: string;
  password: string;
}) {
  const brand = appDisplayName();
  const base = publicAppUrl();
  return (
    `${brand} — nouveau mot de passe\n\n` +
    `Bonjour ${input.name},\n` +
    `Votre mot de passe a été réinitialisé par un administrateur.\n\n` +
    `E-mail : ${input.email}\n` +
    `Nouveau mot de passe : ${input.password}\n\n` +
    `Connectez-vous : ${base}/auth/login\n` +
    `Changez-le dès que possible dans votre profil.`
  );
}

export function passwordResetHtml(input: {
  name: string;
  email: string;
  password: string;
}) {
  const brand = appDisplayName();
  const loginUrl = `${publicAppUrl()}/auth/login`;
  return emailLayoutHtml({
    appName: brand,
    title: "Nouveau mot de passe",
    intro: `Bonjour ${escapeHtml(input.name)}, votre mot de passe a été réinitialisé par un administrateur.`,
    bodyHtml: emailInfoCard([
      {
        label: "E-mail",
        valueHtml: `<code style="background:#e2e8f0;padding:2px 8px;border-radius:6px;">${escapeHtml(input.email)}</code>`,
      },
      {
        label: "Nouveau mot de passe",
        valueHtml: emailSecretValue(input.password),
      },
    ]),
    cta: { href: loginUrl, label: "Se connecter" },
    footerNote: "Changez ce mot de passe dès que possible dans votre profil.",
  });
}
