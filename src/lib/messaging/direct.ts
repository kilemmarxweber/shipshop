import { decryptSecret } from "@/lib/crypto";
import { getMessagingConfig } from "@/lib/messaging/config";
import { KlamboClient } from "@/lib/messaging/klambo";
import { sendInfobipWhatsappText } from "@/lib/messaging/infobip-whatsapp";
import { sendInfobipSms } from "@/lib/messaging/infobip-sms";

function appName() {
  return (
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    process.env.APP_NAME?.trim() ||
    "ShipShop"
  );
}

function emailFrom() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    `${appName()} <noreply@shipshop.app>`
  );
}

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
 * E-mail transactionnel.
 * - Resend si `RESEND_API_KEY`
 * sinon log console (comme les invitations) pour ne pas bloquer le reset.
 */
export async function sendDirectEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  const to = input.to.trim();
  if (!to) throw new Error("E-mail manquant");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `Resend ${res.status}`);
    }
    const json = (await res.json()) as { id?: string };
    return {
      channel: "email" as const,
      provider: "resend",
      id: json.id ?? "sent",
    };
  }

  console.log(
    `[email] to=${to} subject=${input.subject}\n${input.text}\n(configure RESEND_API_KEY pour un envoi réel)`,
  );
  return {
    channel: "email" as const,
    provider: "console",
    id: "logged",
  };
}

export function passwordResetMessage(input: {
  name: string;
  email: string;
  password: string;
}) {
  const brand = appName();
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
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
