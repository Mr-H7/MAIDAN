import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { DateTime } from "luxon";
import { useApp } from "../context/AppContext";
import {
  adminSetBooking,
  createWeekly,
  getBookings,
  getFootball,
  getMaqraa,
  getMatches,
  getPlayers,
  lockRoster,
  rotateQr,
  scheduleMatches,
} from "../lib/api";
import { db } from "../lib/supabase";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import {
  InitialAssessments,
  MaqraaCorrection,
} from "../components/AdminExtras";
import { GroupSettings } from "../components/GroupSettings";
import { DisciplineAdmin } from "../components/DisciplineAdmin";
import { FixtureOrder } from "../components/FixtureOrder";
import { Field } from "../components/ui/Field";
import type { Booking, Maqraa } from "../lib/types";
function defaultDates(zone: string) {
  const now = DateTime.now().setZone(zone);
  const daysUntilTuesday = (2 - now.weekday + 7) % 7 || 7;
  const tuesday = now
    .plus({ days: daysUntilTuesday })
    .set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
  const friday = tuesday
    .plus({ days: 3 })
    .set({ hour: 21, minute: 0, second: 0, millisecond: 0 });
  return {
    maqraa: tuesday.toFormat("yyyy-MM-dd'T'HH:mm"),
    football: friday.toFormat("yyyy-MM-dd'T'HH:mm"),
  };
}
function QrAdmin({ session }: { session: Maqraa }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    const timeout = window.setTimeout(() => setToken(""), 120_000);
    return () => window.clearTimeout(timeout);
  }, [token]);
  useEffect(() => {
    if (session.status !== "active") setToken("");
  }, [session.status]);
  const mutation = useMutation({
    mutationFn: () => rotateQr(session.id),
    onSuccess: (value) => {
      setToken(value);
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  const url = token
    ? `${location.origin}/maqraa?token=${encodeURIComponent(token)}`
    : "";
  return (
    <Card>
      <div className="row">
        <div>
          <strong>{session.title}</strong>
          <div className="muted tiny">
            {new Date(session.starts_at).toLocaleString()}
          </div>
        </div>
        <span className="pill">{session.status}</span>
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <ActionButton
          disabled={session.status !== "active" || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Generate 2 minute QR
        </ActionButton>
      </div>
      {token && (
        <>
          <div className="qr-box" style={{ marginTop: 16 }}>
            <QRCodeSVG value={url} size={220} includeMargin />
          </div>
          <p className="tiny muted">
            This QR expires after 2 minutes. Generate another to continue check
            in.
          </p>
        </>
      )}
      {error && <div className="notice error">{error}</div>}
    </Card>
  );
}
export function AdminPage() {
  const { groupId, membership } = useApp();
  const client = useQueryClient();
  const zone = membership?.group.timezone || "Africa/Cairo";
  const defaults = defaultDates(zone);
  const [maqraaDate, setMaqraaDate] = useState(defaults.maqraa);
  const [footballDate, setFootballDate] = useState(defaults.football);
  const [venue, setVenue] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const sessions = useQuery({
    queryKey: ["football", groupId],
    queryFn: () => getFootball(groupId!),
    enabled: !!groupId,
  });
  const maqraa = useQuery({
    queryKey: ["maqraa", groupId],
    queryFn: () => getMaqraa(groupId!),
    enabled: !!groupId,
  });
  const players = useQuery({
    queryKey: ["players", groupId],
    queryFn: () => getPlayers(groupId!),
    enabled: !!groupId,
  });
  const officialRoles = useQuery({
    queryKey: ["officialRoles", groupId],
    queryFn: async () => {
      const { data, error } = await db()
        .from("group_roles")
        .select("user_id,role")
        .eq("group_id", groupId!)
        .in("role", ["group_admin", "super_admin"]);
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });
  const officialIds = new Set(officialRoles.data?.map((r) => r.user_id));
  const active =
    sessions.data?.find((x) => x.id === selectedSession) ||
    sessions.data?.find((x) => x.status === "open") ||
    sessions.data?.[0];
  const bookings = useQuery({
    queryKey: ["bookings", active?.id],
    queryFn: () => getBookings(active!.id),
    enabled: !!active,
  });
  const matches = useQuery({
    queryKey: ["matches", active?.id],
    queryFn: () => getMatches(active!.id),
    enabled: !!active,
  });
  const create = useMutation({
    mutationFn: () =>
      createWeekly(
        groupId!,
        DateTime.fromISO(maqraaDate, { zone }).toUTC().toISO()!,
        DateTime.fromISO(footballDate, { zone }).toUTC().toISO()!,
        venue,
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["football", groupId] });
      client.invalidateQueries({ queryKey: ["maqraa", groupId] });
      setNotice("Sessions created.");
    },
    onError: (e) => setNotice(e.message),
  });
  const update = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string;
      status: Booking["status"];
    }) => adminSetBooking(active!.id, userId, status),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["bookings", active?.id] });
      setNotice("Attendance updated.");
    },
    onError: (e) => setNotice(e.message),
  });
  const lock = useMutation({
    mutationFn: () => lockRoster(active!.id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["football", groupId] });
      setNotice("Roster locked.");
    },
    onError: (e) => setNotice(e.message),
  });
  const fixtures = useMutation({
    mutationFn: () => scheduleMatches(active!.id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["matches", active?.id] });
      setNotice("Matches scheduled.");
    },
    onError: (e) => setNotice(e.message),
  });
  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await db().rpc("add_member_by_email", {
        p_group_id: groupId,
        p_email: email.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["players", groupId] });
      setNotice("Player added.");
      setEmail("");
    },
    onError: (e) => setNotice(e.message),
  });
  const setMaqraaStatus = async (id: string, status: "active" | "closed") => {
    const { error } = await db().rpc("set_maqraa_status", {
      p_session_id: id,
      p_status: status,
    });
    if (error) setNotice(error.message);
    else {
      setNotice(`Maqraa ${status}.`);
      client.invalidateQueries({ queryKey: ["maqraa", groupId] });
    }
  };
  const assign = async (
    matchId: string,
    userId: string,
    role: "head" | "assistant",
  ) => {
    const { error } = await db().rpc("assign_match_official", {
      p_match_id: matchId,
      p_user_id: userId,
      p_role: role,
    });
    setNotice(error?.message || "Official assigned.");
  };
  const rosterText = (bookings.data || [])
    .filter((x) => x.status === "confirmed")
    .map((x, i) => `${i + 1}. ${x.profile?.full_name || x.user_id}`)
    .join("\n");
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">
          Group operations · {membership?.group.name}
        </span>
        <h1 className="page-title">Admin dashboard</h1>
        <p className="muted">
          Manage the weekly community and football workflow.
        </p>
      </div>
      <div className="metric-grid">
        <div className="metric">
          <div className="stat">{players.data?.length || 0}</div>
          <div className="stat-label">Players</div>
        </div>
        <div className="metric">
          <div className="stat">
            {bookings.data?.filter((x) => x.status === "confirmed").length || 0}
          </div>
          <div className="stat-label">Confirmed</div>
        </div>
        <div className="metric">
          <div className="stat">{matches.data?.length || 0}</div>
          <div className="stat-label">Matches</div>
        </div>
      </div>
      {notice && (
        <div
          className={`notice ${create.isError || update.isError || invite.isError ? "error" : "success"}`}
          role="status"
        >
          {notice}
        </div>
      )}
      <div className="grid-two">
        <Card>
          <h2 className="section-title">Create weekly sessions</h2>
          <div className="form-stack">
            <Field
              label="Tuesday Maqraa (group time)"
              type="datetime-local"
              value={maqraaDate}
              onChange={(e) => setMaqraaDate(e.target.value)}
            />
            <Field
              label="Friday football (group time)"
              type="datetime-local"
              value={footballDate}
              onChange={(e) => setFootballDate(e.target.value)}
            />
            <Field
              label="Venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
            <p className="tiny muted">
              Group display timezone: {membership?.group.timezone}. Times are
              stored as timezone aware timestamps.
            </p>
            <ActionButton
              disabled={create.isPending || !maqraaDate || !footballDate}
              onClick={() => create.mutate()}
            >
              Create sessions
            </ActionButton>
          </div>
        </Card>
        <Card>
          <h2 className="section-title">Player management</h2>
          <div className="form-stack">
            <Field
              label="Existing account email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <ActionButton
              disabled={invite.isPending || !email.includes("@")}
              onClick={() => invite.mutate()}
            >
              Add player
            </ActionButton>
            <p className="tiny muted">
              The player must create a MAIDAN account first. Only a group admin
              can add members.
            </p>
          </div>
        </Card>
      </div>
      <InitialAssessments groupId={groupId!} players={players.data || []} />
      {membership?.group && <GroupSettings group={membership.group} />}
      <section>
        <h2 className="section-title">Maqraa QR administration</h2>
        <div className="grid-two">
          {maqraa.data?.map((s) => (
            <div key={s.id}>
              <QrAdmin session={s} />
              <div className="actions" style={{ marginTop: 8 }}>
                {s.status === "scheduled" && (
                  <ActionButton
                    variant="secondary"
                    onClick={() => setMaqraaStatus(s.id, "active")}
                  >
                    Start session
                  </ActionButton>
                )}
                {s.status === "active" && (
                  <ActionButton
                    variant="quiet"
                    onClick={() => setMaqraaStatus(s.id, "closed")}
                  >
                    Close session
                  </ActionButton>
                )}
              </div>
            </div>
          ))}
          {maqraa.data?.length === 0 && (
            <Card className="empty">No Maqraa sessions.</Card>
          )}
        </div>
        {maqraa.data?.[0] && (
          <MaqraaCorrection
            session={maqraa.data[0]}
            players={players.data || []}
          />
        )}
      </section>
      <section>
        <h2 className="section-title">Friday attendance administration</h2>
        {sessions.data && (
          <select
            className="select"
            aria-label="Friday session"
            value={active?.id || ""}
            onChange={(e) => setSelectedSession(e.target.value)}
          >
            {sessions.data.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.starts_at).toLocaleDateString()} · {s.status}
              </option>
            ))}
          </select>
        )}
        {active && (
          <Card style={{ marginTop: 12 }}>
            <div className="row">
              <strong>{new Date(active.starts_at).toLocaleString()}</strong>
              <span className="pill blue">
                {bookings.data?.filter((x) => x.status === "confirmed")
                  .length || 0}
                /{active.capacity}
              </span>
            </div>
            <div className="actions" style={{ margin: "14px 0" }}>
              <ActionButton
                disabled={active.status !== "open" || lock.isPending}
                onClick={() => lock.mutate()}
              >
                Lock roster
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={!rosterText}
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `MAIDAN · Friday roster\n${rosterText}`,
                  );
                  setNotice("Confirmed roster copied.");
                }}
              >
                Copy WhatsApp roster
              </ActionButton>
              <Link to="/teams">
                <ActionButton variant="quiet">Team builder</ActionButton>
              </Link>
            </div>
            <div className="list">
              {players.data?.map((p) => {
                const booking = bookings.data?.find((b) => b.user_id === p.id);
                return (
                  <div className="list-row" key={p.id}>
                    <div>
                      <strong>{p.full_name}</strong>
                      <small>
                        {booking?.status?.replace("_", " ") || "not registered"}
                      </small>
                    </div>
                    <select
                      className="select"
                      aria-label={`Attendance for ${p.full_name}`}
                      style={{ width: 150 }}
                      value={booking?.status || "pending"}
                      onChange={(e) =>
                        update.mutate({
                          userId: p.id,
                          status: e.target.value as Booking["status"],
                        })
                      }
                    >
                      {[
                        "pending",
                        "pre_registered",
                        "confirmed",
                        "declined",
                        "waitlisted",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>
      <DisciplineAdmin
        groupId={groupId!}
        enabled={membership?.group.green_redemption_enabled || false}
      />
      <section>
        <div className="row">
          <h2 className="section-title">Match operations</h2>
          <Link to="/matches" style={{ color: "var(--blue)" }}>
            View schedule
          </Link>
        </div>
        <ActionButton
          disabled={!active || matches.data?.length !== 0 || fixtures.isPending}
          onClick={() => fixtures.mutate()}
        >
          Generate fixtures from published teams
        </ActionButton>
        {active && (
          <FixtureOrder sessionId={active.id} matches={matches.data || []} />
        )}
        <div className="list" style={{ marginTop: 12 }}>
          {matches.data?.map((m) => (
            <Card key={m.id}>
              <div className="row">
                <Link to={`/matches/${m.id}`}>
                  <strong>
                    Match {m.order_no}: {m.home_team?.name} vs{" "}
                    {m.away_team?.name}
                  </strong>
                </Link>
                <span className="pill gray">{m.status}</span>
              </div>
              <div className="toolbar" style={{ marginTop: 12 }}>
                {(["head", "assistant"] as const).map((role) => (
                  <label className="field" key={role}>
                    {role} referee
                    <select
                      className="select"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value)
                          void assign(m.id, e.target.value, role);
                      }}
                    >
                      <option value="">Assign</option>
                      {players.data
                        ?.filter((p) => officialIds.has(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
