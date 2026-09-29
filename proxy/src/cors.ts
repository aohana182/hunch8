// Browsers only let the Hunch8 web app read proxy responses if the proxy
// echoes the page's origin back. Only origins listed in ALLOWED_ORIGINS get
// that; everything else (other sites) is refused by the browser. Non-browser
// callers (the Android app, curl) send no Origin and are unaffected - the
// rate limit, not CORS, is what protects the key.
export interface CorsEnv {
  ALLOWED_ORIGINS?: string; // comma-separated, exact match, e.g. "https://hunch8.pages.dev,http://localhost:5173"
}

export function corsHeaders(origin: string | null, env: CorsEnv): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400"; // browser caches the preflight for a day
  }
  return headers;
}

export async function serveWithCors<E extends CorsEnv>(
  request: Request,
  env: E,
  handle: (request: Request, env: E) => Promise<Response>,
): Promise<Response> {
  const cors = corsHeaders(request.headers.get("Origin"), env);

  // Preflight: answered before the handler's method check and rate limiter,
  // so it doesn't 405 and doesn't burn one of the user's 50 daily questions.
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    return withHeaders(await handle(request, env), cors);
  } catch (err) {
    // Without this, an unexpected throw (e.g. a KV outage) becomes a Cloudflare
    // error page with no CORS headers, which the web app can't even read.
    console.error("Unhandled error", err);
    return withHeaders(Response.json({ error: "internal error" }, { status: 500 }), cors);
  }
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const copy = new Response(response.body, response); // a Response's own headers can be immutable
  for (const [name, value] of Object.entries(headers)) {
    copy.headers.set(name, value);
  }
  return copy;
}
