import { decryptSecret } from "@/lib/crypto";
import { ensureMessagingSetup, getMessagingConfig } from "@/lib/messaging/config";
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
} from "@/lib/messaging/templates";
import { prisma, withDbRetry } from "@/lib/prisma";

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
        buyer: { select: { name: true, phone: true } },
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
  channel: "whatsapp" | "sms";
  to: string;
  renderedBody: string;
  rawBody: string;
  infobipTemplateName?: string | null;
  infobipLanguage?: string;
  vars: TemplateVars;
}) {
  const config = await getMessagingConfig();
  const to = input.to.trim();
  if (!to) throw new Error("Numéro destinataire manquant");

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

/** Notifie le client via templates owner (SMS + WhatsApp). */
export async function notifyOrderEvent(
  orderId: string,
  eventKey: DeliveryEventKey,
) {
  const { org } = await ensureMessagingSetup();
  const vars = await buildOrderNotifyVars(orderId);
  const toPhone = String(vars.customer_phone || "").trim();
  if (!toPhone) {
    console.warn(`[notify] ${eventKey} order=${orderId} : pas de téléphone`);
    return { sent: 0 };
  }

  const templates = await withDbRetry(() =>
    prisma.messageTemplate.findMany({
      where: { organizationId: org.id, eventKey, isActive: true },
    }),
  );

  let sent = 0;
  for (const tpl of templates) {
    const renderedBody = renderTemplate(tpl.body, vars);
    try {
      const providerResult = await deliverMessage({
        channel: tpl.channel,
        to: toPhone,
        renderedBody,
        rawBody: tpl.body,
        infobipTemplateName: tpl.infobipTemplateName,
        infobipLanguage: tpl.infobipLanguage,
        vars,
      });
      await withDbRetry(() =>
        prisma.notificationLog.create({
          data: {
            orderId,
            eventKey,
            channel: tpl.channel,
            toPhone,
            body: renderedBody,
            status: "SENT",
            provider: providerResult.provider,
          },
        }),
      );
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "envoi échoué";
      console.error(`[notify] ${eventKey} ${tpl.channel}`, message);
      await withDbRetry(() =>
        prisma.notificationLog.create({
          data: {
            orderId,
            eventKey,
            channel: tpl.channel,
            toPhone,
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
