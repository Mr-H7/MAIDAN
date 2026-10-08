// @vitest-environment jsdom
import { expect, it } from "vitest";
import {
  clearPendingInvite,
  formatInviteCode,
  inviteCodeFromLocation,
  inviteLink,
  normalizeInviteCode,
  rememberInviteFromLocation,
} from "./invites";

it("normalizes a shareable invite without keeping punctuation", () => {
  expect(normalizeInviteCode(" abcd-efgh-jklm-npqr-stuv ")).toBe(
    "ABCDEFGHJKLMNPQRSTUV",
  );
  expect(formatInviteCode("ABCDEFGHJKLMNPQRSTUV")).toBe(
    "ABCD-EFGH-JKLM-NPQR-STUV",
  );
  expect(inviteLink("ABCD-EFGH", "https://maidan-cyan.vercel.app")).toBe(
    "https://maidan-cyan.vercel.app/join?code=ABCDEFGH",
  );
});

it("remembers an invite only from the join route", () => {
  localStorage.clear();
  const ignored = {
    pathname: "/admin",
    search: "?code=ABCDEFGHJKLMNPQRSTUV",
  } as Location;
  expect(inviteCodeFromLocation(ignored)).toBe("");
  const join = {
    pathname: "/join",
    search: "?code=abcd-efgh-jklm-npqr-stuv",
  } as Location;
  expect(rememberInviteFromLocation(join)).toBe("ABCDEFGHJKLMNPQRSTUV");
  clearPendingInvite();
  expect(localStorage.getItem("maidan_pending_invite")).toBeNull();
});
