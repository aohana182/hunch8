export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json<{ question?: string; background?: string }>();

    if (!body.question) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }

    // Stub response for Task 2 — Task 3 replaces this with the real Jev call.
    return Response.json({
      answer: "Reply hazy, try again",
      confidence: 0.0,
      stub: true,
    });
  },
};
