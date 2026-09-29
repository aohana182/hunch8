import { test } from "node:test";
import assert from "node:assert/strict";
import { answerFontSize, wrapLines } from "./draw.ts";

// A fixed-width stand-in for measureText: 10px per character.
const measure = (s: string) => s.length * 10;

test("answer font size steps down with length, like answerFontSize() in BallComposable.kt", () => {
  assert.equal(answerFontSize("Yes"), 26);
  assert.equal(answerFontSize("Most likely"), 20);
  assert.equal(answerFontSize("You may rely on it"), 16);
  assert.equal(answerFontSize("App not\nresponding"), 16); // the newline counts, as in Kotlin
  assert.equal(answerFontSize("Daily limit\nreached"), 14);
  assert.equal(answerFontSize("Concentrate and ask again"), 14);
});

test("words wrap to the text box width", () => {
  assert.deepEqual(wrapLines("You may rely on it", 90, measure), ["You may", "rely on", "it"]);
});

test("explicit newlines always break, as in the error and limit texts", () => {
  assert.deepEqual(wrapLines("App not\nresponding", 1000, measure), ["App not", "responding"]);
});

test("a single word wider than the box stays on its own line instead of vanishing", () => {
  assert.deepEqual(wrapLines("Concentrate and", 50, measure), ["Concentrate", "and"]);
});
