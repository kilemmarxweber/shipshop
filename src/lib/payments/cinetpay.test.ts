import assert from "node:assert/strict";
import {
  assertCinetPayAmount,
  cinetPayAccepted,
  cinetPayPhone,
  cinetPayRefused,
  newCinetPayTransactionId,
  parseCinetPayNotification,
  verifyCinetPayNotifyToken,
} from "./cinetpay";

const token = "notify-token-sandbox";
assert.equal(verifyCinetPayNotifyToken(token, token), true);
assert.equal(verifyCinetPayNotifyToken(token, "notify-token-sandbox!"), false);
assert.equal(verifyCinetPayNotifyToken(token, ""), false);
assert.equal(verifyCinetPayNotifyToken(null, token), false);

assert.equal(assertCinetPayAmount(10_000, "CDF"), 100);
assert.equal(assertCinetPayAmount(10_000, "USD"), 100);
assert.throws(() => assertCinetPayAmount(250, "USD"), /entier/);
assert.throws(() => assertCinetPayAmount(500, "CDF"), /100 et 2 500 000/);
assert.throws(() => assertCinetPayAmount(10_000, "KW"), /CDF et USD/);

assert.equal(cinetPayPhone("0812345678"), "+243812345678");
assert.equal(cinetPayPhone("+243812345678"), "+243812345678");
assert.throws(() => cinetPayPhone("12"), /invalide/);

const id = newCinetPayTransactionId();
assert.ok(id.startsWith("SS"));
assert.ok(id.length <= 30);

const note = parseCinetPayNotification({
  notify_token: token,
  transaction_id: "cp_1",
  merchant_transaction_id: "SS1",
});
assert.equal(note.merchantTransactionId, "SS1");
assert.throws(() => parseCinetPayNotification({ status: "SUCCESS" }), /incomplète/);

assert.equal(
  cinetPayAccepted({
    code: "100",
    message: "",
    status: "SUCCESS",
    amount: "",
    currency: "",
    paymentMethod: null,
    operatorId: null,
    merchantTransactionId: "SS1",
    transactionId: "cp_1",
  }),
  true,
);
assert.equal(
  cinetPayRefused({
    code: "2010",
    message: "",
    status: "FAILED",
    amount: "",
    currency: "",
    paymentMethod: null,
    operatorId: null,
    merchantTransactionId: "SS1",
    transactionId: "cp_1",
  }),
  true,
);

console.log("cinetpay checks ok");
