import { expect, it } from "vitest";
import { signupFailureMessage } from "./authError";

it("explains the hourly confirmation-email limit in Arabic", () => {
  const message = signupFailureMessage(
    {
      status: 429,
      code: "over_email_send_rate_limit",
      message: "Email rate limit exceeded",
    },
    "ar",
  );
  expect(message).toContain("انتظر حوالي ساعة");
  expect(message).not.toContain("rate limit");
});

it("explains the one-minute confirmation window separately", () => {
  const message = signupFailureMessage(
    {
      status: 429,
      code: "over_email_send_rate_limit",
      message: "For security purposes, you can only request this after 51 seconds.",
    },
    "ar",
  );
  expect(message).toContain("دقيقة واحدة");
});
