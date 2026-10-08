import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  CalendarCheck,
  Home,
  Languages,
  LogOut,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { db } from "../lib/supabase";
const items = [
  { to: "/", en: "Home", ar: "الرئيسية", icon: Home },
  { to: "/booking", en: "Friday", ar: "الجمعة", icon: CalendarCheck },
  { to: "/matches", en: "Matches", ar: "المباريات", icon: Trophy },
  { to: "/players", en: "Players", ar: "اللاعبون", icon: Users },
  { to: "/profile", en: "Profile", ar: "حسابي", icon: Shield },
];
export function Layout({ children }: { children: ReactNode }) {
  const {
    profile,
    membership,
    memberships,
    selectGroup,
    language,
    toggleLanguage,
    isAdmin,
  } = useApp();
  const location = useLocation();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <img src="/brand/mark.png" alt="MAIDAN" />
            <span>
              MAIDAN <span className="muted">| ميدان</span>
            </span>
          </NavLink>
          <div className="top-actions">
            {memberships.length > 1 && (
              <select
                className="select desktop-only"
                aria-label={language === "ar" ? "المجموعة" : "Group"}
                value={membership?.group_id || ""}
                onChange={(e) => selectGroup(e.target.value)}
              >
                {memberships.map((m) => (
                  <option key={m.group_id} value={m.group_id}>
                    {m.group.name}
                  </option>
                ))}
              </select>
            )}
            {isAdmin && (
              <NavLink
                to="/admin"
                className="icon-button"
                aria-label={
                  language === "ar" ? "لوحة الإدارة" : "Admin dashboard"
                }
              >
                <Shield size={20} />
              </NavLink>
            )}
            <button
              className="icon-button"
              aria-label={
                language === "ar" ? "Switch to English" : "التبديل إلى العربية"
              }
              onClick={toggleLanguage}
            >
              <Languages size={20} />
            </button>
            <button
              className="icon-button desktop-only"
              aria-label={language === "ar" ? "تسجيل الخروج" : "Sign out"}
              onClick={() => db().auth.signOut()}
            >
              <LogOut size={20} />
            </button>
            <NavLink
              to="/profile"
              className="avatar"
              aria-label={language === "ar" ? "الملف الشخصي" : "Profile"}
            >
              {(profile?.full_name || "?")[0].toUpperCase()}
            </NavLink>
          </div>
        </div>
      </header>
      <main className="content" key={location.pathname}>
        {children}
      </main>
      <nav
        className="bottom-nav"
        aria-label={language === "ar" ? "التنقل الرئيسي" : "Primary navigation"}
      >
        {items.map(({ to, en, ar, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}>
            {({ isActive }) => (
              <>
                <Icon aria-hidden="true" />
                <span>{language === "ar" ? ar : en}</span>
                {isActive && (
                  <span className="sr-only">
                    {language === "ar" ? "الحالية" : "current"}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
