export type TemplateVars = Record<string, string | number | null | undefined>;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gi;

export function renderTemplate(template: string, vars: TemplateVars): string {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    normalized[k.toLowerCase()] = v == null ? "" : String(v);
  }
  return template.replace(PLACEHOLDER, (_, key: string) => {
    return normalized[key.toLowerCase()] ?? "";
  });
}

/** {{name}} → {{1}} pour Infobip */
export function toInfobipPlaceholders(template: string): {
  text: string;
  keys: string[];
} {
  const keys: string[] = [];
  const seen = new Map<string, number>();
  const numbered = template.replace(PLACEHOLDER, (_, raw: string) => {
    const key = String(raw).toLowerCase();
    let index = seen.get(key);
    if (!index) {
      keys.push(key);
      index = keys.length;
      seen.set(key, index);
    }
    return `{{${index}}}`;
  });
  return { text: numbered.replace(/\s+/g, " ").trim(), keys };
}

export function valuesForPlaceholderKeys(
  keys: string[],
  vars: TemplateVars,
): string[] {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    normalized[k.toLowerCase()] = v == null ? "" : String(v);
  }
  return keys.map((key) => normalized[key.toLowerCase()] ?? "");
}

export const DELIVERY_EVENT_KEYS = [
  "COURIER_ASSIGNED",
  "COURIER_JOB",
  "OUT_FOR_DELIVERY",
  "COURIER_NEAR_100M",
  "DELIVERED",
  "PICKUP_READY",
  "PICKED_UP",
  "HANDOVER_SCANNED",
] as const;

export type DeliveryEventKey = (typeof DELIVERY_EVENT_KEYS)[number];

export const WALLET_EVENT_KEYS = [
  "WALLET_SENT",
  "WALLET_RECEIVED",
  "WALLET_DEPOSIT",
] as const;

export type WalletEventKey = (typeof WALLET_EVENT_KEYS)[number];

export type MessageEventKey = DeliveryEventKey | WalletEventKey;

export const ALL_EVENT_KEYS = [
  ...DELIVERY_EVENT_KEYS,
  ...WALLET_EVENT_KEYS,
] as const;

export const DEFAULT_TEMPLATES: {
  eventKey: MessageEventKey;
  name: string;
  body: string;
}[] = [
  {
    eventKey: "COURIER_ASSIGNED",
    name: "Livreur assigné",
    body: "{{brand}} · {{shop_name}}\nBonjour {{customer_name}}, votre commande {{product_title}} est prise en charge par {{courier_name}} ({{courier_phone}}).\nDistance estimée : {{distance_km}} km · Arrivée ~{{eta_text}}.\nSuivi : {{tracking_url}}",
  },
  {
    eventKey: "COURIER_JOB",
    name: "Course assignée (livreur)",
    body: "{{brand}} · Nouvelle course\nBoutique {{shop_name}} · {{product_title}}\nAdresse : {{address}} {{commune}}\nCourse nette : {{courier_net}}\nOuvrir : {{courier_url}}",
  },
  {
    eventKey: "OUT_FOR_DELIVERY",
    name: "En cours de livraison",
    body: "{{brand}} · {{shop_name}}\n{{courier_name}} est en route avec votre colis {{product_title}}.\nETA ~{{eta_text}} ({{distance_km}} km, trafic inclus).\nTél livreur : {{courier_phone}}",
  },
  {
    eventKey: "COURIER_NEAR_100M",
    name: "Livreur à proximité (100 m)",
    body: "{{brand}} · {{shop_name}}\nVotre livreur {{courier_name}} est à moins de 100 m. Préparez-vous à réceptionner {{product_title}}.\nTél : {{courier_phone}}",
  },
  {
    eventKey: "DELIVERED",
    name: "Colis livré",
    body: "{{brand}} · {{shop_name}}\nVotre commande {{product_title}} a été livrée. Merci pour votre confiance !",
  },
  {
    eventKey: "PICKUP_READY",
    name: "Prêt pour retrait",
    body: "{{brand}} · {{shop_name}}\nVotre commande {{product_title}} est prête en boutique.\nCode retrait : {{pickup_code}}\nPrésentez ce code au vendeur.",
  },
  {
    eventKey: "PICKED_UP",
    name: "Colis retiré",
    body: "{{brand}} · {{shop_name}}\nBonjour {{customer_name}}, votre colis {{product_title}} a bien été retiré. Merci !",
  },
  {
    eventKey: "HANDOVER_SCANNED",
    name: "Confirmer la réception",
    body: "{{brand}} · {{shop_name}}\nLe QR de {{product_title}} a été scanné. Confirmez la réception dans Chip Shop pour clôturer la commande : {{tracking_url}}",
  },
  {
    eventKey: "WALLET_SENT",
    name: "Portefeuille — envoyé",
    body: "{{brand}}\n{{payer_name}}, vous avez envoyé {{amount}} à {{recipient_name}}.\nRéseau : {{rail}}\nRéf. {{reference}}\nVotre solde : {{payer_balance}}\n{{wallet_url}}",
  },
  {
    eventKey: "WALLET_RECEIVED",
    name: "Portefeuille — reçu",
    body: "{{brand}}\n{{recipient_name}}, {{payer_name}} vous a envoyé {{amount}}.\nRéseau : {{rail}}\nRéf. {{reference}}\nNouveau solde : {{recipient_balance}}\n{{wallet_url}}",
  },
  {
    eventKey: "WALLET_DEPOSIT",
    name: "Portefeuille — recharge",
    body: "{{brand}}\n{{payer_name}}, votre compte a été rechargé de {{amount}}.\nRéseau : {{rail}}\nRéf. {{reference}}\nNouveau solde : {{payer_balance}}\n{{wallet_url}}",
  },
];
