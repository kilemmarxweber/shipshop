import assert from "node:assert/strict";
import {
  buildCatalogReply,
  extractSearchTerms,
} from "./catalog-chat";

const terms = extractSearchTerms("Montre-moi des robes élégantes");
assert.ok(terms.includes("robes") || terms.includes("elegantes"));

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
