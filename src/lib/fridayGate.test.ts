import { expect, it } from "vitest";
import { currentFridayStep } from "./fridayGate";

const base = {
  hasSession: true,
  sessionStatus: "open" as const,
  confirmedCount: 0,
  teamCount: 0,
  publishedTeamCount: 0,
  matchCount: 0,
};

it("asks for a Friday session before any later match step", () => {
  expect(currentFridayStep({ ...base, hasSession: false })?.id).toBe("session");
});

it("asks for 20 confirmations before locking", () => {
  expect(currentFridayStep({ ...base, confirmedCount: 12 })?.id).toBe(
    "confirmations",
  );
});

it("asks to lock once 20 players are confirmed", () => {
  expect(currentFridayStep({ ...base, confirmedCount: 20 })?.id).toBe("lock");
});

it("explains a locked roster that does not have 20 players", () => {
  const step = currentFridayStep({
    ...base,
    sessionStatus: "locked",
    confirmedCount: 8,
  });
  expect(step?.id).toBe("confirmations");
  expect(step?.actionEn).toBe("Reopen roster");
});

it("walks draft, publish, then fixtures", () => {
  expect(
    currentFridayStep({
      ...base,
      sessionStatus: "locked",
      confirmedCount: 20,
    })?.id,
  ).toBe("draft");
  expect(
    currentFridayStep({
      ...base,
      sessionStatus: "locked",
      confirmedCount: 20,
      teamCount: 4,
    })?.id,
  ).toBe("publish");
  expect(
    currentFridayStep({
      ...base,
      sessionStatus: "locked",
      confirmedCount: 20,
      teamCount: 4,
      publishedTeamCount: 4,
    })?.id,
  ).toBe("fixtures");
  expect(
    currentFridayStep({
      ...base,
      sessionStatus: "locked",
      confirmedCount: 20,
      teamCount: 4,
      publishedTeamCount: 4,
      matchCount: 6,
    }),
  ).toBeNull();
});
