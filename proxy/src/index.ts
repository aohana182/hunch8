import { askJev, JevBlockedError } from "./jev.ts";
import { checkAndIncrement, type RateLimitEnv } from "./rateLimit.ts";
import { serveWithCors, type CorsEnv } from "./cors.ts";

export const MAX_QUESTION_LENGTH = 500;
export const MAX_BACKGROUND_LENGTH = 1000;
export const MAX_BODY_BYTES = 16 * 1024; // 16 KB

export interface Env extends RateLimitEnv, CorsEnv {
  OPENROUTER_API_KEY: string;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return serveWithCors(request, env, handle);
  },
};

export async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawIp = request.headers.get("cf-connecting-ip")?.trim();
  // Secure default: require client IP unless explicitly running in a local development environment.
  const clientId = rawIp || (env.ENVIRONMENT === "development" ? "unknown" : null);
  if (!clientId) {
    return Response.json({ error: "missing client identifier" }, { status: 400 });
  }

  const allowed = await checkAndIncrement(env, clientId);
  if (!allowed) {
    return Response.json({ error: "daily limit reached" }, { status: 429 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return Response.json({ error: "request payload too large" }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }

  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return Response.json({ error: "request payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { question, background } = body as { question?: unknown; background?: unknown };

  if (typeof question !== "string" || question.trim().length === 0) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: "question exceeds maximum length" }, { status: 413 });
  }

  if (background !== undefined && typeof background !== "string") {
    return Response.json({ error: "background must be a string" }, { status: 400 });
  }

  if (typeof background === "string" && background.length > MAX_BACKGROUND_LENGTH) {
    return Response.json({ error: "background exceeds maximum length" }, { status: 413 });
  }

  try {
    const result = await askJev(env.OPENROUTER_API_KEY, question.trim(), (background as string | undefined)?.trim() ?? "");
    return Response.json(result);
  } catch (err) {
    if (err instanceof JevBlockedError) {
      return Response.json({ error: "blocked" }, { status: 422 });
    }
    console.error("Jev call failed", err);
    return Response.json({ error: "Jev call failed" }, { status: 502 });
  }
}
