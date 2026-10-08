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
import { MemoryRouter } from "react-router-dom";
import App from "./App";

const mocks = vi.hoisted(() => ({
  getMemberships: vi.fn(),
  getProfile: vi.fn(),
  getPlayerStats: vi.fn(),
  createGroup: vi.fn(),
  db: vi.fn(),
}));
vi.mock("./lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/api")>()),
  getMemberships: mocks.getMemberships,
  getProfile: mocks.getProfile,
  getPlayerStats: mocks.getPlayerStats,
  createGroup: mocks.createGroup,
}));
vi.mock("./lib/supabase", () => ({ configured: true, db: mocks.db }));

const userId = "00000000-0000-0000-0000-000000000001";
const groupId = "00000000-0000-0000-0000-000000000002";
const group = {
  id: groupId,
  name: "Fixture Group",
  timezone: "Africa/Cairo",
  capacity: 20,
  rating_window_hours: 24,
  green_hat_trick_enabled: true,
  green_redemption_enabled: false,
  created_by: userId,
};
const member = (role: "group_admin" | "player") => ({
  group_id: groupId,
  user_id: userId,
  status: "active",
  group,
  role,
});
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/profile"]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.db.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, email: "fixture@example.invalid" } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn(),
    },
  });
  mocks.getProfile.mockResolvedValue({
    id: userId,
    full_name: "Fixture Player",
    preferred_position: null,
    self_ovr: null,
    created_at: "2026-10-08T00:00:00Z",
  });
  mocks.getPlayerStats.mockResolvedValue({
    goals: 0,
    yellow: 0,
    red: 0,
    green: 0,
    communityOvr: null,
    ratingCount: 0,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("moves a new user from onboarding to their new group and profile", async () => {
  let memberships: ReturnType<typeof member>[] = [];
  mocks.getMemberships.mockImplementation(async () => memberships);
  mocks.createGroup.mockImplementation(async () => {
    memberships = [member("group_admin")];
    return group;
  });
  show();
  expect(
    await screen.findByRole("heading", { name: "ابدأ مجموعتك" }),
  ).toBeTruthy();
  const create = screen.getByRole("button", { name: "إنشاء المجموعة" });
  expect((create as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("اسم المجموعة"), {
    target: { value: "  Fixture Group  " },
  });
  fireEvent.click(create);
  await screen.findByRole("heading", { name: "ملف اللاعب" });
  expect(mocks.createGroup).toHaveBeenCalledWith("Fixture Group", userId);
  expect(screen.getByRole("link", { name: "لوحة الإدارة" })).toBeTruthy();
  await waitFor(() =>
    expect(mocks.getPlayerStats).toHaveBeenCalledWith(groupId, userId),
  );
});

it("lets an existing account enter a group after admin membership is refreshed", async () => {
  let memberships: ReturnType<typeof member>[] = [];
  mocks.getMemberships.mockImplementation(async () => memberships);
  show();
  await screen.findByRole("heading", { name: "ابدأ مجموعتك" });
  memberships = [member("player")];
  fireEvent.click(screen.getByRole("button", { name: "تحديث مجموعاتي" }));
  await screen.findByRole("heading", { name: "ملف اللاعب" });
  expect(screen.queryByRole("link", { name: "لوحة الإدارة" })).toBeNull();
  await waitFor(() =>
    expect(mocks.getPlayerStats).toHaveBeenCalledWith(groupId, userId),
  );
});
