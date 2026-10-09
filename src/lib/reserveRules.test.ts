import { describe, expect, it } from "vitest";
import {
  balanceReservePair,
  displayClock,
  elapsedSeconds,
  matchDuration,
  remainingSessionSeconds,
  summarizeMatchEvents,
  validSides,
} from "./reserveRules";

describe("v1.1 reserve match rules", () => {
  it("uses 600/480/480 seconds and rejects mismatched sides", () => {
    expect(matchDuration).toEqual({
      main_main: 600,
      reserve_reserve: 480,
      reserve_main: 480,
    });
    expect(validSides("main_main", "main", "main")).toBe(true);
    expect(validSides("reserve_reserve", "reserve", "reserve")).toBe(true);
    expect(validSides("reserve_main", "main", "reserve")).toBe(true);
    expect(validSides("reserve_main", "reserve", "main")).toBe(true);
    expect(validSides("reserve_main", "main", "main")).toBe(false);
  });
  it("requires ten distinct reserves and gives a repeatable balanced suggestion", () => {
    const players = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      estimated_ovr: 42 + i * 4,
      preferred_position: ["Goalkeeper", "Defender", "Midfielder", "Forward"][
        i % 4
      ],
    }));
    expect(() => balanceReservePair(players.slice(1))).toThrow(/ten distinct/);
    expect(() => balanceReservePair([...players.slice(1), players[1]])).toThrow(
      /ten distinct/,
    );
    const first = balanceReservePair(players);
    expect(balanceReservePair([...players].reverse())).toEqual(first);
    expect(first.map((team) => team.length)).toEqual([5, 5]);
    expect(new Set(first.flat()).size).toBe(10);
    const sums = first.map((team) =>
      team.reduce((sum, id) => sum + players[Number(id)].estimated_ovr, 0),
    );
    expect(Math.abs(sums[0] - sums[1])).toBeLessThanOrEqual(8);
  });
  it("counts up from persisted time through pause and full time", () => {
    const match = {
      status: "live",
      elapsed_seconds: 120,
      started_at: "2026-10-09T20:00:00Z",
      duration_seconds: 480,
    };
    expect(
      displayClock(
        elapsedSeconds(match, Date.parse("2026-10-09T20:01:00Z")),
        480,
      ),
    ).toBe("03:00");
    expect(
      elapsedSeconds(
        { ...match, status: "paused" },
        Date.parse("2026-10-09T20:04:00Z"),
      ),
    ).toBe(120);
    expect(
      displayClock(
        elapsedSeconds(match, Date.parse("2026-10-09T20:08:00Z")),
        480,
      ),
    ).toBe("FULL TIME");
  });
  it("keeps standard, reserve, and combined event totals separate", () => {
    const totals = summarizeMatchEvents([
      { event_type: "goal", match_type: "main_main" },
      { event_type: "goal", match_type: "reserve_main" },
      { event_type: "yellow", match_type: "reserve_reserve" },
      {
        event_type: "red",
        match_type: "main_main",
        reversed_at: "2026-10-09T21:00:00Z",
      },
    ]);
    expect(totals.standard.goals).toBe(1);
    expect(totals.reserve).toMatchObject({ goals: 1, yellow: 1 });
    expect(totals.combined).toMatchObject({ goals: 2, yellow: 1, red: 0 });
  });
  it("keeps complete fixtures inside the session time budget", () => {
    expect(
      remainingSessionSeconds(
        "2026-10-09T19:00:00Z",
        "2026-10-09T21:00:00Z",
        [600, 600, 600, 600, 600, 600],
      ),
    ).toBe(3600);
    expect(
      remainingSessionSeconds(
        "2026-10-09T19:00:00Z",
        "2026-10-09T20:00:00Z",
        [600, 600, 600, 600, 600, 600],
      ),
    ).toBe(0);
  });
});
