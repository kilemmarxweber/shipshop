import assert from "node:assert/strict";
import {
    DEFAULT_SECURITY_ALERT_EMAIL,
    securityAlertRecipient,
} from "./alert-mail";

assert.equal(DEFAULT_SECURITY_ALERT_EMAIL, "kilem@klambocore.com");
assert.match(securityAlertRecipient(), /@/);
assert.ok(!securityAlertRecipient().endsWith(".ocm"));

console.log("security alert-mail ok");
