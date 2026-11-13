import { strict as assert } from "node:assert";
import {
    IdempotencyConflictError,
    transferIdempotencyMatches,
} from "./mobile-money";

const base = {
  kind: "P2P_BALANCE",
  payerUserId: "payer-a",
  beneficiaryUserId: "user-b",
  amountCents: 500,
  currency: "USD",
};

assert.equal(
  transferIdempotencyMatches(base, {
    payerUserId: "payer-a",
    beneficiaryUserId: "user-b",
    amountCents: 500,
    currency: "USD",
  }),
  true,
  "même paramètres → match",
);

assert.equal(
  transferIdempotencyMatches(base, {
    payerUserId: "payer-a",
    beneficiaryUserId: "user-c",
    amountCents: 500,
    currency: "USD",
  }),
  false,
  "bénéficiaire différent → refus",
);

assert.equal(
  transferIdempotencyMatches(base, {
    payerUserId: "payer-a",
    beneficiaryUserId: "user-b",
    amountCents: 999,
    currency: "USD",
  }),
  false,
  "montant différent → refus",
);

assert.equal(
  transferIdempotencyMatches(base, {
    payerUserId: "payer-a",
    beneficiaryUserId: "user-b",
    amountCents: 500,
    currency: "CDF",
  }),
  false,
  "devise différente → refus",
);

assert.equal(
  transferIdempotencyMatches(base, {
    payerUserId: "payer-other",
    beneficiaryUserId: "user-b",
    amountCents: 500,
    currency: "USD",
  }),
  false,
  "autre payeur → refus",
);

assert.equal(
  transferIdempotencyMatches(
    { ...base, kind: "DEPOSIT" },
    {
      payerUserId: "payer-a",
      beneficiaryUserId: "user-b",
      amountCents: 500,
      currency: "USD",
    },
  ),
  false,
  "kind non P2P → refus",
);

const err = new IdempotencyConflictError();
assert.equal(err.status, 409);
assert.match(err.message, /idempotence/i);

console.log("transfer-idempotency.test.ts OK");
