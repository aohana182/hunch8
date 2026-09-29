import type { Page, Route } from "@playwright/test";

// A host that can't resolve, so a test that forgets to mock the proxy fails
// loudly instead of silently reaching the real Worker.
export const MOCK_PROXY_URL = "https://hunch8-proxy.invalid/";

export type MockReply =
  | { status: number; body?: unknown }
  | { abort: true } // network failure, e.g. offline
  | { hold: Promise<{ status: number; body?: unknown }> }; // respond later, to observe THINKING

// Behaves like the Worker after the CORS change: answers the preflight and
// echoes the page's origin on every response. If the web app ever stops
// sending what the real Worker expects, these tests fail the same way a
// browser would.
export async function mockProxy(page: Page, reply: () => MockReply) {
  const questions: unknown[] = [];

  await page.route(
    (url) => url.href.startsWith(MOCK_PROXY_URL),
    async (route: Route) => {
      const request = route.request();
      const cors = {
        "Access-Control-Allow-Origin": (await request.headerValue("origin")) ?? "",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      };

      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }

      questions.push(request.postDataJSON());
      const next = reply();
      if ("abort" in next) {
        await route.abort("internetdisconnected");
        return;
      }
      const { status, body } = "hold" in next ? await next.hold : next;
      await route.fulfill({ status, headers: cors, json: body ?? {} });
    },
  );

  return { questions };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
