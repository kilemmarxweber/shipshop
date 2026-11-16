import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import {
  PASSWORD_RESET_MAX_ATTEMPTS,
  hashOtp,
  parseAttemptCount,
  passwordResetAck,
  passwordResetTtlMinutes,
  registerOtpFailure,
} from "./password-reset";

const previous = process.env.PASSWORD_RESET_TTL_MINUTES;

function restoreTtl() {
  if (previous === undefined) delete process.env.PASSWORD_RESET_TTL_MINUTES;
  else process.env.PASSWORD_RESET_TTL_MINUTES = previous;
}

delete process.env.PASSWORD_RESET_TTL_MINUTES;
assert.equal(passwordResetTtlMinutes(), 15);
assert.equal(passwordResetAck().expiresInMinutes, 15);

process.env.PASSWORD_RESET_TTL_MINUTES = "10";
assert.equal(passwordResetTtlMinutes(), 10);

process.env.PASSWORD_RESET_TTL_MINUTES = "0";
assert.equal(passwordResetTtlMinutes(), 15, "hors borne → défaut");

process.env.PASSWORD_RESET_TTL_MINUTES = "nope";
assert.equal(passwordResetTtlMinutes(), 15);

assert.equal(passwordResetTtlMinutes("30"), 30);
restoreTtl();

assert.equal(PASSWORD_RESET_MAX_ATTEMPTS, 5);
assert.deepEqual(registerOtpFailure(0), { attempts: 1, invalidate: false });
assert.deepEqual(registerOtpFailure(4), { attempts: 5, invalidate: true });
assert.equal(parseAttemptCount("3"), 3);
assert.equal(parseAttemptCount("x"), 0);
assert.equal(parseAttemptCount(null), 0);

const digest = createHash("sha256").update("123456").digest("hex");
assert.equal(hashOtp("123456"), digest);
assert.notEqual(hashOtp("123456"), "123456");

console.log("password-reset.test.ts OK");
