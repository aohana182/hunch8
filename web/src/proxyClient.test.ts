import { test } from "node:test";
import assert from "node:assert/strict";
import { ask, PLACEHOLDER_PROXY_URL, proxyUrlFrom, resultFromResponse } from "./proxyClient.ts";

const URL = "https://proxy.test/";

function fakeFetch(respond: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("200 with an answer is a success carrying answer and confidence", () => {
  assert.deepEqual(resultFromResponse(200, { answer: "Most likely", confidence: 0.82, cost: 0 }), {
    kind: "success",
    answer: "Most likely",
    confidence: 0.82,
  });
});

test("a missing confidence defaults to 0, like optDouble in ProxyClient.kt", () => {
  assert.deepEqual(resultFromResponse(200, { answer: "Yes" }), { kind: "success", answer: "Yes", confidence: 0 });
});

test("429 is rate limited and 422 is blocked", () => {
  assert.deepEqual(resultFromResponse(429, { error: "daily limit reached" }), { kind: "rateLimited" });
  assert.deepEqual(resultFromResponse(422, { error: "blocked" }), { kind: "blocked" });
});

test("any other non-2xx status is a network error", () => {
  for (const status of [400, 404, 405, 500, 502, 503]) {
    assert.deepEqual(resultFromResponse(status, { error: "x" }), { kind: "networkError" }, `status ${status}`);
  }
});

test("a 200 without a string answer is a network error, not an empty answer", () => {
  assert.deepEqual(resultFromResponse(200, {}), { kind: "networkError" });
  assert.deepEqual(resultFromResponse(200, { answer: 42 }), { kind: "networkError" });
  assert.deepEqual(resultFromResponse(200, null), { kind: "networkError" });
  assert.deepEqual(resultFromResponse(200, "Yes"), { kind: "networkError" });
});

test("ask POSTs the question as JSON with an empty background, like the Android app", async () => {
  const { impl, calls } = fakeFetch(async () => Response.json({ answer: "Yes", confidence: 0.9 }));
  const result = await ask(URL, "Should I go?", { fetchImpl: impl });

  assert.deepEqual(result, { kind: "success", answer: "Yes", confidence: 0.9 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, URL);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(new Headers(calls[0].init.headers).get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { question: "Should I go?", background: "" });
});

test("ask maps 429 and 422 without needing a body", async () => {
  const limited = fakeFetch(async () => new Response(null, { status: 429 }));
  assert.deepEqual(await ask(URL, "q", { fetchImpl: limited.impl }), { kind: "rateLimited" });
  const blocked = fakeFetch(async () => new Response(null, { status: 422 }));
  assert.deepEqual(await ask(URL, "q", { fetchImpl: blocked.impl }), { kind: "blocked" });
});

test("ask turns invalid JSON on a 200 into a network error", async () => {
  const { impl } = fakeFetch(async () => new Response("<html>oops</html>", { status: 200 }));
  assert.deepEqual(await ask(URL, "q", { fetchImpl: impl }), { kind: "networkError" });
});

test("ask turns a thrown fetch (offline, DNS, CORS) into a network error", async () => {
  const { impl } = fakeFetch(async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.deepEqual(await ask(URL, "q", { fetchImpl: impl }), { kind: "networkError" });
});

test("ask gives up after the timeout and reports a network error", async () => {
  const { impl } = fakeFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
  );
  assert.deepEqual(await ask(URL, "q", { fetchImpl: impl, timeoutMs: 20 }), { kind: "networkError" });
});

test("the configured proxy URL is used as-is when it's a full https URL", () => {
  assert.equal(proxyUrlFrom("https://hunch8-proxy.example.workers.dev"), "https://hunch8-proxy.example.workers.dev/");
  assert.equal(proxyUrlFrom("http://127.0.0.1:8787"), "http://127.0.0.1:8787/");
});

test("a bare host gets https:// - otherwise fetch would treat it as a path on the page's own site", () => {
  assert.equal(proxyUrlFrom("hunch8-proxy.example.workers.dev"), "https://hunch8-proxy.example.workers.dev/");
  assert.equal(proxyUrlFrom("  hunch8-proxy.example.workers.dev/  "), "https://hunch8-proxy.example.workers.dev/");
});

test("a missing or unusable proxy URL falls back to the placeholder, like the Android build", () => {
  assert.equal(proxyUrlFrom(undefined), PLACEHOLDER_PROXY_URL);
  assert.equal(proxyUrlFrom(""), PLACEHOLDER_PROXY_URL);
  assert.equal(proxyUrlFrom("not a url"), PLACEHOLDER_PROXY_URL);
  assert.equal(proxyUrlFrom("ftp://example.com"), PLACEHOLDER_PROXY_URL);
});
