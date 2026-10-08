export type DemoEventType = "goal" | "yellow" | "red" | "green";

export type DemoEvent = {
  id: string;
  teamId: string;
  playerId: string;
  type: DemoEventType;
  at: string;
  reversed: boolean;
  reason?: "Hat-trick";
};

export type DemoState = {
  status: "scheduled" | "live" | "paused" | "completed";
  refereeAssigned: boolean;
  hatTrickEnabled: boolean;
  events: DemoEvent[];
};

export const DEMO_STORAGE_KEY = "maidan_demo_match_v1";

export const demoTeams = [
  {
    id: "demo-home",
    name: "Demo North",
    nameAr: "شمال تجريبي",
    players: [
      { id: "demo-p1", name: "Demo Player 1" },
      { id: "demo-p2", name: "Demo Player 2" },
      { id: "demo-p3", name: "Demo Player 3" },
      { id: "demo-p4", name: "Demo Player 4" },
      { id: "demo-p5", name: "Demo Player 5" },
    ],
  },
  {
    id: "demo-away",
    name: "Demo South",
    nameAr: "جنوب تجريبي",
    players: [
      { id: "demo-p6", name: "Demo Player 6" },
      { id: "demo-p7", name: "Demo Player 7" },
      { id: "demo-p8", name: "Demo Player 8" },
      { id: "demo-p9", name: "Demo Player 9" },
      { id: "demo-p10", name: "Demo Player 10" },
    ],
  },
] as const;

export function initialDemoState(hatTrickEnabled = true): DemoState {
  return {
    status: "scheduled",
    refereeAssigned: false,
    hatTrickEnabled,
    events: [],
  };
}

function activeGoals(state: DemoState, playerId: string) {
  return state.events.filter(
    (event) =>
      event.playerId === playerId && event.type === "goal" && !event.reversed,
  ).length;
}

export function demoTransition(
  state: DemoState,
  action:
    | { type: "assign" }
    | { type: "revoke" }
    | { type: "start" }
    | { type: "pause" }
    | { type: "resume" }
    | { type: "complete" }
    | { type: "hatTrick"; enabled: boolean }
    | {
        type: "record";
        teamId: string;
        playerId: string;
        eventType: DemoEventType;
      }
    | { type: "reverse"; eventId: string }
    | { type: "reset" },
): DemoState {
  if (action.type === "reset") return initialDemoState(state.hatTrickEnabled);
  if (action.type === "assign") return { ...state, refereeAssigned: true };
  if (action.type === "revoke") return { ...state, refereeAssigned: false };
  if (action.type === "hatTrick")
    return { ...state, hatTrickEnabled: action.enabled };
  if (!state.refereeAssigned) {
    throw new Error("Assigned official required");
  }
  if (action.type === "start" || action.type === "resume") {
    if (state.status !== "scheduled" && state.status !== "paused") {
      throw new Error("Invalid match transition");
    }
    return { ...state, status: "live" };
  }
  if (action.type === "pause") {
    if (state.status !== "live") throw new Error("Invalid match transition");
    return { ...state, status: "paused" };
  }
  if (action.type === "complete") {
    if (state.status !== "live" && state.status !== "paused") {
      throw new Error("Invalid match transition");
    }
    return { ...state, status: "completed" };
  }
  if (action.type === "record") {
    if (state.status !== "live") {
      throw new Error("Live match and assigned official required");
    }
    const team = demoTeams.find((item) => item.id === action.teamId);
    if (!team?.players.some((player) => player.id === action.playerId)) {
      throw new Error("Player is not on this match team");
    }
    const recorded: DemoEvent = {
      id: `demo-${state.events.length + 1}-${action.eventType}`,
      teamId: action.teamId,
      playerId: action.playerId,
      type: action.eventType,
      at: new Date().toISOString(),
      reversed: false,
    };
    const events = [...state.events, recorded];
    const next = { ...state, events };
    if (
      action.eventType === "goal" &&
      state.hatTrickEnabled &&
      activeGoals(next, action.playerId) === 3 &&
      !next.events.some(
        (event) =>
          event.playerId === action.playerId &&
          event.type === "green" &&
          event.reason === "Hat-trick" &&
          !event.reversed,
      )
    ) {
      events.push({
        id: `demo-hat-${action.playerId}-${events.length}`,
        teamId: action.teamId,
        playerId: action.playerId,
        type: "green",
        at: recorded.at,
        reversed: false,
        reason: "Hat-trick",
      });
    }
    return { ...state, events };
  }
  const target = state.events.find((event) => event.id === action.eventId);
  if (!target || target.reversed) {
    throw new Error("Assigned official and active event required");
  }
  const events = state.events.map((event) =>
    event.id === target.id ? { ...event, reversed: true } : event,
  );
  const next = { ...state, events };
  if (target.type === "goal" && activeGoals(next, target.playerId) < 3) {
    return {
      ...next,
      events: events.map((event) =>
        event.playerId === target.playerId &&
        event.type === "green" &&
        event.reason === "Hat-trick" &&
        !event.reversed
          ? { ...event, reversed: true }
          : event,
      ),
    };
  }
  return next;
}

export function loadDemoState(): DemoState {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return initialDemoState();
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed || !Array.isArray(parsed.events)) return initialDemoState();
    return parsed;
  } catch {
    return initialDemoState();
  }
}

export function saveDemoState(state: DemoState) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}
