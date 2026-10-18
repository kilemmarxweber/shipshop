import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { buildEmailLogoAttachment } from "./email-logo";

let transporter: Mail | null = null;

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS,
  );
}

export function getDefaultMailFrom() {
  const appName =
    process.env.APP_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    "ShipShop";
  const smtpUser = process.env.SMTP_USER?.trim();
  if (!smtpUser) return undefined;
  return `${appName} <${smtpUser}>`;
}

function createTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE !== "false";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP non configuré (SMTP_HOST / SMTP_USER / SMTP_PASS).");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    pool: true,
    maxConnections: 1,
    maxMessages: 20,
    auth: { user, pass },
  });

  return transporter;
}

export async function deliverMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}) {
  const to = input.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Adresse e-mail invalide");
  }

  const t = createTransporter();
  const mailFrom = input.from ?? getDefaultMailFrom();
  if (!mailFrom) {
    throw new Error("Aucune adresse d'expéditeur (SMTP_USER manquant).");
  }

  const logo = input.html ? buildEmailLogoAttachment() : null;
  const info = await t.sendMail({
    from: mailFrom,
    to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: logo ? [logo] : undefined,
  });

  return {
    messageId: typeof info.messageId === "string" ? info.messageId : "sent",
  };
}
