export type MatchType = "main_main" | "reserve_reserve" | "reserve_main";
export type TeamKind = "main" | "reserve";

export const matchDuration: Record<MatchType, number> = {
  main_main: 600,
  reserve_reserve: 480,
  reserve_main: 480,
};

export function validSides(type: MatchType, home: TeamKind, away: TeamKind) {
  return type === "main_main"
    ? home === "main" && away === "main"
    : type === "reserve_reserve"
      ? home === "reserve" && away === "reserve"
      : (home === "reserve" && away === "main") ||
        (home === "main" && away === "reserve");
}

export type ReserveCandidate = {
  id: string;
  estimated_ovr: number | null;
  preferred_position: string | null;
};

// Deterministic suggestion only. The server validates every saved assignment.
export function balanceReservePair(
  players: ReserveCandidate[],
): [string[], string[]] {
  if (players.length !== 10 || new Set(players.map((p) => p.id)).size !== 10)
    throw new Error("Select ten distinct reserve players.");
  const sorted = [...players].sort(
    (a, b) =>
      (b.estimated_ovr ?? 50) - (a.estimated_ovr ?? 50) ||
      a.id.localeCompare(b.id),
  );
  const teams: ReserveCandidate[][] = [[], []];
  sorted.forEach((player, i) =>
    teams[Math.floor(i / 2) % 2 === 0 ? i % 2 : 1 - (i % 2)].push(player),
  );
  const score = () => {
    const strengths = teams.map((team) =>
      team.reduce((sum, p) => sum + (p.estimated_ovr ?? 50), 0),
    );
    const positionPenalty = teams.reduce(
      (sum, team) =>
        sum +
        ["Goalkeeper", "Defender", "Midfielder", "Forward"].reduce(
          (total, position) =>
            total +
            Math.max(
              0,
              team.filter((p) => p.preferred_position === position).length - 2,
            ) **
              2,
          0,
        ),
      0,
    );
    return (strengths[0] - strengths[1]) ** 2 + positionPenalty * 25;
  };
  let improved = true;
  while (improved) {
    improved = false;
    let best = score();
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        [teams[0][i], teams[1][j]] = [teams[1][j], teams[0][i]];
        const candidate = score();
        if (candidate < best) {
          best = candidate;
          improved = true;
        } else [teams[0][i], teams[1][j]] = [teams[1][j], teams[0][i]];
      }
  }
  return [teams[0].map((p) => p.id), teams[1].map((p) => p.id)];
}

export function elapsedSeconds(
  match: {
    status: string;
    elapsed_seconds: number;
    started_at: string | null;
    duration_seconds: number;
  },
  now: number,
) {
  const running =
    match.status === "live" && match.started_at
      ? Math.max(0, (now - Date.parse(match.started_at)) / 1000)
      : 0;
  return Math.min(
    match.duration_seconds,
    Math.max(0, match.elapsed_seconds + running),
  );
}

export function displayClock(elapsed: number, duration: number) {
  if (elapsed >= duration) return "FULL TIME";
  const seconds = Math.floor(elapsed);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function remainingSessionSeconds(
  startsAt: string,
  endsAt: string,
  fixtureDurations: number[],
) {
  return Math.max(
    0,
    (Date.parse(endsAt) - Date.parse(startsAt)) / 1000 -
      fixtureDurations.reduce((sum, seconds) => sum + seconds, 0),
  );
}

export type CardGoalTotals = {
  goals: number;
  yellow: number;
  red: number;
  green: number;
};
export function summarizeMatchEvents(
  events: {
    event_type: string;
    match_type: MatchType;
    reversed_at?: string | null;
  }[],
) {
  const standard: CardGoalTotals = { goals: 0, yellow: 0, red: 0, green: 0 };
  const reserve: CardGoalTotals = { goals: 0, yellow: 0, red: 0, green: 0 };
  for (const event of events) {
    if (event.reversed_at) continue;
    const key = event.event_type === "goal" ? "goals" : event.event_type;
    const bucket = event.match_type === "main_main" ? standard : reserve;
    if (key in bucket) bucket[key as keyof CardGoalTotals]++;
  }
  const combined: CardGoalTotals = {
    goals: standard.goals + reserve.goals,
    yellow: standard.yellow + reserve.yellow,
    red: standard.red + reserve.red,
    green: standard.green + reserve.green,
  };
  return { standard, reserve, combined };
}
