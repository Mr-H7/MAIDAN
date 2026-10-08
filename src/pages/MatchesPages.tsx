import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Circle, Flag, Play, Pause, Square, Undo2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  addEvent,
  getEvents,
  getFootball,
  getMatch,
  getMatches,
  getTeamPlayers,
  ratePlayer,
  reverseEvent,
  setMatchState,
} from "../lib/api";
import { db } from "../lib/supabase";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import type { Match, MatchEvent } from "../lib/types";
function score(events: MatchEvent[], teamId: string) {
  return events.filter(
    (e) => e.team_id === teamId && e.event_type === "goal" && !e.reversed_at,
  ).length;
}
function clock(match: Match, now: number) {
  const elapsed =
    match.elapsed_seconds +
    (match.status === "live" && match.started_at
      ? Math.max(0, (now - new Date(match.started_at).getTime()) / 1000)
      : 0);
  const remaining = Math.max(0, match.duration_seconds - elapsed);
  return `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(remaining % 60)
    .toString()
    .padStart(2, "0")}`;
}
function MatchCard({ match }: { match: Match }) {
  const events = useQuery({
    queryKey: ["events", match.id],
    queryFn: () => getEvents(match.id),
  });
  return (
    <Link to={`/matches/${match.id}`}>
      <Card>
        <div className="row">
          <span className={`pill ${match.status === "live" ? "red" : "gray"}`}>
            {match.status}
          </span>
          <span className="muted tiny">
            Match {match.order_no} · {Math.round(match.duration_seconds / 60)}{" "}
            min
          </span>
        </div>
        <div className="score-line" style={{ marginTop: 14 }}>
          <strong>{match.home_team?.name || "Home"}</strong>
          <span>
            {score(events.data || [], match.home_team_id)} :{" "}
            {score(events.data || [], match.away_team_id)}
          </span>
          <strong>{match.away_team?.name || "Away"}</strong>
        </div>
      </Card>
    </Link>
  );
}
export function MatchesPage() {
  const { groupId } = useApp();
  const [selectedSession, setSelectedSession] = useState("");
  const sessions = useQuery({
    queryKey: ["football", groupId],
    queryFn: () => getFootball(groupId!),
    enabled: !!groupId,
  });
  const active =
    sessions.data?.find((x) => x.id === selectedSession) ||
    sessions.data?.find((x) => new Date(x.ends_at) > new Date()) ||
    sessions.data?.at(-1);
  const matches = useQuery({
    queryKey: ["matches", active?.id],
    queryFn: () => getMatches(active!.id),
    enabled: !!active,
  });
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">Fixtures</span>
        <h1 className="page-title">Match schedule</h1>
        <p className="muted">
          Live scores come from recorded, authorized match events.
        </p>
      </div>
      {sessions.isLoading && <div role="status">Loading sessions…</div>}
      {sessions.isError && (
        <div className="notice error" role="alert">
          Could not load football sessions.
        </div>
      )}
      {(sessions.data?.length || 0) > 1 && (
        <label className="field">
          Football session
          <select
            className="select"
            value={active?.id || ""}
            onChange={(event) => setSelectedSession(event.target.value)}
          >
            {sessions.data?.map((session) => (
              <option key={session.id} value={session.id}>
                {new Date(session.starts_at).toLocaleDateString()} ·{" "}
                {session.status}
              </option>
            ))}
          </select>
        </label>
      )}
      {matches.isLoading && <div role="status">Loading matches…</div>}
      {matches.isError && (
        <div className="notice error" role="alert">
          Could not load matches.
        </div>
      )}
      {matches.data?.length === 0 && (
        <Card className="empty">No matches scheduled for this session.</Card>
      )}
      {matches.data?.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  );
}
export function MatchPage() {
  const { id } = useParams();
  const { user, isAdmin } = useApp();
  const client = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [type, setType] = useState<MatchEvent["event_type"]>("goal");
  const [ratee, setRatee] = useState("");
  const [scores, setScores] = useState({
    performance: 7,
    teamwork: 7,
    effort: 7,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const matchQuery = useQuery({
    queryKey: ["match", id],
    queryFn: () => getMatch(id!),
    enabled: !!id,
  });
  const match = matchQuery.data;
  const events = useQuery({
    queryKey: ["events", id],
    queryFn: () => getEvents(id!),
    enabled: !!id,
  });
  const players = useQuery({
    queryKey: ["teamPlayers", match?.session_id],
    queryFn: () => getTeamPlayers(match!.session_id),
    enabled: !!match,
  });
  const officials = useQuery({
    queryKey: ["officials", id],
    queryFn: async () => {
      const { data, error } = await db()
        .from("match_officials")
        .select("user_id,role")
        .eq("match_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  const canRef =
    !!isAdmin && !!officials.data?.some((o) => o.user_id === user?.id);
  const action = useMutation({
    mutationFn: async (op: () => Promise<void>) => op(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["matches"] });
      client.invalidateQueries({ queryKey: ["match", id] });
      client.invalidateQueries({ queryKey: ["events", id] });
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  const rating = useMutation({
    mutationFn: () =>
      ratePlayer(
        id!,
        ratee,
        scores.performance,
        scores.teamwork,
        scores.effort,
      ),
    onSuccess: () => {
      setRatee("");
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  useEffect(() => {
    if (!match) return;
    const channel = db()
      .channel(`match-${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${match.id}`,
        },
        () => client.invalidateQueries({ queryKey: ["events", match.id] }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        () => client.invalidateQueries({ queryKey: ["match", match.id] }),
      )
      .subscribe();
    return () => {
      void db().removeChannel(channel);
    };
  }, [match?.id, client]);
  if (!match)
    return <Card className="empty">Loading match or match not found.</Card>;
  const home = match.home_team?.name || "Home",
    away = match.away_team?.name || "Away";
  const eligiblePlayers =
    players.data?.filter((p) => p.team_id === teamId) || [];
  const myTeam = players.data?.find((p) => p.user_id === user?.id)?.team_id;
  const rateable =
    players.data?.filter(
      (p) => p.team_id === myTeam && p.user_id !== user?.id,
    ) || [];
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">Live match center</span>
        <h1 className="page-title">
          {home} vs {away}
        </h1>
      </div>
      <div className="scoreboard">
        <div className="row" style={{ justifyContent: "center" }}>
          <span className={`pill ${match.status === "live" ? "red" : "gray"}`}>
            {match.status}
          </span>
          <span className="pill gray">{clock(match, now)}</span>
        </div>
        <div className="score-line">
          <span>{home}</span>
          <span className="score-num">
            {score(events.data || [], match.home_team_id)} :{" "}
            {score(events.data || [], match.away_team_id)}
          </span>
          <span>{away}</span>
        </div>
      </div>
      {canRef && (
        <Card>
          <h2 className="section-title">Referee console</h2>
          <div className="actions">
            {match.status === "scheduled" && (
              <ActionButton
                onClick={() =>
                  action.mutate(() => setMatchState(match.id, "live"))
                }
              >
                <Play size={16} /> Start
              </ActionButton>
            )}
            {match.status === "live" && (
              <ActionButton
                variant="secondary"
                onClick={() =>
                  action.mutate(() => setMatchState(match.id, "paused"))
                }
              >
                <Pause size={16} /> Pause
              </ActionButton>
            )}
            {match.status === "paused" && (
              <ActionButton
                onClick={() =>
                  action.mutate(() => setMatchState(match.id, "live"))
                }
              >
                <Play size={16} /> Resume
              </ActionButton>
            )}
            {["live", "paused"].includes(match.status) && (
              <ActionButton
                variant="quiet"
                onClick={() =>
                  action.mutate(() => setMatchState(match.id, "completed"))
                }
              >
                <Square size={16} /> Complete
              </ActionButton>
            )}
          </div>
          <hr className="divider" />
          <div className="form-stack">
            <label className="field">
              Team
              <select
                className="select"
                value={teamId}
                onChange={(e) => {
                  setTeamId(e.target.value);
                  setPlayerId("");
                }}
              >
                <option value="">Select team</option>
                <option value={match.home_team_id}>{home}</option>
                <option value={match.away_team_id}>{away}</option>
              </select>
            </label>
            <label className="field">
              Player
              <select
                className="select"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
              >
                <option value="">Select actual player</option>
                {eligiblePlayers.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.profile?.full_name || p.user_id}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Event
              <select
                className="select"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as MatchEvent["event_type"])
                }
              >
                <option value="goal">Goal</option>
                <option value="yellow">Yellow card</option>
                <option value="red">Red card</option>
                <option value="green">Green card</option>
              </select>
            </label>
            <ActionButton
              disabled={
                !teamId ||
                !playerId ||
                match.status !== "live" ||
                action.isPending
              }
              onClick={() =>
                action.mutate(() => addEvent(match.id, teamId, playerId, type))
              }
            >
              Record event
            </ActionButton>
          </div>
        </Card>
      )}
      {isAdmin && !canRef && (
        <div className="notice">
          Only assigned match officials can operate this match.
        </div>
      )}
      <Card>
        <h2 className="section-title">Event timeline</h2>
        <div className="timeline">
          {events.data
            ?.filter((e) => !e.reversed_at)
            .map((e) => (
              <div className="timeline-item" key={e.id}>
                <div className="row">
                  <div>
                    <strong>
                      {e.event_type === "goal" ? (
                        <Circle size={14} style={{ display: "inline" }} />
                      ) : (
                        <Flag size={14} style={{ display: "inline" }} />
                      )}{" "}
                      {e.event_type.toUpperCase()}
                    </strong>
                    <div className="muted tiny">
                      {e.profile?.full_name || "Player"} ·{" "}
                      {new Date(e.occurred_at).toLocaleTimeString()}
                    </div>
                  </div>
                  {canRef && (
                    <button
                      className="icon-button"
                      aria-label="Reverse event"
                      onClick={() => action.mutate(() => reverseEvent(e.id))}
                    >
                      <Undo2 size={17} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          {events.data?.filter((e) => !e.reversed_at).length === 0 && (
            <p className="muted">No events recorded.</p>
          )}
        </div>
      </Card>
      {match.status === "completed" && myTeam && (
        <Card>
          <h2 className="section-title">Rate a teammate</h2>
          <div className="form-stack">
            <label className="field">
              Player
              <select
                className="select"
                value={ratee}
                onChange={(e) => setRatee(e.target.value)}
              >
                <option value="">Select teammate</option>
                {rateable.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.profile?.full_name}
                  </option>
                ))}
              </select>
            </label>
            {(["performance", "teamwork", "effort"] as const).map((key) => (
              <label className="field" key={key}>
                {key} · {scores[key]}/10
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={scores[key]}
                  onChange={(e) =>
                    setScores({ ...scores, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            <ActionButton
              disabled={!ratee || rating.isPending}
              onClick={() => rating.mutate()}
            >
              Submit evaluation
            </ActionButton>
          </div>
        </Card>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
