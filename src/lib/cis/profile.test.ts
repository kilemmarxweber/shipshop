import assert from "node:assert/strict";
import { accumulatePreferences, cisMatchScore } from "./profile";

const now = Date.UTC(2026, 10, 13, 12, 0, 0);

const buckets = accumulatePreferences(
  [
    {
      type: "product_view",
      category: "mode",
      shopId: "shop-a",
      occurredAt: new Date(now - 3_600_000),
    },
    {
      type: "purchase",
      category: "mode",
      shopId: "shop-a",
      occurredAt: new Date(now - 2_000_000),
    },
    {
      type: "search",
      category: "tech",
      shopId: null,
      occurredAt: new Date(now - 1_000_000),
    },
  ],
  now,
);

assert.ok(buckets.length >= 2);
const mode = buckets.find(
  (row) => row.kind === "category" && row.key === "mode",
);
assert.ok(mode);
assert.ok(mode.score > 0);
assert.ok(mode.factors.purchase > 0);

const boost = cisMatchScore(
  { category: "mode", shopId: "shop-a" },
  {
    categories: new Map([["mode", mode.score]]),
    shops: new Map([["shop-a", 2]]),
  },
);
assert.ok(boost.score > 0);
assert.ok(boost.reasons.includes("category:mode"));

console.log("cis-profile.test.ts ok");
