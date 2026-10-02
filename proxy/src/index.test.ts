import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, type Env, MAX_QUESTION_LENGTH, MAX_BACKGROUND_LENGTH, MAX_BODY_BYTES } from "./index.ts";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  const store = new Map<string, string>();
  return {
    RATE_LIMIT_KV: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    } as unknown as Env["RATE_LIMIT_KV"],
    OPENROUTER_API_KEY: "test-key",
    ALLOWED_ORIGINS: "https://hunch8.pages.dev",
    ...overrides,
  };
}

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  const serialized = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://proxy.example/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": "1.2.3.4",
      ...headers,
    },
    body: serialized,
  });
}

test("rejects non-POST requests with 405", async () => {
  const env = fakeEnv();
  const res = await handle(new Request("https://proxy.example/", { method: "GET" }), env);
  assert.equal(res.status, 405);
});

test("missing cf-connecting-ip returns 400 by default (secure production default)", async () => {
  const env = fakeEnv(); // ENVIRONMENT is undefined by default
  const req = new Request("https://proxy.example/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Is this safe?" }),
  });
  const res = await handle(req, env);
  assert.equal(res.status, 400);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "missing client identifier");
});

test("missing cf-connecting-ip falls back to unknown only when ENVIRONMENT is development", async () => {
  const env = fakeEnv({ ENVIRONMENT: "development" });
  const req = new Request("https://proxy.example/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "" }),
  });
  const res = await handle(req, env);
  // It passed client ID check and failed on question validation
  assert.equal(res.status, 400);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "question is required");
});

test("request with oversized Content-Length returns 413 early", async () => {
  const env = fakeEnv();
  const req = postRequest({ question: "Valid?" }, { "content-length": String(MAX_BODY_BYTES + 100) });
  const res = await handle(req, env);
  assert.equal(res.status, 413);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "request payload too large");
});

test("request body exceeding 16 KB returns 413 before parsing fields", async () => {
  const env = fakeEnv();
  const largeIgnoredField = "x".repeat(MAX_BODY_BYTES + 10);
  const req = postRequest({ question: "Short question?", ignored: largeIgnoredField });
  const res = await handle(req, env);
  assert.equal(res.status, 413);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "request payload too large");
});

test("invalid JSON returns 400", async () => {
  const env = fakeEnv();
  const req = postRequest("invalid json{");
  const res = await handle(req, env);
  assert.equal(res.status, 400);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "invalid JSON body");
});

test("missing or empty question returns 400", async () => {
  const env = fakeEnv();

  for (const invalid of [{}, { question: "" }, { question: "   " }, { question: 123 }, { question: true }]) {
    const res = await handle(postRequest(invalid), env);
    assert.equal(res.status, 400);
    const data = await res.json<{ error: string }>();
    assert.equal(data.error, "question is required");
  }
});

test("question exceeding maximum length returns 413", async () => {
  const env = fakeEnv();
  const longQuestion = "a".repeat(MAX_QUESTION_LENGTH + 1);
  const res = await handle(postRequest({ question: longQuestion }), env);
  assert.equal(res.status, 413);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "question exceeds maximum length");
});

test("non-string background returns 400", async () => {
  const env = fakeEnv();
  const res = await handle(postRequest({ question: "Valid?", background: 12345 }), env);
  assert.equal(res.status, 400);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "background must be a string");
});

test("background exceeding maximum length returns 413", async () => {
  const env = fakeEnv();
  const longBg = "b".repeat(MAX_BACKGROUND_LENGTH + 1);
  const res = await handle(postRequest({ question: "Valid?", background: longBg }), env);
  assert.equal(res.status, 413);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "background exceeds maximum length");
});

test("rate limit reached returns 429", async () => {
  const env = fakeEnv();
  // Exhaust limit
  for (let i = 0; i < 50; i++) {
    await env.RATE_LIMIT_KV.put(`1.2.3.4:${new Date().toISOString().slice(0, 10)}`, "50");
  }

  const res = await handle(postRequest({ question: "Valid?" }), env);
  assert.equal(res.status, 429);
  const data = await res.json<{ error: string }>();
  assert.equal(data.error, "daily limit reached");
});
