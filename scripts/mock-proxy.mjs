#!/usr/bin/env node

/**
 * Lightweight local mock proxy server for Hunch8.
 * Runs on http://localhost:8787 without needing an OpenRouter API key or Cloudflare account.
 *
 * Test triggers via question keywords:
 *   - "rate limit" -> responds with HTTP 429
 *   - "block" / "flag" -> responds with HTTP 422 (moderation trigger)
 *   - "error" -> responds with HTTP 502
 *   - Any other question -> returns a random classic 8-ball answer
 */

import http from "node:http";
import { fileURLToPath } from "node:url";

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;

export const CLASSIC_PHRASES = [
  // Affirmative
  "It is certain",
  "It is decidedly so",
  "Without a doubt",
  "Yes, definitely",
  "You may rely on it",
  "As I see it, yes",
  "Most likely",
  "Outlook good",
  "Yes",
  "Signs point to yes",
  // Non-committal
  "Reply hazy, try again",
  "Ask again later",
  "Better not tell you now",
  "Cannot predict now",
  "Concentrate and ask again",
  // Negative
  "Don't count on it",
  "My reply is no",
  "My sources say no",
  "Outlook not so good",
  "Very doubtful",
];

export function corsHeaders(req) {
  const origin = req.headers?.origin || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export function createMockHandler(options = {}) {
  const { delayMs = 250, log = true } = options;

  return (req, res) => {
    const cors = corsHeaders(req);

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { ...cors, "Content-Type": "text/plain" });
      res.end("Method not allowed");
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        res.writeHead(400, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON body" }));
        return;
      }

      if (typeof parsed !== "object" || parsed === null) {
        res.writeHead(400, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON body" }));
        return;
      }

      if (typeof parsed.question !== "string" || parsed.question.trim().length === 0) {
        res.writeHead(400, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "question is required" }));
        return;
      }

      const question = parsed.question.toLowerCase();

      const respond = () => {
        if (question.includes("rate limit")) {
          if (log) console.log(`[Mock Proxy] 429 Rate limited: "${parsed.question}"`);
          res.writeHead(429, { ...cors, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "daily limit reached" }));
          return;
        }

        if (question.includes("block") || question.includes("flag")) {
          if (log) console.log(`[Mock Proxy] 422 Blocked: "${parsed.question}"`);
          res.writeHead(422, { ...cors, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "blocked" }));
          return;
        }

        if (question.includes("error")) {
          if (log) console.log(`[Mock Proxy] 502 Upstream failure: "${parsed.question}"`);
          res.writeHead(502, { ...cors, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Jev call failed" }));
          return;
        }

        const randomPhrase = CLASSIC_PHRASES[Math.floor(Math.random() * CLASSIC_PHRASES.length)];
        const confidence = Math.round((0.65 + Math.random() * 0.3) * 100) / 100;
        if (log) console.log(`[Mock Proxy] 200 OK: "${parsed.question}" -> "${randomPhrase}" (${confidence})`);

        res.writeHead(200, { ...cors, "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            answer: randomPhrase,
            confidence,
            cost: 0,
          }),
        );
      };

      if (delayMs > 0) {
        setTimeout(respond, delayMs);
      } else {
        respond();
      }
    });
  };
}

export function createMockServer(options = {}) {
  return http.createServer(createMockHandler(options));
}

// Start listener when executed directly from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createMockServer();
  server.listen(PORT, () => {
    console.log(`\n🎱 Hunch8 Mock Proxy listening on http://localhost:${PORT}`);
    console.log(`Ready for Web and Android local testing without an API key.\n`);
  });
}
