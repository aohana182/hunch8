// Port of android/.../network/ProxyClient.kt. The proxy owns everything about
// Jev; this only sends the question and interprets the status code.

// Same placeholder the Android build falls back to when no proxy URL is
// configured - every ask then fails as "App not responding".
export const PLACEHOLDER_PROXY_URL = "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev";

// Jev takes a few seconds; past this the user is better served by the error
// state than by a ball that shakes forever.
const DEFAULT_TIMEOUT_MS = 15_000;

// The status code is the whole contract. 429 and 422 are distinct states the
// ball renders differently; anything else - including a 200 without an
// "answer" - is the same "App not responding" as no network.
export type Hunch8Result =
  | { kind: "success"; answer: string; confidence: number }
  | { kind: "rateLimited" }
  | { kind: "blocked" }
  | { kind: "networkError" };

export function resultFromResponse(status: number, body: unknown): Hunch8Result {
  if (status === 429) return { kind: "rateLimited" };
  if (status === 422) return { kind: "blocked" };
  if (status < 200 || status >= 300) return { kind: "networkError" };
  if (typeof body !== "object" || body === null || typeof (body as { answer?: unknown }).answer !== "string") {
    return { kind: "networkError" };
  }
  const { answer, confidence } = body as { answer: string; confidence?: unknown };
  return { kind: "success", answer, confidence: typeof confidence === "number" ? confidence : 0 };
}

export interface AskOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function ask(proxyUrl: string, question: string, options: AskOptions = {}): Promise<Hunch8Result> {
  const { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  try {
    const response = await fetchImpl(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The app merges question and context into one field, so background is
      // always empty - same as ProxyClient.ask(question, "") on Android.
      body: JSON.stringify({ question, background: "" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return resultFromResponse(response.status, null);
    return resultFromResponse(response.status, await response.json());
  } catch {
    // Offline, DNS, CORS refusal, timeout and unparseable JSON all look the
    // same to the user.
    return { kind: "networkError" };
  }
}
