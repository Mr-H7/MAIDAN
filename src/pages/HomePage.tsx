import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, ArrowUpRight, Users } from "lucide-react";
import { useApp } from "../context/AppContext";
import { getFootball, getMaqraa, getTeams } from "../lib/api";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
function date(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}
export function HomePage() {
  const { profile, membership, groupId, language, isAdmin } = useApp();
  const timeZone = membership?.group.timezone || "Africa/Cairo";
  const locale = language === "ar" ? "ar" : "en";
  const football = useQuery({
    queryKey: ["football", groupId],
    queryFn: () => getFootball(groupId!),
    enabled: !!groupId,
  });
  const maqraa = useQuery({
    queryKey: ["maqraa", groupId],
    queryFn: () => getMaqraa(groupId!),
    enabled: !!groupId,
  });
  const nextFootball = football.data?.find(
    (x) => new Date(x.ends_at) > new Date(),
  );
  const nextMaqraa = maqraa.data?.find(
    (x) => new Date(x.starts_at) > new Date(Date.now() - 2 * 60 * 60 * 1000),
  );
  const teams = useQuery({
    queryKey: ["teams", nextFootball?.id],
    queryFn: () => getTeams(nextFootball!.id),
    enabled: !!nextFootball,
  });
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">{membership?.group.name}</span>
        <h1 className="page-title">
          {language === "ar"
            ? `مرحباً ${profile?.full_name?.split(" ")[0] || ""}`
            : `Hi ${profile?.full_name?.split(" ")[0] || ""}`}
        </h1>
        <p className="muted">
          {language === "ar"
            ? "هيا نواصل اللعب."
            : "Let's keep the game going."}
        </p>
      </div>
      <div className="hero-card">
        <span className="pill">
          {nextFootball?.status === "locked"
            ? "Roster locked"
            : "Friday football"}
        </span>
        <h2>
          {nextFootball
            ? "Next Friday session"
            : "Your next match day starts here"}
        </h2>
        <p>
          {nextFootball
            ? date(nextFootball.starts_at, locale, timeZone)
            : "Ask a group admin to schedule this week’s sessions."}
        </p>
        <div className="actions">
          <Link to="/booking">
            <ActionButton arrow>View booking</ActionButton>
          </Link>
          {isAdmin && (
            <Link to="/admin">
              <ActionButton variant="quiet">Manage</ActionButton>
            </Link>
          )}
        </div>
      </div>
      <div className="grid-two">
        <section>
          <div className="row">
            <h2 className="section-title">Maqraa</h2>
            <Link
              to="/maqraa"
              className="tiny"
              style={{ color: "var(--blue)" }}
            >
              See all <ArrowUpRight size={13} />
            </Link>
          </div>
          <Card>
            {nextMaqraa ? (
              <>
                <div className="row">
                  <div className="row-start">
                    <CalendarDays size={18} />
                    <strong>
                      {date(nextMaqraa.starts_at, locale, timeZone)}
                    </strong>
                  </div>
                  <span className="pill">{nextMaqraa.status}</span>
                </div>
                <h3>{nextMaqraa.title}</h3>
                <Link to="/maqraa">
                  <ActionButton variant="secondary">Check in</ActionButton>
                </Link>
              </>
            ) : (
              <div className="empty">No Maqraa scheduled.</div>
            )}
          </Card>
        </section>
        <section>
          <div className="row">
            <h2 className="section-title">Friday booking</h2>
            <Link
              to="/booking"
              className="tiny"
              style={{ color: "var(--blue)" }}
            >
              See all <ArrowUpRight size={13} />
            </Link>
          </div>
          <Card>
            {nextFootball ? (
              <>
                <div className="row-start">
                  <CalendarDays size={18} />
                  <strong>
                    {date(nextFootball.starts_at, locale, timeZone)}
                  </strong>
                </div>
                <p className="muted">
                  <MapPin size={14} style={{ display: "inline" }} />{" "}
                  {nextFootball.venue || "Venue to be announced"}
                </p>
                <span className="pill blue">
                  Capacity {nextFootball.capacity}
                </span>
              </>
            ) : (
              <div className="empty">No Friday session scheduled.</div>
            )}
          </Card>
        </section>
      </div>
      <section>
        <div className="row">
          <h2 className="section-title">My teams</h2>
          <Link to="/teams" className="tiny" style={{ color: "var(--blue)" }}>
            See all <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="grid-two">
          {teams.data
            ?.filter((x) => x.status === "published")
            .slice(0, 2)
            .map((team) => (
              <Card key={team.id}>
                <div className="row-start">
                  <Users color={team.color} />
                  <strong>{team.name}</strong>
                </div>
              </Card>
            ))}
          {!teams.data?.some((x) => x.status === "published") && (
            <Card className="empty">
              Team assignments will appear after the roster is locked.
            </Card>
          )}
        </div>
      </section>
      {(football.isError || maqraa.isError) && (
        <div className="notice error">
          Could not load the schedule. Check your connection.
        </div>
      )}
    </div>
  );
}
