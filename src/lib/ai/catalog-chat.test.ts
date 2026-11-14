import assert from "node:assert/strict";
import { buildCatalogReply, extractSearchTerms } from "./catalog-chat";

const robeTerms = extractSearchTerms("Montre-moi des robes élégantes");
assert.ok(robeTerms.includes("robes") || robeTerms.includes("robe"));
assert.ok(robeTerms.includes("robe"), "synonyme robe attendu");

const phoneTerms = extractSearchTerms("Quel est le meilleur smartphone ?");
assert.ok(phoneTerms.includes("smartphone"));
assert.ok(
  phoneTerms.includes("iphone") || phoneTerms.includes("phone"),
  "synonymes smartphone",
);
assert.ok(!phoneTerms.includes("est"), "stop-word est filtré");

const blocked = buildCatalogReply("rembourse ma commande", []);
assert.match(blocked.reply, /paiement|remboursement|annulation/i);
assert.equal(blocked.products.length, 0);

const empty = buildCatalogReply("xyzabc introuvable", []);
assert.match(empty.reply, /pas trouvé/i);

const hit = buildCatalogReply("smartphone", [
  {
    id: "1",
    title: "Phone X",
    priceCents: 10000,
    currency: "USD",
    quantity: 2,
    category: "Tech",
  },
]);
assert.match(hit.reply, /catalogue/i);
assert.equal(hit.products.length, 1);

console.log("catalog-chat.test.ts ok");
