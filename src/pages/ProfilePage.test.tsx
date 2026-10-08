// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePage } from "./PeoplePages";

const mocks = vi.hoisted(() => ({
  getPlayerStats: vi.fn(),
  useApp: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  getPlayerStats: mocks.getPlayerStats,
  getPlayers: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("../context/AppContext", () => ({ useApp: mocks.useApp }));
vi.mock("../lib/supabase", () => ({ db: vi.fn() }));

const userId = "00000000-0000-0000-0000-000000000001";
const groupId = "00000000-0000-0000-0000-000000000002";
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.useApp.mockReturnValue({
    user: { id: userId, email: "fixture@example.com" },
    profile: {
      id: userId,
      full_name: "Fixture Player",
      self_ovr: null,
      preferred_position: null,
    },
    memberships: [
      { group_id: groupId, role: "player", group: { name: "Fixture Group" } },
    ],
    groupId,
    selectGroup: vi.fn(),
    language: "ar",
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("profile statistics card", () => {
  it("renders scoped event counts and the independent community rating in Arabic", async () => {
    mocks.getPlayerStats.mockResolvedValue({
      goals: 3,
      yellow: 1,
      red: 0,
      green: 1,
      communityOvr: 90,
      ratingCount: 1,
    });
    show();
    const card = screen
      .getByRole("heading", { name: "إحصاءاتي" })
      .closest(".card")!;
    await waitFor(() =>
      expect(within(card as HTMLElement).getByText("90")).toBeTruthy(),
    );
    expect(mocks.getPlayerStats).toHaveBeenCalledWith(groupId, userId);
    expect(
      within(card as HTMLElement).getByText("الأهداف").parentElement
        ?.textContent,
    ).toContain("3");
    expect(
      within(card as HTMLElement).getByText("البطاقات الخضراء").parentElement
        ?.textContent,
    ).toContain("1");
    expect(
      within(card as HTMLElement).getByText("البطاقات الحمراء").parentElement
        ?.textContent,
    ).toContain("0");
    expect(
      within(card as HTMLElement).getByText("تقييم المجتمع").parentElement
        ?.textContent,
    ).toContain("90");
  });

  it("shows an error instead of made-up statistics when the query fails", async () => {
    mocks.getPlayerStats.mockRejectedValue(new Error("Unavailable"));
    show();
    expect(await screen.findByText("تعذّر تحميل الإحصاءات.")).toBeTruthy();
    expect(screen.queryByText("الأهداف")).toBeNull();
  });
});
