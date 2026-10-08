import { describe, expect, it } from "vitest";
import { balanceTeams, effectiveRating } from "./balance";
import type { Booking, Profile } from "./types";
const players = Array.from({ length: 20 }, (_, i) => {
  const profile: Profile = {
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    full_name: `Player ${i + 1}`,
    preferred_position: ["Goalkeeper", "Defender", "Midfielder", "Forward"][
      i % 4
    ],
    initial_ovr: 50 + i * 2,
    self_ovr: null,
    created_at: "2026-01-01T00:00:00Z",
  };
  return {
    id: profile.id,
    group_id: "g",
    session_id: "s",
    user_id: profile.id,
    status: "confirmed",
    created_at: "2026-01-01T00:00:00Z",
    profile,
  } as Booking;
});
describe("team balance", () => {
  it("assigns every confirmed player once with repeatable results", () => {
    const first = balanceTeams(players);
    const second = balanceTeams([...players].reverse());
    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    expect(first.every((team) => team.userIds.length === 5)).toBe(true);
    expect(new Set(first.flatMap((team) => team.userIds)).size).toBe(20);
  });
  it("keeps total assessed OVR close across teams", () => {
    const teams = balanceTeams(players);
    const rating = new Map(
      players.map((p) => [p.user_id, p.profile!.initial_ovr!]),
    );
    const sums = teams.map((t) =>
      t.userIds.reduce((sum, id) => sum + rating.get(id)!, 0),
    );
    expect(Math.max(...sums) - Math.min(...sums)).toBeLessThanOrEqual(12);
  });
  it("rejects an incomplete confirmed roster", () =>
    expect(() => balanceTeams(players.slice(1))).toThrow(/exactly 20/));
  it("uses community OVR before initial assessment and keeps self assessment separate", () => {
    const profile = {
      ...players[0].profile!,
      overall_ovr: 82,
      initial_ovr: 60,
      self_ovr: 99,
    };
    expect(effectiveRating(profile)).toBe(82);
    expect(effectiveRating({ ...profile, overall_ovr: null })).toBe(60);
    expect(
      effectiveRating({ ...profile, overall_ovr: null, initial_ovr: null }),
    ).toBe(50);
  });
});
