import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { handle, type Env, MAX_QUESTION_LENGTH, MAX_BACKGROUND_LENGTH } from "./index.ts";

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
  return new Request("https://proxy.example/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": "1.2.3.4",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("rejects non-POST requests with 405", async () => {
  const env = fakeEnv();
  const res = await handle(new Request("https://proxy.example/", { method: "GET" }), env);
  assert.equal(res.status, 405);
});

test("missing cf-connecting-ip in production returns 400", async () => {
  const env = fakeEnv({ ENVIRONMENT: "production" });
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
