import { askJev, JevBlockedError } from "./jev";
import { checkAndIncrement, type RateLimitEnv } from "./rateLimit";
import { serveWithCors, type CorsEnv } from "./cors";

export interface Env extends RateLimitEnv, CorsEnv {
  OPENROUTER_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return serveWithCors(request, env, handle);
  },
};

async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const clientId = request.headers.get("cf-connecting-ip") ?? "unknown";
  const allowed = await checkAndIncrement(env, clientId);
  if (!allowed) {
    return Response.json({ error: "daily limit reached" }, { status: 429 });
  }

  let body: { question?: string; background?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const result = await askJev(env.OPENROUTER_API_KEY, body.question, body.background ?? "");
    return Response.json(result);
  } catch (err) {
    if (err instanceof JevBlockedError) {
      return Response.json({ error: "blocked" }, { status: 422 });
    }
    console.error("Jev call failed", err);
    return Response.json({ error: "Jev call failed" }, { status: 502 });
  }
}
