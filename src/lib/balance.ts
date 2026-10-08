import type { Booking, Profile } from "./types";
export type Assignment = { name: string; color: string; userIds: string[] };
const names = [
  "Blue Sharks",
  "Teal Falcons",
  "Gold Lions",
  "Violet Wolves",
  "Slate United",
  "White Stars",
];
const colors = [
  "#3B82F6",
  "#14B8A6",
  "#F59E0B",
  "#A78BFA",
  "#475569",
  "#CBD5E1",
];
export const effectiveRating = (p: Profile) =>
  p.overall_ovr ?? p.initial_ovr ?? 50;
function score(teams: Profile[][]) {
  const strengths = teams.map((t) =>
    t.reduce((sum, p) => sum + effectiveRating(p), 0),
  );
  const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;
  const strengthVariance = strengths.reduce(
    (sum, x) => sum + (x - mean) ** 2,
    0,
  );
  const positionPenalty = teams.reduce(
    (sum, t) =>
      sum +
      ["Goalkeeper", "Defender", "Midfielder", "Forward"].reduce(
        (n, pos) =>
          n +
          Math.max(
            0,
            t.filter((p) => p.preferred_position === pos).length - 2,
          ) **
            2,
        0,
      ),
    0,
  );
  return strengthVariance + positionPenalty * 25;
}
export function balanceTeams(
  bookings: Booking[],
  count = 4,
  target = 5,
): Assignment[] {
  const players = bookings
    .filter((b) => b.status === "confirmed" && b.profile)
    .map((b) => b.profile!);
  if (players.length !== count * target)
    throw new Error(
      `Need exactly ${count * target} confirmed players; found ${players.length}.`,
    );
  const sorted = [...players].sort(
    (a, b) =>
      effectiveRating(b) - effectiveRating(a) || a.id.localeCompare(b.id),
  );
  const teams: Profile[][] = Array.from({ length: count }, () => []);
  sorted.forEach((player, i) => {
    const round = Math.floor(i / count);
    const team = round % 2 === 0 ? i % count : count - 1 - (i % count);
    teams[team].push(player);
  });
  let improved = true;
  while (improved) {
    improved = false;
    let best = score(teams);
    for (let a = 0; a < count; a++)
      for (let b = a + 1; b < count; b++)
        for (let i = 0; i < target; i++)
          for (let j = 0; j < target; j++) {
            [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
            const next = score(teams);
            if (next + 0.0001 < best) {
              best = next;
              improved = true;
            } else [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
          }
  }
  return teams.map((team, i) => ({
    name: names[i],
    color: colors[i],
    userIds: team.map((p) => p.id),
  }));
}
export function teamAverage(players: Profile[]) {
  return players.length
    ? Math.round(
        players.reduce((sum, p) => sum + effectiveRating(p), 0) /
          players.length,
      )
    : 0;
}
