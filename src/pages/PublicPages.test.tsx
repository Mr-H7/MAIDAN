// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PublicHome, PrivacyPage, TermsPage } from "./PublicPages";

vi.mock("../context/AppContext", () => ({
  useApp: () => ({
    language: "ar",
    toggleLanguage: vi.fn(),
  }),
}));

it("publishes the Arabic information page and legal links while signed out", () => {
  render(
    <MemoryRouter>
      <PublicHome />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "ميدان لمجموعتك الكروية" }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "سياسة الخصوصية" }).getAttribute("href")).toBe(
    "/privacy",
  );
  expect(screen.getByRole("link", { name: "شروط الخدمة" }).getAttribute("href")).toBe(
    "/terms",
  );
});

it("renders the privacy policy and terms in Arabic", () => {
  const { unmount } = render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "سياسة الخصوصية" })).toBeTruthy();
  expect(screen.getByText(/لا نستلم كلمة مرور Google/)).toBeTruthy();
  unmount();
  render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "شروط الخدمة" })).toBeTruthy();
  expect(screen.getByText(/دور لاعب فقط/)).toBeTruthy();
});
