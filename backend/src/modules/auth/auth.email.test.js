import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResetLink,
  buildResetPasswordEmailHtml,
  buildResetPasswordEmailText,
} from "./auth.email.js";

test("buildResetLink uses base URL and encodes token", () => {
  const link = buildResetLink("http://localhost:5173/", "token=abc");
  assert.equal(
    link,
    "http://localhost:5173/reset-password?token=token%3Dabc",
  );
});

test("reset password email text includes link and name", () => {
  const link = "http://localhost:5173/reset-password?token=abc";
  const text = buildResetPasswordEmailText({ fullName: "Alex", link });
  assert.ok(text.includes("Hi Alex"));
  assert.ok(text.includes(link));
});

test("reset password email html includes link", () => {
  const link = "http://localhost:5173/reset-password?token=abc";
  const html = buildResetPasswordEmailHtml({ fullName: "Alex", link });
  assert.ok(html.includes(link));
});
