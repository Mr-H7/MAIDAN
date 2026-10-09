import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Circle, Flag, Play, Pause, Square, Undo2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  addEvent,
  addWalkInEvent,
  getBookings,
  getEvents,
  getFootball,
  getMatch,
  getMatchdayReport,
  getMatches,
  getTeamPlayers,
  getReserveTeamPlayers,
  getTeams,
  ratePlayer,
  reverseEvent,
  setMatchState,
} from "../lib/api";
import { db } from "../lib/supabase";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import type { Match, MatchEvent } from "../lib/types";
import { FridayGateCard } from "../components/FridayGateCard";
import { matchControlRequirements } from "../lib/fridayGate";
import { displayClock, elapsedSeconds } from "../lib/reserveRules";
function score(events: MatchEvent[], teamId: string) {
  return events.filter(
    (e) => e.team_id === teamId && e.event_type === "goal" && !e.reversed_at,
  ).length;
}
const typeLabel = (type: Match["match_type"], ar: boolean) =>
  ({
    main_main: ar ? "أساسي ضد أساسي" : "Main vs Main",
    reserve_reserve: ar ? "احتياط ضد احتياط" : "Reserve vs Reserve",
    reserve_main: ar ? "احتياط ضد أساسي" : "Reserve vs Main",
  })[type];
function playFinalWhistle() {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 920;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.82);
  oscillator.onended = () => void context.close();
}
function MatchCard({ match }: { match: Match }) {
  const { language } = useApp();
  const ar = language === "ar";
  const events = useQuery({
    queryKey: ["events", match.id],
    queryFn: () => getEvents(match.id),
  });
  return (
    <Link to={`/matches/${match.id}`}>
      <Card>
        <div className="row">
          <span className={`pill ${match.status === "live" ? "red" : "gray"}`}>
            {ar
              ? {
                  scheduled: "مجدولة",
                  live: "جارية",
                  paused: "متوقفة",
                  completed: "مكتملة",
                }[match.status]
              : match.status}
          </span>
          <span className="muted tiny">
            {typeLabel(match.match_type, ar)} · {ar ? "المباراة" : "Match"}{" "}
            {match.order_no} · {Math.round(match.duration_seconds / 60)}{" "}
            {ar ? "دقيقة" : "min"}
          </span>
        </div>
        <div className="score-line" style={{ marginTop: 14 }}>
          <strong>{match.home_team?.name || (ar ? "الأول" : "Home")}</strong>
          <span>
            {score(events.data || [], match.home_team_id)} :{" "}
            {score(events.data || [], match.away_team_id)}
          </span>
          <strong>{match.away_team?.name || (ar ? "الثاني" : "Away")}</strong>
        </div>
      </Card>
    </Link>
  );
}
export function MatchesPage() {
  const { groupId, language } = useApp();
  const queryClient = useQueryClient();
  const ar = language === "ar";
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
  const teams = useQuery({
    queryKey: ["teams", active?.id],
    queryFn: () => getTeams(active!.id),
    enabled: !!active,
  });
  const bookings = useQuery({
    queryKey: ["bookings", active?.id],
    queryFn: () => getBookings(active!.id),
    enabled: !!active,
  });
  const report = useQuery({
    queryKey: ["matchdayReport", active?.id],
    queryFn: () => getMatchdayReport(active!.id),
    enabled: !!active,
  });
  useEffect(() => {
    if (!active || !groupId) return;
    const channel = db()
      .channel(`fixtures-${active.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_events",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["matchdayReport", active.id],
          });
          queryClient.invalidateQueries({ queryKey: ["events"] });
          queryClient.invalidateQueries({ queryKey: ["matches", active.id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `session_id=eq.${active.id}`,
        },
        () =>
          queryClient.invalidateQueries({ queryKey: ["matches", active.id] }),
      )
      .subscribe();
    return () => {
      void db().removeChannel(channel);
    };
  }, [active?.id, groupId, queryClient]);
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">{ar ? "المواجهات" : "Fixtures"}</span>
        <h1 className="page-title">
          {ar ? "جدول المباريات" : "Match schedule"}
        </h1>
        <p className="muted">
          {ar
            ? "تُحسب النتائج المباشرة من أحداث المباراة المسجلة والمصرح بها."
            : "Live scores come from recorded, authorized match events."}
        </p>
      </div>
      {sessions.isLoading && (
        <div role="status">
          {ar ? "جارٍ تحميل الجلسات…" : "Loading sessions…"}
        </div>
      )}
      {sessions.isError && (
        <div className="notice error" role="alert">
          {ar
            ? "تعذّر تحميل جلسات كرة القدم."
            : "Could not load football sessions."}
        </div>
      )}
      {(sessions.data?.length || 0) > 1 && (
        <label className="field">
          {ar ? "جلسة كرة القدم" : "Football session"}
          <select
            className="select"
            value={active?.id || ""}
            onChange={(event) => setSelectedSession(event.target.value)}
          >
            {sessions.data?.map((session) => (
              <option key={session.id} value={session.id}>
                {new Date(session.starts_at).toLocaleDateString(
                  ar ? "ar" : "en",
                )}{" "}
                · {session.status}
              </option>
            ))}
          </select>
        </label>
      )}
      {matches.isLoading && (
        <div role="status">
          {ar ? "جارٍ تحميل المباريات…" : "Loading matches…"}
        </div>
      )}
      {matches.isError && (
        <div className="notice error" role="alert">
          {ar ? "تعذّر تحميل المباريات." : "Could not load matches."}
        </div>
      )}
      {sessions.isSuccess &&
        (!active ||
          (matches.isSuccess && teams.isSuccess && bookings.isSuccess)) &&
        (matches.data?.length || 0) === 0 && (
          <FridayGateCard
            input={{
              hasSession: !!active,
              sessionStatus: active?.status || null,
              confirmedCount:
                bookings.data?.filter((row) => row.status === "confirmed")
                  .length || 0,
              teamCount:
                teams.data?.filter((team) => team.kind === "main").length || 0,
              publishedTeamCount:
                teams.data?.filter(
                  (team) => team.kind === "main" && team.status === "published",
                ).length || 0,
              matchCount: 0,
            }}
          />
        )}
      {matches.data?.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
      {report.data && report.data.length > 0 && (
        <Card>
          <h2 className="section-title">
            {ar ? "إحصاءات يوم المباراة" : "Matchday statistics"}
          </h2>
          <div className="list">
            {report.data.map((player) => (
              <div className="list-row" key={player.id}>
                <strong>{player.name}</strong>
                <small>
                  {ar ? "الأهداف" : "Goals"}: {player.combined.goals} ·{" "}
                  {ar ? "أساسي" : "Standard"} {player.standard.goals} ·{" "}
                  {ar ? "احتياط" : "Reserve"} {player.reserve.goals}
                  <br />
                  {ar ? "البطاقات (ص/ح/خ)" : "Cards (Y/R/G)"}:{" "}
                  {player.combined.yellow}/{player.combined.red}/
                  {player.combined.green}
                </small>
              </div>
            ))}
          </div>
        </Card>
      )}
      {report.isError && (
        <div className="notice error" role="alert">
          {ar
            ? "تعذّر تحميل إحصاءات يوم المباراة."
            : "Could not load matchday statistics."}
        </div>
      )}
    </div>
  );
}
export function MatchPage() {
  const { id } = useParams();
  const { user, isAdmin, language, membership } = useApp();
  const ar = language === "ar";
  const client = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const previousElapsed = useRef<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [error, setError] = useState("");
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
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
  useEffect(() => {
    previousElapsed.current = null;
  }, [id]);
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
  const reservePlayers = useQuery({
    queryKey: ["reserveTeamPlayers", match?.session_id],
    queryFn: () => getReserveTeamPlayers(match!.session_id),
    enabled: !!match && match.match_type !== "main_main",
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
  const participants = [
    ...(players.data || []).map((p) => ({
      teamId: p.team_id,
      id: p.user_id,
      userId: p.user_id,
      guest: false,
      name: p.profile?.full_name || p.user_id,
    })),
    ...(reservePlayers.data || []).map((p) => ({
      teamId: p.team_id,
      id: p.reserve_player?.member_user_id || p.reserve_player_id,
      userId: p.reserve_player?.member_user_id || null,
      guest: !p.reserve_player?.member_user_id,
      name: p.reserve_player?.full_name || p.reserve_player_id,
    })),
  ];
  const participating = participants.some(
    (p) =>
      p.userId === user?.id &&
      !!user?.id &&
      [match?.home_team_id, match?.away_team_id].includes(p.teamId),
  );
  const canRef =
    !!isAdmin &&
    !participating &&
    !!officials.data?.some((o) => o.user_id === user?.id);
  const elapsed = match ? elapsedSeconds(match, now) : 0;
  useEffect(() => {
    if (!match) return;
    if (
      previousElapsed.current !== null &&
      previousElapsed.current < match.duration_seconds &&
      elapsed >= match.duration_seconds &&
      match.status === "live" &&
      soundEnabled
    ) {
      try {
        playFinalWhistle();
      } catch {
        /* Browser audio permission can block playback. */
      }
    }
    previousElapsed.current = elapsed;
  }, [match, elapsed, soundEnabled]);
  const action = useMutation({
    mutationFn: async (op: () => Promise<void>) => op(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["matches"] });
      client.invalidateQueries({ queryKey: ["match", id] });
      client.invalidateQueries({ queryKey: ["events", id] });
      client.invalidateQueries({
        queryKey: ["matchdayReport", match?.session_id],
      });
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
    return (
      <Card className="empty">
        {ar
          ? "جارٍ تحميل المباراة أو لم تُعثر عليها."
          : "Loading match or match not found."}
      </Card>
    );
  const home = match.home_team?.name || (ar ? "الأول" : "Home"),
    away = match.away_team?.name || (ar ? "الثاني" : "Away");
  const eligiblePlayers = participants.filter((p) => p.teamId === teamId);
  const myTeam = participants.find(
    (p) =>
      p.userId === user?.id &&
      [match.home_team_id, match.away_team_id].includes(p.teamId),
  )?.teamId;
  const rateable =
    match.match_type === "main_main"
      ? players.data?.filter(
          (p) => p.team_id === myTeam && p.user_id !== user?.id,
        ) || []
      : [];
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">
          {ar ? "مركز المباراة المباشر" : "Live match center"}
        </span>
        <h1 className="page-title">
          {home} vs {away}
        </h1>
        <span className="pill blue">
          {typeLabel(match.match_type, ar)} · {match.duration_seconds / 60}{" "}
          {ar ? "دقائق" : "min"}
        </span>
      </div>
      <div className="scoreboard">
        <div className="row" style={{ justifyContent: "center" }}>
          <span className={`pill ${match.status === "live" ? "red" : "gray"}`}>
            {ar
              ? {
                  scheduled: "مجدولة",
                  live: "جارية",
                  paused: "متوقفة",
                  completed: "مكتملة",
                }[match.status]
              : match.status}
          </span>
          <span className="pill gray" role="timer">
            {displayClock(elapsed, match.duration_seconds)}
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={
              soundEnabled
                ? ar
                  ? "كتم صفارة النهاية"
                  : "Mute final whistle"
                : ar
                  ? "تشغيل صفارة النهاية"
                  : "Enable final whistle"
            }
          >
            {soundEnabled ? "♪" : "×"}
          </button>
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
          <h2 className="section-title">
            {ar ? "لوحة الحكم" : "Referee console"}
          </h2>
          <div className="actions">
            {match.status === "scheduled" && (
              <ActionButton
                onClick={() =>
                  action.mutate(() => setMatchState(match.id, "live"))
                }
              >
                <Play size={16} /> {ar ? "ابدأ" : "Start"}
              </ActionButton>
            )}
            {match.status === "live" && (
              <ActionButton
                variant="secondary"
                onClick={() =>
                  action.mutate(() => setMatchState(match.id, "paused"))
                }
              >
                <Pause size={16} /> {ar ? "إيقاف مؤقت" : "Pause"}
              </ActionButton>
            )}
            {match.status === "paused" && (
              <ActionButton
                onClick={() =>
                  action.mutate(() => setMatchState(match.id, "live"))
                }
              >
                <Play size={16} /> {ar ? "استئناف" : "Resume"}
              </ActionButton>
            )}
            {["live", "paused"].includes(match.status) && (
              <ActionButton
                variant="quiet"
                onClick={() =>
                  action.mutate(() => setMatchState(match.id, "completed"))
                }
              >
                <Square size={16} /> {ar ? "إنهاء" : "Complete"}
              </ActionButton>
            )}
          </div>
          <hr className="divider" />
          <div className="form-stack">
            <label className="field">
              {ar ? "الفريق" : "Team"}
              <select
                className="select"
                value={teamId}
                onChange={(e) => {
                  setTeamId(e.target.value);
                  setPlayerId("");
                }}
              >
                <option value="">{ar ? "اختر الفريق" : "Select team"}</option>
                <option value={match.home_team_id}>{home}</option>
                <option value={match.away_team_id}>{away}</option>
              </select>
            </label>
            <label className="field">
              {ar ? "اللاعب" : "Player"}
              <select
                className="select"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
              >
                <option value="">
                  {ar ? "اختر اللاعب الفعلي" : "Select actual player"}
                </option>
                {eligiblePlayers.map((p) => (
                  <option
                    key={`${p.guest ? "guest" : "user"}:${p.id}`}
                    value={`${p.guest ? "guest" : "user"}:${p.id}`}
                  >
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              {(
                [
                  ["goal", ar ? "هدف" : "Goal"],
                  ["yellow", ar ? "صفراء" : "Yellow"],
                  ["red", ar ? "حمراء" : "Red"],
                  ["green", ar ? "خضراء" : "Green"],
                ] as const
              ).map(([eventType, label]) => (
                <ActionButton
                  key={eventType}
                  variant={eventType === "goal" ? "primary" : "secondary"}
                  disabled={
                    !teamId ||
                    !playerId ||
                    match.status !== "live" ||
                    action.isPending
                  }
                  onClick={() =>
                    action.mutate(() =>
                      playerId.startsWith("guest:")
                        ? addWalkInEvent(
                            match.id,
                            teamId,
                            playerId.slice(6),
                            eventType,
                          )
                        : addEvent(
                            match.id,
                            teamId,
                            playerId.slice(5),
                            eventType,
                          ),
                    )
                  }
                >
                  <Flag size={15} /> {label}
                </ActionButton>
              ))}
            </div>
            <p className="tiny muted">
              {membership?.group.green_hat_trick_enabled
                ? ar
                  ? "الهاتريك مفعّل. الهدف الثالث يسجل بطاقة خضراء من الخادم وتبقى في تسلسل الأحداث."
                  : "Hat-trick reward is on. The third goal records a green card on the server and keeps it in the timeline."
                : ar
                  ? "مكافأة الهاتريك متوقفة في إعدادات المجموعة."
                  : "Hat-trick reward is off in group settings."}
            </p>
          </div>
        </Card>
      )}
      {isAdmin && !canRef && (
        <div className="notice">
          {ar
            ? "لوحة الحكم مخفية حتى تُعيَّن حكمًا لهذه المباراة من إدارة المباريات، وأن لا تكون لاعبًا في أحد الفريقين."
            : "The referee console stays hidden until Admin assigns you to this match and you are not playing on either team."}{" "}
          <Link to="/admin">{ar ? "فتح الإدارة" : "Open admin"}</Link>
        </div>
      )}
      {!canRef && (
        <Card>
          <h2 className="section-title">
            {ar ? "شروط التحكم" : "Control requirements"}
          </h2>
          <ol className="gate-list">
            {matchControlRequirements[ar ? "ar" : "en"].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </Card>
      )}
      <Card>
        <h2 className="section-title">
          {ar ? "تسلسل الأحداث" : "Event timeline"}
        </h2>
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
                      {ar
                        ? {
                            goal: "هدف",
                            yellow: "بطاقة صفراء",
                            red: "بطاقة حمراء",
                            green: "بطاقة خضراء",
                          }[e.event_type]
                        : e.event_type.toUpperCase()}
                    </strong>
                    <div className="muted tiny">
                      {e.profile?.full_name ||
                        e.reserve_player?.full_name ||
                        (ar ? "لاعب" : "Player")}{" "}
                      ·{" "}
                      {new Date(e.occurred_at).toLocaleTimeString(
                        ar ? "ar" : "en",
                      )}
                    </div>
                  </div>
                  {canRef && (
                    <button
                      className="icon-button"
                      aria-label={ar ? "إلغاء الحدث" : "Reverse event"}
                      onClick={() => action.mutate(() => reverseEvent(e.id))}
                    >
                      <Undo2 size={17} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          {events.data?.filter((e) => !e.reversed_at).length === 0 && (
            <p className="muted">
              {ar ? "لم تُسجل أحداث بعد." : "No events recorded."}
            </p>
          )}
        </div>
      </Card>
      {match.status === "completed" &&
        match.match_type === "main_main" &&
        myTeam && (
          <Card>
            <h2 className="section-title">
              {ar ? "قيّم زميلك" : "Rate a teammate"}
            </h2>
            <div className="form-stack">
              <label className="field">
                {ar ? "اللاعب" : "Player"}
                <select
                  className="select"
                  value={ratee}
                  onChange={(e) => setRatee(e.target.value)}
                >
                  <option value="">
                    {ar ? "اختر زميلًا" : "Select teammate"}
                  </option>
                  {rateable.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.profile?.full_name}
                    </option>
                  ))}
                </select>
              </label>
              {(["performance", "teamwork", "effort"] as const).map((key) => (
                <label className="field" key={key}>
                  {ar
                    ? {
                        performance: "الأداء",
                        teamwork: "العمل الجماعي",
                        effort: "الجهد",
                      }[key]
                    : key}{" "}
                  · {scores[key]}/10
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
                {ar ? "إرسال التقييم" : "Submit evaluation"}
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
