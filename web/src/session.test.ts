import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScreen, saveScreen } from "./session.ts";

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

test("the question and ball state survive a reload", () => {
  const storage = memoryStorage();
  saveScreen(storage, { question: "Should I go?", ballState: "ANSWERED", answerText: "Yes" });
  assert.deepEqual(loadScreen(storage), { question: "Should I go?", ballState: "ANSWERED", answerText: "Yes" });
});

test("a saved THINKING state comes back as IDLE - the request died with the page", () => {
  const storage = memoryStorage();
  saveScreen(storage, { question: "q", ballState: "THINKING", answerText: "" });
  assert.equal(loadScreen(storage).ballState, "IDLE");
});

test("nothing saved, corrupt data, or unavailable storage all start fresh", () => {
  const fresh = { question: "", ballState: "IDLE", answerText: "" };
  assert.deepEqual(loadScreen(memoryStorage()), fresh);
  assert.deepEqual(loadScreen({ getItem: () => "{not json" }), fresh);
  assert.deepEqual(loadScreen({ getItem: () => JSON.stringify({ ballState: "EXPLODED", question: 3 }) }), fresh);
  assert.deepEqual(
    loadScreen({
      getItem: () => {
        throw new Error("SecurityError");
      },
    }),
    fresh,
  );
  assert.deepEqual(loadScreen(undefined), fresh);
});

test("a failing storage write is swallowed", () => {
  assert.doesNotThrow(() =>
    saveScreen(
      {
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
      { question: "q", ballState: "IDLE", answerText: "" },
    ),
  );
});
