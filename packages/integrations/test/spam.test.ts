import assert from "node:assert/strict";
import test from "node:test";
import { classifyText, trainNaiveBayes } from "../src/spam/bayes.ts";
import { isLikelySpam } from "../src/index.ts";

test("trainNaiveBayes separates a tiny ham and spam fixture", () => {
  const model = trainNaiveBayes([
    { text: "See you at the lab tomorrow", spam: false },
    { text: "The meetup is at the station", spam: false },
    { text: "Free prize winner claim now", spam: true },
    { text: "You won a free cash prize", spam: true },
  ]);
  const spam = classifyText("claim your free prize", model);
  const ham = classifyText("see you at the meetup", model);
  assert.equal(spam.spam, true);
  assert.ok(spam.score > ham.score);
  assert.ok(spam.reasons.includes("prize") || spam.reasons.includes("free") || spam.reasons.includes("claim"));
  assert.equal(ham.spam, false);
});

test("isLikelySpam uses the committed SMS model", () => {
  const spam = isLikelySpam("URGENT! You have won a free prize. Call now to claim your reward.");
  const ham = isLikelySpam("See you at the meetup tomorrow near the station.");
  assert.equal(spam.spam, true);
  assert.ok(spam.score >= 0.7);
  assert.ok(spam.reasons.length > 0);
  assert.equal(ham.spam, false);
  assert.ok(ham.score < 0.7);
});
