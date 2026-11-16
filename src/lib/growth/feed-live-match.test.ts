import assert from "node:assert/strict";
import { matchOpenLive } from "@/components/feed-live-badge";
import { canShowFeedGoLive } from "@/lib/growth/use-feed-go-live-access";

const live = {
  id: "live-1",
  title: "Live",
  status: "LIVE",
  user: { id: "owner-1", name: "Host" },
  product: {
    id: "prod-1",
    shop: { name: "Boutique", slug: "boutique" },
  },
  shop: { id: "shop-1", name: "Boutique", slug: "boutique" },
};

assert.equal(
  matchOpenLive([live], { productId: "prod-1" })?.id,
  "live-1",
  "match by product",
);
assert.equal(
  matchOpenLive([live], { ownerUserId: "owner-1" })?.id,
  "live-1",
  "match by owner",
);
assert.equal(
  matchOpenLive([live], { shopSlug: "Boutique" })?.id,
  "live-1",
  "match by shop slug",
);
assert.equal(
  matchOpenLive([live], { shopId: "shop-1" })?.id,
  "live-1",
  "match by shop id",
);
assert.equal(
  matchOpenLive([{ ...live, status: "ENDED" }], { productId: "prod-1" }),
  null,
  "ignore ended",
);

assert.equal(
  canShowFeedGoLive(
    { userId: "owner-1", isPlatformOwner: false, shopIds: [] },
    { id: "shop-1", ownerUserId: "owner-1" },
  ),
  true,
  "owner sees go-live without shopIds",
);
assert.equal(
  canShowFeedGoLive(
    { userId: "u2", isPlatformOwner: true, shopIds: [] },
    { id: "shop-1", ownerUserId: "owner-1" },
  ),
  true,
  "platform owner sees go-live",
);
assert.equal(
  canShowFeedGoLive(
    { userId: "u2", isPlatformOwner: false, shopIds: ["shop-1"] },
    { id: "shop-1", ownerUserId: "owner-1" },
  ),
  true,
  "mine shopIds sees go-live",
);
assert.equal(
  canShowFeedGoLive(
    { userId: "viewer", isPlatformOwner: false, shopIds: [] },
    { id: "shop-1", ownerUserId: "owner-1" },
  ),
  false,
  "viewer does not see go-live",
);

console.log("feed-live-match.test.ts: ok");
