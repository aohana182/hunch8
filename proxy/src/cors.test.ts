import { test } from "node:test";
import assert from "node:assert/strict";
import { corsHeaders, serveWithCors, type CorsEnv } from "./cors.ts";

const env: CorsEnv = { ALLOWED_ORIGINS: "https://hunch8.example, http://localhost:5173" };

function request(method: string, origin?: string): Request {
  return new Request("https://proxy.example/", { method, headers: origin ? { Origin: origin } : {} });
}

test("an allowed origin is echoed back with the preflight headers", () => {
  const headers = corsHeaders("https://hunch8.example", env);
  assert.equal(headers["Access-Control-Allow-Origin"], "https://hunch8.example");
  assert.equal(headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(headers["Access-Control-Allow-Headers"], "Content-Type");
});

test("whitespace around list entries doesn't matter", () => {
  assert.equal(corsHeaders("http://localhost:5173", env)["Access-Control-Allow-Origin"], "http://localhost:5173");
});

test("an unlisted origin gets no allow header, so the browser blocks it", () => {
  assert.equal(corsHeaders("https://evil.example", env)["Access-Control-Allow-Origin"], undefined);
});

test("a lookalike origin is not a match (exact comparison, not prefix)", () => {
  assert.equal(corsHeaders("https://hunch8.example.evil.com", env)["Access-Control-Allow-Origin"], undefined);
});

test("no Origin header (Android app, curl) gets no CORS headers but still gets Vary", () => {
  assert.deepEqual(corsHeaders(null, env), { Vary: "Origin" });
});

test("with ALLOWED_ORIGINS unset, nothing is allowed", () => {
  assert.equal(corsHeaders("https://hunch8.example", {})["Access-Control-Allow-Origin"], undefined);
});

test("a preflight is answered without running the handler, so it never uses rate-limit quota", async () => {
  let handlerCalls = 0;
  const response = await serveWithCors(request("OPTIONS", "https://hunch8.example"), env, async () => {
    handlerCalls++;
    return new Response("should not run");
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://hunch8.example");
  assert.equal(handlerCalls, 0);
});

test("error statuses carry CORS headers too, so the web app can tell 429 from 422 from a network failure", async () => {
  for (const status of [400, 405, 422, 429, 502]) {
    const response = await serveWithCors(request("POST", "https://hunch8.example"), env, async () =>
      Response.json({ error: "x" }, { status }),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://hunch8.example", `status ${status}`);
  }
});

test("the handler's body and status pass through unchanged", async () => {
  const response = await serveWithCors(request("POST", "https://hunch8.example"), env, async () =>
    Response.json({ answer: "Most likely", confidence: 0.9, cost: 0 }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answer: "Most likely", confidence: 0.9, cost: 0 });
});

test("an unexpected throw becomes a 500 that still carries CORS headers", async () => {
  const originalError = console.error;
  console.error = () => {}; // the wrapper logs the error; keep test output clean
  try {
    const response = await serveWithCors(request("POST", "https://hunch8.example"), env, async () => {
      throw new Error("KV outage");
    });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://hunch8.example");
  } finally {
    console.error = originalError;
  }
});

test("a request without Origin (Android) passes through with no allow header", async () => {
  const response = await serveWithCors(request("POST"), env, async () => Response.json({ answer: "Yes" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});
