import { setDefaultResultOrder } from "dns";
import { readFileSync } from "fs";

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

const res = await fetch("https://api.cinetpay.net/v1/oauth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    api_key: val("CINETPAY_API_KEY"),
    api_password: val("CINETPAY_API_PASSWORD"),
  }),
});
const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
console.log(
  JSON.stringify({
    http: res.status,
    keys: Object.keys(json),
    hasToken: Boolean(json.access_token),
    code: json.code ?? "",
    status: json.status ?? "",
    message: json.message || json.description || "",
  }),
);
