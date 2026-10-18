import { decryptSecret, encryptSecret, maskApiKey } from "@/lib/crypto";
import {
  DEFAULT_INFOBIP_BASE_URL,
  DEFAULT_INFOBIP_SENDER,
} from "@/lib/messaging/infobip-sms";
import { DEFAULT_TEMPLATES } from "@/lib/messaging/templates";
import { prisma, withDbRetry } from "@/lib/prisma";
import { ensureSystemOrganization } from "@/lib/system-org";

export async function ensureMessagingSetup() {
  const org = await ensureSystemOrganization();
  let config = await withDbRetry(() =>
    prisma.messagingConfig.findUnique({ where: { organizationId: org.id } }),
  );
  if (!config) {
    config = await withDbRetry(() =>
      prisma.messagingConfig.create({
        data: {
          organizationId: org.id,
          brandPrefix: "Chip Shop",
          smsBaseUrl: DEFAULT_INFOBIP_BASE_URL,
          smsSender: DEFAULT_INFOBIP_SENDER,
        },
      }),
    );
  }

  for (const tpl of DEFAULT_TEMPLATES) {
    for (const channel of ["whatsapp", "sms", "email"] as const) {
      await withDbRetry(() =>
        prisma.messageTemplate.upsert({
          where: {
            organizationId_eventKey_channel: {
              organizationId: org.id,
              eventKey: tpl.eventKey,
              channel,
            },
          },
          create: {
            organizationId: org.id,
            eventKey: tpl.eventKey,
            name: tpl.name,
            channel,
            body: tpl.body,
            isActive: true,
          },
          update: {},
        }),
      );
    }
  }

  return { org, config };
}

export async function getMessagingConfig() {
  const { config } = await ensureMessagingSetup();
  return config;
}

export function messagingFormState(config: {
  whatsappProvider: string;
  klamboApiKeyEnc: string | null;
  klamboBaseUrl: string;
  klamboDefaultCountry: string;
  smsApiKeyEnc: string | null;
  smsBaseUrl: string;
  smsSender: string;
  waApiKeyEnc: string | null;
  waBaseUrl: string;
  waFromNumber: string | null;
  notifySms: boolean;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
  brandPrefix: string;
}) {
  let klamboMasked: string | null = null;
  let smsMasked: string | null = null;
  let waMasked: string | null = null;
  try {
    if (config.klamboApiKeyEnc)
      klamboMasked = maskApiKey(decryptSecret(config.klamboApiKeyEnc));
  } catch {
    klamboMasked = null;
  }
  try {
    if (config.smsApiKeyEnc)
      smsMasked = maskApiKey(decryptSecret(config.smsApiKeyEnc));
  } catch {
    smsMasked = null;
  }
  try {
    if (config.waApiKeyEnc)
      waMasked = maskApiKey(decryptSecret(config.waApiKeyEnc));
  } catch {
    waMasked = null;
  }

  return {
    whatsappProvider: config.whatsappProvider,
    klamboBaseUrl: config.klamboBaseUrl,
    klamboDefaultCountry: config.klamboDefaultCountry,
    klamboConfigured: Boolean(config.klamboApiKeyEnc),
    klamboApiKeyMasked: klamboMasked,
    smsBaseUrl: config.smsBaseUrl,
    smsSender: config.smsSender,
    smsConfigured: Boolean(config.smsApiKeyEnc),
    smsApiKeyMasked: smsMasked,
    waBaseUrl: config.waBaseUrl,
    waFromNumber: config.waFromNumber ?? "",
    waConfigured: Boolean(config.waApiKeyEnc && config.waFromNumber),
    waApiKeyMasked: waMasked,
    notifySms: config.notifySms,
    notifyWhatsapp: config.notifyWhatsapp,
    notifyEmail: config.notifyEmail,
    brandPrefix: config.brandPrefix,
  };
}

export { encryptSecret, decryptSecret };
