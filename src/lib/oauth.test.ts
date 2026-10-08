import { expect, it } from "vitest";
import { oauthRedirectUrl } from "./oauth";

it("returns Google users to the public production origin", () => {
  expect(
    oauthRedirectUrl({
      production: true,
      origin: "https://preview.example",
      inviteCode: "",
    }),
  ).toBe("https://maidan-cyan.vercel.app/auth");
});

it("keeps an invitation on the Google return destination", () => {
  expect(
    oauthRedirectUrl({
      production: true,
      origin: "https://preview.example",
      inviteCode: "ABCD EFGH",
    }),
  ).toBe("https://maidan-cyan.vercel.app/join?code=ABCD%20EFGH");
});
