import { after } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { sendDirectEmail } from "@/lib/messaging/direct";
import {
  ensureMessagingSetup,
  getMessagingConfig,
} from "@/lib/messaging/config";
import { sendInfobipSms } from "@/lib/messaging/infobip-sms";
import {
  sendInfobipWhatsappTemplate,
  sendInfobipWhatsappText,
} from "@/lib/messaging/infobip-whatsapp";
import { KlamboClient } from "@/lib/messaging/klambo";
import {
  renderTemplate,
  toInfobipPlaceholders,
  valuesForPlaceholderKeys,
  type DeliveryEventKey,
  type TemplateVars,
  type WalletEventKey,
} from "@/lib/messaging/templates";
import { formatMoney } from "@/lib/money";
import { railLabel, type RailProvider } from "@/lib/payments/provider";
import { prisma, withDbRetry } from "@/lib/prisma";

type MsgChannel = "whatsapp" | "sms" | "email";

function scheduleNotify(label: string, work: () => Promise<unknown>) {
  const run = () => work().catch((err) => console.error(`[notify] ${label}`, err));
  try {
    after(run);
  } catch {
    void run();
  }
}

function channelEnabled(
  channel: MsgChannel,
  config: Awaited<ReturnType<typeof getMessagingConfig>>,
) {
  if (channel === "email") return config.notifyEmail;
  if (channel === "sms") return Boolean(config.notifySms && config.smsApiKeyEnc);
  if (!config.notifyWhatsapp) return false;
  if (config.whatsappProvider === "klambo") return Boolean(config.klamboApiKeyEnc);
  return Boolean(config.waApiKeyEnc && config.waFromNumber);
}

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function buildOrderNotifyVars(orderId: string): Promise<TemplateVars> {
  const order = await withDbRetry(() =>
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        shop: true,
        courier: true,
        pickupReceipt: true,
        buyer: { select: { name: true, phone: true, email: true } },
      },
    }),
  );
  if (!order) throw new Error("Commande introuvable");

  const config = await getMessagingConfig();
  const etaText =
    order.etaMinutes != null
      ? order.etaMinutes < 60
        ? `${order.etaMinutes} min`
        : `${Math.floor(order.etaMinutes / 60)} h ${order.etaMinutes % 60} min`
      : "—";

  return {
    brand: config.brandPrefix || "Chip Shop",
    shop_name: order.shop.name,
    customer_name: order.buyer.name,
    customer_phone: order.contactPhone || order.buyer.phone || "",
    customer_email: order.buyer.email || "",
    product_title: order.product.title,
    courier_name: order.courier?.name ?? "",
    courier_phone: order.courier?.phone ?? "",
    distance_km: order.courierDistanceKm ?? order.distanceKm ?? "",
    eta_text: etaText,
    eta_at: order.etaAt ? order.etaAt.toLocaleString("fr-FR") : "",
    pickup_code: order.pickupReceipt?.code ?? "",
    tracking_url: `${appBase()}/orders/${order.id}`,
    address: order.deliveryAddress ?? "",
    commune: order.deliveryCommune ?? "",
  };
}

async function deliverMessage(input: {
  channel: MsgChannel;
  to: string;
  renderedBody: string;
  rawBody: string;
  infobipTemplateName?: string | null;
  infobipLanguage?: string;
  vars: TemplateVars;
  subject?: string;
}) {
  const config = await getMessagingConfig();
  const to = input.to.trim();
  if (!to) throw new Error("Destinataire manquant");

  if (input.channel === "email") {
    if (!config.notifyEmail) throw new Error("E-mail désactivé");
    const brand = String(input.vars.brand || "ShipShop");
    const walletUrl = String(input.vars.wallet_url || "").trim();
    const trackingUrl = String(input.vars.tracking_url || "").trim();
    const cta = walletUrl
      ? { href: walletUrl, label: "Ouvrir le portefeuille" }
      : trackingUrl
        ? { href: trackingUrl, label: "Suivre la commande" }
        : undefined;
    const result = await sendDirectEmail({
      to,
      subject: input.subject || `${brand} — notification`,
      title: input.subject || `${brand} — notification`,
      text: input.renderedBody,
      cta,
    });
    return { provider: result.provider, messageId: result.id };
  }

  if (input.channel === "sms") {
    if (!config.notifySms || !config.smsApiKeyEnc) {
      throw new Error("SMS Infobip non configuré / désactivé");
    }
    const result = await sendInfobipSms({
      apiKey: decryptSecret(config.smsApiKeyEnc),
      baseUrl: config.smsBaseUrl,
      sender: config.smsSender,
      to,
      text: input.renderedBody,
    });
    return { provider: "infobip-sms", messageId: result.messageId };
  }

  if (!config.notifyWhatsapp) {
    throw new Error("WhatsApp désactivé");
  }

  if (config.whatsappProvider === "klambo") {
    if (!config.klamboApiKeyEnc) throw new Error("Klambo non configuré");
    const client = new KlamboClient(
      decryptSecret(config.klamboApiKeyEnc),
      config.klamboBaseUrl,
    );
    const result = await client.sendText(to, input.renderedBody);
    return { provider: "klambo", messageId: result.id };
  }

  if (!config.waApiKeyEnc || !config.waFromNumber) {
    throw new Error("WhatsApp Infobip non configuré");
  }
  const apiKey = decryptSecret(config.waApiKeyEnc);

  if (input.infobipTemplateName) {
    const { keys } = toInfobipPlaceholders(input.rawBody);
    const placeholders = valuesForPlaceholderKeys(keys, input.vars);
    const result = await sendInfobipWhatsappTemplate({
      apiKey,
      baseUrl: config.waBaseUrl,
      from: config.waFromNumber,
      to,
      templateName: input.infobipTemplateName,
      language: input.infobipLanguage || "fr",
      placeholders,
    });
    return { provider: "infobip-wa", messageId: result.messageId };
  }

  const result = await sendInfobipWhatsappText({
    apiKey,
    baseUrl: config.waBaseUrl,
    from: config.waFromNumber,
    to,
    text: input.renderedBody,
  });
  return { provider: "infobip-wa-text", messageId: result.messageId };
}

async function notifyContact(input: {
  eventKey: string;
  vars: TemplateVars;
  phone?: string | null;
  email?: string | null;
  orderId?: string | null;
}) {
  const { org, config } = await ensureMessagingSetup();
  const templates = await withDbRetry(() =>
    prisma.messageTemplate.findMany({
      where: {
        organizationId: org.id,
        eventKey: input.eventKey,
        isActive: true,
      },
    }),
  );

  let sent = 0;
  for (const tpl of templates) {
    const channel = tpl.channel as MsgChannel;
    if (!channelEnabled(channel, config)) continue;

    const to =
      channel === "email"
        ? (input.email ?? "").trim()
        : (input.phone ?? "").trim();
    if (!to) continue;

    const renderedBody = renderTemplate(tpl.body, input.vars);
    try {
      const providerResult = await deliverMessage({
        channel,
        to,
        renderedBody,
        rawBody: tpl.body,
        infobipTemplateName: tpl.infobipTemplateName,
        infobipLanguage: tpl.infobipLanguage,
        vars: input.vars,
        subject: `${input.vars.brand || "ShipShop"} · ${tpl.name}`,
      });
      await withDbRetry(() =>
        prisma.notificationLog.create({
          data: {
            orderId: input.orderId ?? undefined,
            eventKey: input.eventKey,
            channel,
            toPhone: to,
            body: renderedBody,
            status: "SENT",
            provider: providerResult.provider,
          },
        }),
      );
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "envoi échoué";
      console.error(`[notify] ${input.eventKey} ${channel}`, message);
      await withDbRetry(() =>
        prisma.notificationLog.create({
          data: {
            orderId: input.orderId ?? undefined,
            eventKey: input.eventKey,
            channel,
            toPhone: to,
            body: renderedBody,
            status: "FAILED",
            error: message,
          },
        }),
      );
    }
  }

  return { sent };
}

async function loadUserContact(userId: string) {
  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        moneyContacts: { select: { phone: true }, take: 1 },
      },
    }),
  );
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email?.trim() || "",
    phone: user.phone?.trim() || user.moneyContacts[0]?.phone || "",
  };
}

/** Notifie le client via templates owner (e-mail + WhatsApp + SMS selon config). */
export async function notifyOrderEvent(
  orderId: string,
  eventKey: DeliveryEventKey,
) {
  const vars = await buildOrderNotifyVars(orderId);
  return notifyContact({
    eventKey,
    vars,
    phone: String(vars.customer_phone || ""),
    email: String(vars.customer_email || ""),
    orderId,
  });
}

export type WalletNotifyInput = {
  alreadyConfirmed?: boolean;
  payerUserId: string;
  beneficiaryUserId: string | null;
  amountCents: number;
  currency: string;
  reference?: string | null;
  payerBalanceAfter: number;
  beneficiaryBalanceAfter: number;
  provider?: string | null;
};

function railFromProvider(provider?: string | null) {
  if (provider === "MPESA" || provider === "ORANGE" || provider === "AIRTEL") {
    return railLabel(provider as RailProvider);
  }
  if (provider === "INTERNAL") return "Solde ShipShop";
  return "ShipShop";
}

export function scheduleWalletNotify(input: WalletNotifyInput) {
  scheduleNotify("wallet", () => notifyWalletMovement(input));
}

/** E-mail / WhatsApp / SMS à l’émetteur et au récepteur (canaux actifs). */
export async function notifyWalletMovement(input: WalletNotifyInput) {
  if (input.alreadyConfirmed) return { sent: 0 };

  const [payer, beneficiary, config] = await Promise.all([
    loadUserContact(input.payerUserId),
    input.beneficiaryUserId
      ? loadUserContact(input.beneficiaryUserId)
      : Promise.resolve(null),
    getMessagingConfig(),
  ]);
  if (!payer) return { sent: 0 };

  const amount = formatMoney(input.amountCents, input.currency);
  const vars: TemplateVars = {
    brand: config.brandPrefix || "ShipShop",
    amount,
    currency: input.currency,
    payer_name: payer.name,
    recipient_name: beneficiary?.name ?? payer.name,
    payer_balance: formatMoney(input.payerBalanceAfter, input.currency),
    recipient_balance: formatMoney(
      input.beneficiaryBalanceAfter,
      input.currency,
    ),
    reference: input.reference ?? "",
    rail: railFromProvider(input.provider),
    wallet_url: `${appBase()}/wallet`,
  };

  let sent = 0;
  const selfOnly = !beneficiary || beneficiary.id === payer.id;
  const jobs: { eventKey: WalletEventKey; contact: NonNullable<typeof payer> }[] =
    selfOnly
      ? [{ eventKey: "WALLET_DEPOSIT", contact: payer }]
      : [
          { eventKey: "WALLET_SENT", contact: payer },
          { eventKey: "WALLET_RECEIVED", contact: beneficiary },
        ];

  for (const job of jobs) {
    const result = await notifyContact({
      eventKey: job.eventKey,
      vars,
      phone: job.contact.phone,
      email: job.contact.email,
    });
    sent += result.sent;
  }
  return { sent };
}
