import { setDefaultResultOrder } from "node:dns";
import { readFileSync } from "node:fs";

setDefaultResultOrder("ipv4first");

const text = readFileSync(".env", "utf8");
function val(key: string) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return "";
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function redact(value: unknown, key = ""): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 4).map((item) => redact(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        redact(v, k),
      ]),
    );
  }
  if (/token|url|key|password|secret|phone|email/i.test(key)) {
    return typeof value === "string" ? `[${value.length}]` : typeof value;
  }
  if (typeof value === "string") return value.slice(0, 80);
  return value;
}

const login = await fetch("https://api.cinetpay.net/v1/oauth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({
    api_key: val("CINETPAY_API_KEY"),
    api_password: val("CINETPAY_API_PASSWORD"),
  }),
});
const loginJson = (await login.json()) as Record<string, unknown>;
const token = String(loginJson.access_token ?? "");
const tx = `SS${Date.now().toString(36)}`.slice(0, 30);
const pay = await fetch("https://api.cinetpay.net/v1/payment", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    currency: "USD",
    merchant_transaction_id: tx,
    amount: 100,
    lang: "fr",
    designation: "Recharge ShipShop",
    client_email: "demo@shipshop.cd",
    client_first_name: "Demo",
    client_last_name: "Kinshasa",
    client_phone_number: "+243810000001",
    success_url: "http://localhost:3000/wallet/payment/return?tx=probe",
    failed_url: "http://localhost:3000/wallet/payment/return?tx=probe",
    notify_url: "http://localhost:3000/api/payments/cinetpay/notify",
    channel: "PUSH",
    payment_method: "MPESA_CD",
  }),
});
const body = await pay.json().catch(() => ({}));
console.log(
  JSON.stringify({
    loginHttp: login.status,
    loginCode: loginJson.code ?? "",
    payHttp: pay.status,
    body: redact(body),
  }),
);
