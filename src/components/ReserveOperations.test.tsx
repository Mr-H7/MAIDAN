// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReserveOperations } from "./ReserveOperations";
import type { Match, Profile, Team } from "../lib/types";

const mocks = vi.hoisted(() => ({
  getReservePlayers: vi.fn(),
  getReserveTeamPlayers: vi.fn(),
  getTeamPlayers: vi.fn(),
  createAdditionalMatch: vi.fn(),
  useApp: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  getReservePlayers: mocks.getReservePlayers,
  getReserveTeamPlayers: mocks.getReserveTeamPlayers,
  getTeamPlayers: mocks.getTeamPlayers,
  createAdditionalMatch: mocks.createAdditionalMatch,
  createReservePair: vi.fn(),
  createReserveTeam: vi.fn(),
  registerReservePlayer: vi.fn(),
}));
vi.mock("../context/AppContext", () => ({ useApp: mocks.useApp }));

const sessionId = "00000000-0000-0000-0000-000000000001";
const mainTeams = Array.from({ length: 4 }, (_, i) => ({
  id: `main-${i}`,
  group_id: "group",
  session_id: sessionId,
  name: `Main ${i + 1}`,
  color: "#3B82F6",
  status: "published",
  kind: "main",
})) as Team[];
const reserveTeams = Array.from({ length: 2 }, (_, i) => ({
  ...mainTeams[0],
  id: `reserve-${i}`,
  name: `Reserve ${i + 1}`,
  kind: "reserve",
})) as Team[];
const matches = Array.from({ length: 6 }, (_, i) => ({
  id: `match-${i}`,
  group_id: "group",
  session_id: sessionId,
  home_team_id: mainTeams[i % 4].id,
  away_team_id: mainTeams[(i + 1) % 4].id,
  order_no: i + 1,
  status: "scheduled",
  duration_seconds: 600,
  match_type: "main_main",
  elapsed_seconds: 0,
  started_at: null,
})) as Match[];
const referee = { id: "ref-1", full_name: "Available Referee" } as Profile;

beforeEach(() => {
  mocks.useApp.mockReturnValue({ language: "en" });
  mocks.getReservePlayers.mockResolvedValue([]);
  mocks.getReserveTeamPlayers.mockResolvedValue([]);
  mocks.getTeamPlayers.mockResolvedValue([]);
  mocks.createAdditionalMatch.mockResolvedValue("new-match");
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("requires informed approval before a reserve fixture moves a main fixture", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReserveOperations
        sessionId={sessionId}
        sessionStartsAt="2026-10-09T19:00:00Z"
        sessionEndsAt="2026-10-09T21:00:00Z"
        teams={[...mainTeams, ...reserveTeams]}
        matches={matches}
        players={[referee]}
        bookings={[]}
        officialIds={new Set([referee.id])}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Match type"), {
    target: { value: "reserve_main" },
  });
  fireEvent.change(screen.getByLabelText("Home team"), {
    target: { value: reserveTeams[0].id },
  });
  fireEvent.change(screen.getByLabelText("Away team"), {
    target: { value: mainTeams[0].id },
  });
  fireEvent.change(screen.getByLabelText("Position in schedule"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Head referee"), {
    target: { value: referee.id },
  });
  const save = screen.getByRole("button", {
    name: "Approve and save fixture",
  }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  expect(screen.getByText(/delays a scheduled main fixture/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText("I approve this schedule change"));
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() =>
    expect(mocks.createAdditionalMatch).toHaveBeenCalledWith({
      sessionId,
      type: "reserve_main",
      homeId: reserveTeams[0].id,
      awayId: mainTeams[0].id,
      position: 1,
      refereeId: referee.id,
      acknowledgeMainDelay: true,
    }),
  );
});
