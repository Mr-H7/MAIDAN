// @vitest-environment jsdom
import { expect, it } from "vitest";
import {
  DEMO_STORAGE_KEY,
  demoTransition,
  initialDemoState,
  loadDemoState,
  saveDemoState,
} from "./demoMatch";

const home = "demo-home";
const player = "demo-p1";

it("hides recording until a referee is assigned and the match is live", () => {
  const assigned = demoTransition(initialDemoState(), { type: "assign" });
  expect(() =>
    demoTransition(assigned, {
      type: "record",
      teamId: home,
      playerId: player,
      eventType: "yellow",
    }),
  ).toThrow(/Live match/);
  const live = demoTransition(assigned, { type: "start" });
  const card = demoTransition(live, {
    type: "record",
    teamId: home,
    playerId: player,
    eventType: "yellow",
  });
  expect(card.events.map((event) => event.type)).toEqual(["yellow"]);
  expect(() =>
    demoTransition(initialDemoState(), { type: "start" }),
  ).toThrow(/Assigned official/);
});

it("persists yellow, red, green, and a hat-trick reward only inside the demo store", () => {
  let state = demoTransition(initialDemoState(true), { type: "assign" });
  state = demoTransition(state, { type: "start" });
  for (const eventType of ["yellow", "red", "green"] as const) {
    state = demoTransition(state, {
      type: "record",
      teamId: home,
      playerId: player,
      eventType,
    });
  }
  for (let goal = 0; goal < 3; goal += 1) {
    state = demoTransition(state, {
      type: "record",
      teamId: home,
      playerId: player,
      eventType: "goal",
    });
  }
  expect(state.events.filter((event) => !event.reversed).map((event) => event.type)).toEqual([
    "yellow",
    "red",
    "green",
    "goal",
    "goal",
    "goal",
    "green",
  ]);
  expect(state.events.at(-1)?.reason).toBe("Hat-trick");
  let withoutReward = demoTransition(initialDemoState(false), {
    type: "assign",
  });
  withoutReward = demoTransition(withoutReward, { type: "start" });
  for (let goal = 0; goal < 3; goal += 1) {
    withoutReward = demoTransition(withoutReward, {
      type: "record",
      teamId: home,
      playerId: player,
      eventType: "goal",
    });
  }
  expect(withoutReward.events.some((event) => event.reason === "Hat-trick")).toBe(
    false,
  );
  localStorage.clear();
  saveDemoState(state);
  expect(localStorage.getItem(DEMO_STORAGE_KEY)).toContain("Hat-trick");
  expect(loadDemoState().events).toHaveLength(state.events.length);
  expect(JSON.stringify(loadDemoState())).not.toContain("player_ratings");
});

it("reverses a hat-trick green card when the third goal is reversed", () => {
  let state = demoTransition(initialDemoState(true), { type: "assign" });
  state = demoTransition(state, { type: "start" });
  for (let goal = 0; goal < 3; goal += 1) {
    state = demoTransition(state, {
      type: "record",
      teamId: home,
      playerId: player,
      eventType: "goal",
    });
  }
  const thirdGoal = state.events.filter((event) => event.type === "goal").at(-1)!;
  state = demoTransition(state, { type: "reverse", eventId: thirdGoal.id });
  expect(
    state.events.filter((event) => event.type === "goal" && !event.reversed),
  ).toHaveLength(2);
  expect(
    state.events.find((event) => event.reason === "Hat-trick")?.reversed,
  ).toBe(true);
});
