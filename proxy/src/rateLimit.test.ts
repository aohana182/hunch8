import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAndIncrement, type RateLimitEnv } from "./rateLimit.ts";

// A real in-memory implementation, not a mock: exercises the actual
// checkAndIncrement logic (get, parse, compare, put) against real state,
// rather than asserting on which methods were called.
function fakeKvEnv(): RateLimitEnv {
  const store = new Map<string, string>();
  return {
    RATE_LIMIT_KV: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    } as unknown as RateLimitEnv["RATE_LIMIT_KV"],
  };
}

test("allows requests up to and including the 50th for one client on one day", async () => {
  const env = fakeKvEnv();
  for (let i = 1; i <= 50; i++) {
    assert.equal(await checkAndIncrement(env, "1.2.3.4"), true, `request #${i} should be allowed`);
  }
});

test("blocks the 51st request for the same client on the same day", async () => {
  const env = fakeKvEnv();
  for (let i = 1; i <= 50; i++) {
    await checkAndIncrement(env, "1.2.3.4");
  }
  assert.equal(await checkAndIncrement(env, "1.2.3.4"), false, "request #51 must be blocked");
});

test("continues blocking well past the limit, not just the first excess request", async () => {
  const env = fakeKvEnv();
  for (let i = 1; i <= 50; i++) {
    await checkAndIncrement(env, "1.2.3.4");
  }
  assert.equal(await checkAndIncrement(env, "1.2.3.4"), false);
  assert.equal(await checkAndIncrement(env, "1.2.3.4"), false);
  assert.equal(await checkAndIncrement(env, "1.2.3.4"), false);
});

test("different clients get independent quotas", async () => {
  const env = fakeKvEnv();
  for (let i = 1; i <= 50; i++) {
    await checkAndIncrement(env, "1.2.3.4");
  }
  assert.equal(await checkAndIncrement(env, "1.2.3.4"), false, "first client is exhausted");
  assert.equal(await checkAndIncrement(env, "5.6.7.8"), true, "a different client must be unaffected");
});

test("an unknown client id ('unknown', used when the IP header is missing) still gets a real, shared quota", async () => {
  const env = fakeKvEnv();
  for (let i = 1; i <= 50; i++) {
    assert.equal(await checkAndIncrement(env, "unknown"), true);
  }
  assert.equal(await checkAndIncrement(env, "unknown"), false);
});
