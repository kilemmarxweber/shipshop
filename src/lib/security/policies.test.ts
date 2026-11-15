import assert from "node:assert/strict";
import { API_QUOTAS, PUBLIC_CATALOG_HARD_MAX, RISK } from "./policies";
import { evaluateRisk } from "./risk-score";

assert.ok(API_QUOTAS.catalog.anon.max < API_QUOTAS.catalog.auth.max);
assert.ok(API_QUOTAS.search.anon.max < API_QUOTAS.catalog.anon.max);
assert.ok(API_QUOTAS.wallet.auth.max < API_QUOTAS.catalog.auth.max);
assert.equal(PUBLIC_CATALOG_HARD_MAX, 24);
assert.ok(RISK.honeypotSuspendMs >= 15 * 60_000);

const normal = evaluateRisk({
  hasCursor: false,
  hasSearch: false,
  endpoint: "/api/products",
  ipHash: "abc",
});
assert.equal(normal.level, "normal");
assert.equal(normal.throttleFactor, 1);

console.log("security policies ok");
