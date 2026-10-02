import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createMockServer, CLASSIC_PHRASES } from "./mock-proxy.mjs";

let server;
let baseUrl;

before(async () => {
  server = createMockServer({ delayMs: 0, log: false });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("mock proxy returns 204 with CORS headers for OPTIONS preflight", async () => {
  const res = await fetch(baseUrl, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(res.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});

test("mock proxy returns 405 for GET requests", async () => {
  const res = await fetch(baseUrl, { method: "GET" });
  assert.equal(res.status, 405);
});

test("mock proxy returns 400 for malformed JSON body", async () => {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "invalid JSON body{",
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "invalid JSON body");
});

test("mock proxy returns 400 for non-object JSON (e.g. null, number)", async () => {
  for (const body of ["null", "123", '"just a string"']) {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "invalid JSON body");
  }
});

test("mock proxy returns 400 for missing, blank, or non-string question", async () => {
  for (const body of [{}, { question: "" }, { question: "   " }, { question: 123 }, { question: true }]) {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "question is required");
  }
});

test("mock proxy handles 'rate limit' trigger with 429", async () => {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Will I hit the rate limit today?" }),
  });
  assert.equal(res.status, 429);
  const data = await res.json();
  assert.equal(data.error, "daily limit reached");
});

test("mock proxy handles 'block' or 'flag' trigger with 422", async () => {
  for (const question of ["Please block this question", "Is this flagged content?"]) {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.error, "blocked");
  }
});

test("mock proxy handles 'error' trigger with 502", async () => {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Simulate an upstream error" }),
  });
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.error, "Jev call failed");
});

test("mock proxy returns 200 with classic phrase for normal questions", async () => {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Will it rain tomorrow?" }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(CLASSIC_PHRASES.includes(data.answer), `Answer '${data.answer}' must be a classic phrase`);
  assert.ok(typeof data.confidence === "number" && data.confidence >= 0 && data.confidence <= 1);
  assert.equal(data.cost, 0);
});
