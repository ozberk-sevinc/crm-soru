import { test } from "node:test";
import assert from "node:assert/strict";
import { numericAnswer, hasAnswer } from "./answer.ts";
import type { Question } from "./types.ts";

test("numeric answers accept decimal commas without turning an empty field into zero", () => {
  assert.equal(numericAnswer(" 0,5 "), 0.5);
  assert.equal(numericAnswer("-2.75"), -2.75);
  assert.equal(numericAnswer("0"), 0);
  for (const value of ["", " ", "Infinity", "NaN", "1e999", "3/4", "1.2.3"])
    assert.equal(numericAnswer(value), undefined);
});
test("choice submissions require an actual option in the question", () => {
  const q = {
    type: "single_choice",
    options: [{ id: "B", text: "Answer" }],
  } as Question;
  assert.equal(hasAnswer(q, "B", ""), true);
  assert.equal(hasAnswer(q, "A", ""), false);
});
