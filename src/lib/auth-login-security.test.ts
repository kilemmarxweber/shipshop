import { strict as assert } from "node:assert";
import {
    LOGIN_FAIL_THRESHOLD,
    fingerprintIp,
    fingerprintSubject,
    requestClientIp,
} from "./auth-login-security";

assert.equal(LOGIN_FAIL_THRESHOLD, 5);

const a = fingerprintSubject("User@ShipShop.cd");
const b = fingerprintSubject("user@shipshop.cd");
assert.equal(a, b, "identifiant normalisé (case-insensitive)");
assert.notEqual(a, fingerprintSubject("other@shipshop.cd"));
assert.equal(a.length, 64);

const ip1 = fingerprintIp("1.2.3.4");
const ip2 = fingerprintIp("1.2.3.4");
assert.equal(ip1, ip2);
assert.notEqual(ip1, fingerprintIp("5.6.7.8"));

process.env.TRUST_PROXY = "0";
assert.equal(
  requestClientIp({
    headers: new Headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" }),
  }),
  "unknown",
  "sans TRUST_PROXY, XFF ignoré",
);

process.env.TRUST_PROXY = "1";
assert.equal(
  requestClientIp({
    headers: new Headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" }),
  }),
  "9.9.9.9",
  "avec TRUST_PROXY, premier hop XFF",
);

console.log("auth-login-security.test.ts OK");
