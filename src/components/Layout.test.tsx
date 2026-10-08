// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "./Layout";

const mocks = vi.hoisted(() => ({
  useApp: vi.fn(),
  selectGroup: vi.fn(),
  toggleLanguage: vi.fn(),
}));
vi.mock("../context/AppContext", () => ({ useApp: mocks.useApp }));
vi.mock("../lib/supabase", () => ({ db: vi.fn() }));

beforeEach(() => {
  mocks.useApp.mockReturnValue({
    profile: { full_name: "Fixture Player" },
    membership: { group_id: "group-a" },
    memberships: [
      { group_id: "group-a", group: { name: "Group A" } },
      { group_id: "group-b", group: { name: "Group B" } },
    ],
    selectGroup: mocks.selectGroup,
    language: "ar",
    toggleLanguage: mocks.toggleLanguage,
    isAdmin: false,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("offers keyboard-accessible Arabic navigation and group switching", () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Layout>
        <p>Home content</p>
      </Layout>
    </MemoryRouter>,
  );
  const nav = screen.getByRole("navigation", { name: "التنقل الرئيسي" });
  expect(within(nav).getAllByRole("link")).toHaveLength(5);
  const booking = within(nav).getByRole("link", { name: "الجمعة" });
  expect(booking.getAttribute("href")).toBe("/booking");
  fireEvent.click(booking);
  expect(booking.classList.contains("active")).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "المجموعة" }), {
    target: { value: "group-b" },
  });
  expect(mocks.selectGroup).toHaveBeenCalledWith("group-b");
  fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
  expect(mocks.toggleLanguage).toHaveBeenCalledOnce();
});
