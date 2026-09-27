const DAILY_LIMIT = 50;
const KEY_TTL_SECONDS = 60 * 60 * 25; // a day plus a buffer, so stale keys self-clean

export interface RateLimitEnv {
  RATE_LIMIT_KV: KVNamespace;
}

function todayKey(clientId: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `${clientId}:${today}`;
}

// Not billing-grade atomicity (KV writes are eventually consistent across
// edge locations), but that's an acceptable trade for a 50/day novelty cap
// versus the complexity of Durable Objects for this.
export async function checkAndIncrement(env: RateLimitEnv, clientId: string): Promise<boolean> {
  const key = todayKey(clientId);
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) ?? "0", 10);

  if (current >= DAILY_LIMIT) {
    return false;
  }

  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: KEY_TTL_SECONDS });
  return true;
}
