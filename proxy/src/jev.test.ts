import { test } from "node:test";
import assert from "node:assert/strict";
import { phraseForScore } from "./jev.ts";

const NEGATIVE = ["My reply is no", "My sources say no", "Very doubtful"];
const LEANING_NEGATIVE = ["Don't count on it", "Outlook not so good"];
const NON_COMMITTAL = [
  "Reply hazy, try again",
  "Ask again later",
  "Better not tell you now",
  "Cannot predict now",
  "Concentrate and ask again",
];
const LEANING_POSITIVE = ["As I see it, yes", "Most likely", "Outlook good", "Yes", "Signs point to yes"];
const POSITIVE = ["It is certain", "It is decidedly so", "Without a doubt", "Yes, definitely", "You may rely on it"];

const firstOfBand = () => 0; // deterministic: always the band's first phrase
const HIGH_CONFIDENCE = 0.9; // used everywhere the test isn't specifically about confidence

test("scores land in the correct band, including exact boundaries", () => {
  assert.ok(NEGATIVE.includes(phraseForScore(0, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(NEGATIVE.includes(phraseForScore(0.79, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(
    LEANING_NEGATIVE.includes(phraseForScore(0.8, HIGH_CONFIDENCE, firstOfBand)),
    "0.8 must fall in the next band up, not NEGATIVE",
  );
  assert.ok(LEANING_NEGATIVE.includes(phraseForScore(1.49, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(NON_COMMITTAL.includes(phraseForScore(1.5, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(NON_COMMITTAL.includes(phraseForScore(2.49, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(LEANING_POSITIVE.includes(phraseForScore(2.5, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(LEANING_POSITIVE.includes(phraseForScore(3.19, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(POSITIVE.includes(phraseForScore(3.2, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(
    POSITIVE.includes(phraseForScore(4, HIGH_CONFIDENCE, firstOfBand)),
    "a max score of 4 must still resolve (Infinity upper band)",
  );
});

test("negative or out-of-range scores don't crash and still resolve to a phrase", () => {
  // The Score primitive is documented as 0-4, but nothing stops a malformed
  // or future response from being outside that - the function should still
  // return a real answer rather than throwing.
  assert.ok(NEGATIVE.includes(phraseForScore(-1, HIGH_CONFIDENCE, firstOfBand)));
  assert.ok(POSITIVE.includes(phraseForScore(100, HIGH_CONFIDENCE, firstOfBand)));
});

test("the random pick always stays inside the band for that score", () => {
  for (let r = 0; r < 1; r += 0.05) {
    const pick = () => r;
    assert.ok(NEGATIVE.includes(phraseForScore(0.4, HIGH_CONFIDENCE, pick)));
    assert.ok(LEANING_NEGATIVE.includes(phraseForScore(1.2, HIGH_CONFIDENCE, pick)));
    assert.ok(NON_COMMITTAL.includes(phraseForScore(2.0, HIGH_CONFIDENCE, pick)));
    assert.ok(LEANING_POSITIVE.includes(phraseForScore(2.9, HIGH_CONFIDENCE, pick)));
    assert.ok(POSITIVE.includes(phraseForScore(3.9, HIGH_CONFIDENCE, pick)));
  }
});

test("random selection can reach every phrase in a band, not just the first", () => {
  const picked = new Set<string>();
  for (let i = 0; i < NON_COMMITTAL.length; i++) {
    picked.add(phraseForScore(2.0, HIGH_CONFIDENCE, () => i / NON_COMMITTAL.length));
  }
  assert.equal(picked.size, NON_COMMITTAL.length, "every phrase in the band should be reachable");
});

test("low confidence forces the non-committal band regardless of score - regression for eval trace #9", () => {
  // Real trace: score landed in the top band but confidence was 0.5, and the
  // app said "Without a doubt" about a coin-flip. This must not happen again.
  assert.ok(NON_COMMITTAL.includes(phraseForScore(4, 0.5, firstOfBand)));
  assert.ok(NON_COMMITTAL.includes(phraseForScore(0, 0.5, firstOfBand)));
  assert.ok(NON_COMMITTAL.includes(phraseForScore(3.9, 0.45, firstOfBand)), "trace #14's confidence (0.45)");
});

test("confidence right at and above the threshold uses the real score band", () => {
  assert.ok(POSITIVE.includes(phraseForScore(4, 0.6, firstOfBand)), "0.6 is the threshold itself, not below it");
  assert.ok(POSITIVE.includes(phraseForScore(4, 0.99, firstOfBand)));
});
