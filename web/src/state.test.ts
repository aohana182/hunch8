import { test } from "node:test";
import assert from "node:assert/strict";
import { ballDescription, canAsk, restoredBallState, stateForResult } from "./state.ts";

test("a blank or whitespace-only question can't be asked", () => {
  assert.equal(canAsk("", "IDLE"), false);
  assert.equal(canAsk("   \n\t", "IDLE"), false);
  assert.equal(canAsk("Should I go?", "IDLE"), true);
});

test("a question longer than 500 characters cannot be asked", () => {
  const valid = "a".repeat(500);
  const tooLong = "a".repeat(501);
  assert.equal(canAsk(valid, "IDLE"), true);
  assert.equal(canAsk(tooLong, "IDLE"), false);
});

test("tapping while the ball is thinking does nothing (no double-fire)", () => {
  assert.equal(canAsk("Should I go?", "THINKING"), false);
});

test("asking again is allowed from every settled state", () => {
  for (const state of ["ANSWERED", "ERROR", "RATE_LIMITED", "BLOCKED"] as const) {
    assert.equal(canAsk("Should I go?", state), true, state);
  }
});

test("each proxy result maps to the ball state MainScreen.kt uses", () => {
  assert.deepEqual(stateForResult({ kind: "success", answer: "Yes", confidence: 0.9 }, ""), {
    ballState: "ANSWERED",
    answerText: "Yes",
  });
  assert.deepEqual(stateForResult({ kind: "rateLimited" }, "Yes"), { ballState: "RATE_LIMITED", answerText: "Yes" });
  assert.deepEqual(stateForResult({ kind: "blocked" }, "Yes"), { ballState: "BLOCKED", answerText: "Yes" });
  assert.deepEqual(stateForResult({ kind: "networkError" }, "Yes"), { ballState: "ERROR", answerText: "Yes" });
});

test("a restored THINKING state resets to IDLE, since the request that would finish it is gone", () => {
  assert.equal(restoredBallState("THINKING"), "IDLE");
  assert.equal(restoredBallState("ANSWERED"), "ANSWERED");
  assert.equal(restoredBallState("IDLE"), "IDLE");
});

test("accessible descriptions match BallComposable.kt word for word", () => {
  assert.equal(ballDescription("IDLE", ""), "Magic ball. Tap to ask.");
  assert.equal(ballDescription("THINKING", ""), "The ball is thinking");
  assert.equal(ballDescription("ANSWERED", "Most likely"), "The ball says: Most likely");
  assert.equal(ballDescription("ERROR", ""), "The app isn't responding");
  assert.equal(ballDescription("RATE_LIMITED", ""), "Daily limit reached, come back tomorrow");
  assert.equal(ballDescription("BLOCKED", ""), "Hunch8 won't answer that");
});
