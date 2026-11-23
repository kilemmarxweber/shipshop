import assert from "node:assert/strict";
import {
  feeCentsFromBps,
  shippingFeeCents,
  splitCashMoveFee,
} from "@/lib/platform-fees";

assert.equal(feeCentsFromBps(10_000, 500), 500);
assert.equal(feeCentsFromBps(10_000, 300), 300);

const ok = splitCashMoveFee(10_000, 500, 300);
assert.equal(ok.grossFeeCents, 500);
assert.equal(ok.providerCostCents, 300);
assert.equal(ok.netAmountCents, 200);
assert.equal(ok.providerLossCents, 0);

const loss = splitCashMoveFee(10_000, 200, 300);
assert.equal(loss.grossFeeCents, 200);
assert.equal(loss.providerCostCents, 300);
assert.equal(loss.netAmountCents, 0);
assert.equal(loss.providerLossCents, 100);

assert.equal(shippingFeeCents(2_000, "USD", undefined, 1000), 200);
assert.equal(shippingFeeCents(2_000, "USD", undefined, 0), 0);

console.log("platform-fees.split.test.ts OK");
