import { Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { configured } from "./lib/supabase";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { MaqraaPage } from "./pages/MaqraaPage";
import { BookingPage } from "./pages/BookingPage";
import { PlayersPage, ProfilePage } from "./pages/PeoplePages";
import { TeamsPage } from "./pages/TeamsPage";
import { MatchesPage, MatchPage } from "./pages/MatchesPages";
import { AdminPage } from "./pages/AdminPage";

function Router() {
  const { user, loading, membership, isAdmin } = useApp();
  if (!configured)
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <img
            className="auth-logo"
            src="/brand/maidan-logo.png"
            alt="MAIDAN | ميدان"
          />
          <h1>Connect MAIDAN</h1>
          <p>
            Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then
            restart the development server.
          </p>
        </div>
      </div>
    );
  if (loading)
    return (
      <div className="auth-wrap" role="status">
        Loading MAIDAN…
      </div>
    );
  if (!user) return <AuthPage />;
  if (!membership) return <AuthPage onboarding />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/maqraa" element={<MaqraaPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/matches/:id" element={<MatchPage />} />
        <Route
          path="/admin"
          element={isAdmin ? <AdminPage /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
