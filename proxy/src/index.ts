import { askJev } from "./jev";

export interface Env {
  OPENROUTER_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json<{ question?: string; background?: string }>();

    if (!body.question) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }

    try {
      const result = await askJev(env.OPENROUTER_API_KEY, body.question, body.background ?? "");
      return Response.json(result);
    } catch (err) {
      console.error("Jev call failed", err);
      return Response.json({ error: "Jev call failed" }, { status: 502 });
    }
  },
};
