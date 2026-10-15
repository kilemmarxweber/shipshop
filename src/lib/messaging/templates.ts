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
  "OUT_FOR_DELIVERY",
  "COURIER_NEAR_100M",
  "DELIVERED",
  "PICKUP_READY",
  "PICKED_UP",
] as const;

export type DeliveryEventKey = (typeof DELIVERY_EVENT_KEYS)[number];

export const DEFAULT_TEMPLATES: {
  eventKey: DeliveryEventKey;
  name: string;
  body: string;
}[] = [
  {
    eventKey: "COURIER_ASSIGNED",
    name: "Livreur assigné",
    body: "{{brand}} · {{shop_name}}\nBonjour {{customer_name}}, votre commande {{product_title}} est prise en charge par {{courier_name}} ({{courier_phone}}).\nDistance estimée : {{distance_km}} km · Arrivée ~{{eta_text}}.\nSuivi : {{tracking_url}}",
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
];
