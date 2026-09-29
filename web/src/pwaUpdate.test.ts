import { test } from "node:test";
import assert from "node:assert/strict";
import { canApplyUpdate } from "./pwaUpdate.ts";

test("an update never lands while an answer is on its way", () => {
  assert.equal(canApplyUpdate({ hidden: true, busy: true, typing: false }), false);
  assert.equal(canApplyUpdate({ hidden: false, busy: true, typing: false }), false);
});

test("an idle app updates, unless the user is typing in the foreground", () => {
  assert.equal(canApplyUpdate({ hidden: false, busy: false, typing: false }), true);
  assert.equal(canApplyUpdate({ hidden: false, busy: false, typing: true }), false);
});

test("in the background it is always safe, even mid-typing (the question is saved)", () => {
  assert.equal(canApplyUpdate({ hidden: true, busy: false, typing: true }), true);
});
