import { timingSafeEqual } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";

// The panel allowlist is IPv4. Node otherwise prefers IPv6 and CinetPay answers 2011.
setDefaultResultOrder("ipv4first");
import type { AppCurrency } from "@/lib/money";
import { getAppName } from "@/lib/app-name";
import type { RailProvider } from "@/lib/payments/provider";

const SANDBOX_BASE = "https://api.cinetpay.net";
const LIVE_BASE = "https://api.cinetpay.co";

const PAYMENT_METHODS: Record<RailProvider, string> = {
  ORANGE: "OM_CD",
  AIRTEL: "AIRTEL_CD",
  MPESA: "MPESA_CD",
};

const REFUSED_STATUSES = new Set([
  "FAILED",
  "EXPIRED",
  "OTP_ERROR",
  "OTP_EXPIRED",
  "INSUFFICIENT_BALANCE",
  "USER_NOT_FOUND",
  "USER_IS_BLOCKED",
  "NOT_ALLOWED",
]);

const REFUSED_CODES = new Set([
  "2010",
  "2003",
  "2004",
  "2005",
  "2006",
  "2007",
  "2008",
  "2011",
]);

export type CinetPayConfig = {
  apiKey: string;
  apiPassword: string;
  country: string;
  baseUrl: string;
};

export type CinetPayCheck = {
  code: string;
  message: string;
  status: string;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  operatorId: string | null;
  merchantTransactionId: string;
  transactionId: string;
};

export type CinetPayInit = {
  paymentUrl: string;
  paymentToken: string;
  notifyToken: string;
  transactionId: string;
  code: string;
  status: string;
};

export class CinetPayApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CinetPayApiError";
    this.code = code;
  }
}

type TokenCache = { token: string; expiresAt: number; key: string };
let tokenCache: TokenCache | null = null;

export function isCinetPayConfigured() {
  const apiKey = process.env.CINETPAY_API_KEY?.trim() ?? "";
  const apiPassword = (
    process.env.CINETPAY_API_PASSWORD ??
    process.env.CINETPAY_SECRET_KEY ??
    ""
  ).trim();
  return Boolean(apiKey && apiPassword);
}

export function cinetpayConfig(): CinetPayConfig {
  const apiKey = process.env.CINETPAY_API_KEY?.trim() ?? "";
  const apiPassword = (
    process.env.CINETPAY_API_PASSWORD ??
    process.env.CINETPAY_SECRET_KEY ??
    ""
  ).trim();
  if (!apiKey || !apiPassword) {
    throw new Error("CinetPay n'est pas configuré");
  }
  const country = (process.env.CINETPAY_COUNTRY?.trim() || "CD").toUpperCase();
  const baseUrl = (
    process.env.CINETPAY_BASE_URL?.trim() ||
    (apiKey.startsWith("sk_live_") ? LIVE_BASE : SANDBOX_BASE)
  ).replace(/\/$/, "");
  return { apiKey, apiPassword, country, baseUrl };
}

export function cinetpayCallbackOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/** Integer major units, 100 to 2_500_000. CDF and USD only (cinetpay-js). */
export function assertCinetPayAmount(
  amountCents: number,
  currency: AppCurrency,
): number {
  if (currency === "KW") {
    throw new Error(
      "CinetPay accepte CDF et USD. Le KW reste dans ShipShop.",
    );
  }
  if (!Number.isInteger(amountCents) || amountCents % 100 !== 0) {
    throw new Error("Le montant CinetPay doit être un nombre entier");
  }
  const major = amountCents / 100;
  if (major < 100 || major > 2_500_000) {
    throw new Error("Le montant CinetPay doit être entre 100 et 2 500 000");
  }
  return major;
}

export function sanitizeCinetPayText(value: string, max = 255) {
  return value
    .replace(/[#/$&_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function newCinetPayTransactionId() {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const id = `SS${time}${rand}`;
  return id.slice(0, 30);
}

export function cinetPayPhone(raw: string) {
  let phone = raw.replace(/[\s-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  else if (phone.startsWith("0")) phone = `+243${phone.slice(1)}`;
  else if (!phone.startsWith("+")) phone = `+${phone}`;
  if (!/^\+\d{8,15}$/.test(phone)) {
    throw new Error("Numéro Mobile Money invalide");
  }
  return phone;
}

export function cinetPayMethod(provider: RailProvider) {
  return PAYMENT_METHODS[provider];
}

/** Timing-safe compare of the notify token returned at init. */
export function verifyCinetPayNotifyToken(
  expected: string | null | undefined,
  received: string | null | undefined,
) {
  const a = (expected ?? "").trim();
  const b = (received ?? "").trim();
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function parseCinetPayNotification(body: unknown) {
  const data =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const notifyToken = stringField(data, "notify_token");
  const transactionId = stringField(data, "transaction_id");
  const merchantTransactionId = stringField(data, "merchant_transaction_id");
  if (!notifyToken || !transactionId) {
    throw new Error("Notification CinetPay incomplète");
  }
  return { notifyToken, transactionId, merchantTransactionId };
}

function stringField(data: Record<string, unknown> | null, key: string) {
  const value = data?.[key];
  return typeof value === "string" ? value.trim() : "";
}

type InitInput = {
  transactionId: string;
  amount: number;
  currency: "CDF" | "USD";
  phone: string;
  provider: RailProvider;
  customerName: string;
  customerSurname: string;
  customerEmail: string;
  description: string;
};

export async function initiateCinetPayPayment(
  input: InitInput,
): Promise<CinetPayInit> {
  const config = cinetpayConfig();
  const origin = cinetpayCallbackOrigin();
  const appName = sanitizeCinetPayText(getAppName(), 40) || "ShipShop";
  const returnUrl = `${origin}/wallet/payment/return?tx=${encodeURIComponent(input.transactionId)}`;
  const notifyUrl = `${origin}/api/payments/cinetpay/notify`;
  for (const url of [returnUrl, notifyUrl]) {
    if (url.length > 120) {
      throw new Error("URL de retour CinetPay trop longue");
    }
  }
  const email = input.customerEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Un email de compte est requis pour CinetPay");
  }
  const body = {
    currency: input.currency,
    merchant_transaction_id: input.transactionId.slice(0, 30),
    amount: input.amount,
    lang: "fr",
    designation:
      sanitizeCinetPayText(input.description, 255) || `Recharge ${appName}`,
    client_email: email,
    client_first_name: namePart(input.customerName),
    client_last_name: namePart(input.customerSurname),
    client_phone_number: cinetPayPhone(input.phone),
    success_url: returnUrl,
    failed_url: returnUrl,
    notify_url: notifyUrl,
    channel: "PUSH",
    payment_method: cinetPayMethod(input.provider),
  };

  const json = await cinetPayRequest(config, "POST", "/v1/payment", body);
  const code = String(json.code ?? "");
  const paymentUrl = stringField(json, "payment_url");
  const notifyToken = stringField(json, "notify_token");
  if (!paymentUrl || !notifyToken) {
    const details =
      json.details && typeof json.details === "object"
        ? (json.details as Record<string, unknown>)
        : null;
    const detailStatus = details ? stringField(details, "status") : "";
    const detailMessage = details ? stringField(details, "message") : "";
    const message =
      detailStatus === "CURRENCY_NOT_ALLOWED" ||
      /currency is not allowed/i.test(detailMessage)
        ? "Cette devise n'est pas activée sur le compte CinetPay. Choisissez USD."
        : detailMessage ||
          stringField(json, "message") ||
          stringField(json, "description") ||
          "CinetPay a refusé l'initialisation";
    throw new CinetPayApiError(
      details ? String(details.code ?? (code || "INIT")) : code || "INIT",
      message,
    );
  }
  return {
    paymentUrl,
    paymentToken: stringField(json, "payment_token"),
    notifyToken,
    transactionId:
      stringField(json, "transaction_id") || input.transactionId,
    code,
    status: stringField(json, "status"),
  };
}

export async function checkCinetPayPayment(
  transactionId: string,
): Promise<CinetPayCheck> {
  const config = cinetpayConfig();
  const json = await cinetPayRequest(
    config,
    "GET",
    `/v1/payment/${encodeURIComponent(transactionId)}`,
  );
  const details =
    json.details && typeof json.details === "object"
      ? (json.details as Record<string, unknown>)
      : null;
  return {
    code: String(json.code ?? ""),
    message:
      stringField(json, "message") ||
      stringField(details, "message") ||
      stringField(json, "description"),
    status: stringField(json, "status") || stringField(details, "status"),
    amount: amountField(json) || amountField(details),
    currency: stringField(json, "currency") || stringField(details, "currency"),
    paymentMethod:
      stringField(json, "payment_method") ||
      stringField(details, "payment_method") ||
      null,
    operatorId: stringField(json, "operator_id") || null,
    merchantTransactionId: stringField(json, "merchant_transaction_id"),
    transactionId: stringField(json, "transaction_id"),
  };
}

export function cinetPayAccepted(check: CinetPayCheck) {
  return check.status === "SUCCESS" || check.code === "100";
}

export function cinetPayRefused(check: CinetPayCheck) {
  return (
    REFUSED_STATUSES.has(check.status) || REFUSED_CODES.has(check.code)
  );
}

function namePart(value: string) {
  const clean = sanitizeCinetPayText(value, 255);
  if (clean.length >= 2) return clean;
  return "Client";
}

function amountField(data: Record<string, unknown> | null) {
  const value = data?.amount;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

async function cinetPayRequest(
  config: CinetPayConfig,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
) {
  const token = await accessToken(config);
  const first = await callApi(config.baseUrl, method, path, token, body);
  if (!tokenExpired(first.json)) return first.json;
  tokenCache = null;
  const fresh = await accessToken(config, true);
  const second = await callApi(config.baseUrl, method, path, fresh, body);
  return second.json;
}

function tokenExpired(json: Record<string, unknown>) {
  const code = String(json.code ?? "");
  return code === "1003" || code === "1002";
}

async function accessToken(config: CinetPayConfig, force = false) {
  const key = `${config.baseUrl}:${config.country}`;
  if (
    !force &&
    tokenCache &&
    tokenCache.key === key &&
    Date.now() < tokenCache.expiresAt
  ) {
    return tokenCache.token;
  }
  const res = await callApi(config.baseUrl, "POST", "/v1/oauth/login", null, {
    api_key: config.apiKey,
    api_password: config.apiPassword,
  });
  const token = stringField(res.json, "access_token");
  if (!token) {
    throw new CinetPayApiError(
      String(res.json.code ?? "1005"),
      "Authentification CinetPay refusée",
    );
  }
  tokenCache = {
    token,
    key,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  return token;
}

async function callApi(
  baseUrl: string,
  method: "GET" | "POST",
  path: string,
  token: string | null,
  body?: Record<string, unknown>,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const nested =
    parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
      ? (parsed.data as Record<string, unknown>)
      : null;
  const json = nested ? { ...nested, ...parsed, data: parsed.data } : parsed;
  if (!res.ok && !json.code) {
    throw new CinetPayApiError(
      String(res.status),
      "CinetPay indisponible",
    );
  }
  const code = String(json.code ?? "");
  if (
    code &&
    code !== "100" &&
    code !== "200" &&
    code !== "2001" &&
    code !== "2002" &&
    !json.payment_url &&
    !json.access_token &&
    !json.status
  ) {
    throw new CinetPayApiError(
      code,
      stringField(json, "message") ||
        stringField(json, "description") ||
        "CinetPay a refusé la requête",
    );
  }
  return { json };
}
