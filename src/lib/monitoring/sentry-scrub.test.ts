import { strict as assert } from "node:assert";
import { scrubSentryEvent } from "./sentry-scrub";

const event = scrubSentryEvent({
  message: "MDP temporaire : Abcd1234! échec Bearer eyJhbGciOi.secret",
  request: {
    headers: {
      Authorization: "Bearer session-token",
      Accept: "application/json",
    },
    cookies: "better-auth.session_token=abc",
    data: {
      password: "secret-pass",
      code: "123456",
      identifier: "user@shipshop.cd",
    },
  },
  extra: { temporaryPassword: "Temp#1234" },
  breadcrumbs: [
    { message: "login", data: { token: "raw-token", ok: true } },
  ],
});

assert.equal(
  event.message,
  "MDP temporaire : [Filtered] échec Bearer [Filtered]",
);
assert.equal(event.request?.headers?.Authorization, "[Filtered]");
assert.equal(event.request?.headers?.Accept, "application/json");
assert.equal(event.request?.cookies, "[Filtered]");
assert.equal(
  (event.request?.data as { password: string }).password,
  "[Filtered]",
);
assert.equal((event.request?.data as { code: string }).code, "[Filtered]");
assert.equal(
  (event.request?.data as { identifier: string }).identifier,
  "user@shipshop.cd",
);
assert.equal(event.extra && (event.extra as { temporaryPassword: string }).temporaryPassword, "[Filtered]");
assert.equal(event.breadcrumbs?.[0]?.data && (event.breadcrumbs[0].data as { token: string }).token, "[Filtered]");
assert.equal(event.breadcrumbs?.[0]?.data && (event.breadcrumbs[0].data as { ok: boolean }).ok, true);

console.log("sentry-scrub.test.ts OK");
