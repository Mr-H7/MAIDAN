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
  getTeams,
  getTeamPlayers,
  getReserveTeamPlayers,
  lockRoster,
  reopenRoster,
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
import { GroupInviteCard } from "../components/GroupInviteCard";
import { FridayGateCard } from "../components/FridayGateCard";
import { DisciplineAdmin } from "../components/DisciplineAdmin";
import { matchControlRequirements } from "../lib/fridayGate";
import { FixtureOrder } from "../components/FixtureOrder";
import { ReserveOperations } from "../components/ReserveOperations";
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
  const { language, membership } = useApp();
  const ar = language === "ar";
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
            {new Date(session.starts_at).toLocaleString(ar ? "ar" : "en", {
              timeZone: membership?.group.timezone || "Africa/Cairo",
            })}
          </div>
        </div>
        <span className="pill">
          {ar
            ? { scheduled: "مجدولة", active: "جارية", closed: "مغلقة" }[
                session.status
              ]
            : session.status}
        </span>
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <ActionButton
          disabled={session.status !== "active" || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {ar ? "إنشاء رمز QR لدقيقتين" : "Generate 2 minute QR"}
        </ActionButton>
      </div>
      {token && (
        <>
          <div className="qr-box" style={{ marginTop: 16 }}>
            <QRCodeSVG value={url} size={220} includeMargin />
          </div>
          <p className="tiny muted">
            {ar
              ? "تنتهي صلاحية الرمز بعد دقيقتين. أنشئ رمزًا جديدًا لمواصلة التسجيل."
              : "This QR expires after 2 minutes. Generate another to continue check in."}
          </p>
        </>
      )}
      {error && <div className="notice error">{error}</div>}
    </Card>
  );
}
export function AdminPage() {
  const { groupId, membership, language } = useApp();
  const ar = language === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const bookingLabel = (status: string) =>
    ar
      ? (
          {
            pending: "قيد الانتظار",
            pre_registered: "مسجل مبدئيًا",
            confirmed: "مؤكد",
            declined: "اعتذر",
            waitlisted: "قائمة الانتظار",
          } as Record<string, string>
        )[status] || status
      : status.replace("_", " ");
  const client = useQueryClient();
  const zone = membership?.group.timezone || "Africa/Cairo";
  const defaults = defaultDates(zone);
  const [maqraaDate, setMaqraaDate] = useState(defaults.maqraa);
  const [footballDate, setFootballDate] = useState(defaults.football);
  const [venue, setVenue] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmFixtures, setConfirmFixtures] = useState(false);
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
  const teams = useQuery({
    queryKey: ["teams", active?.id],
    queryFn: () => getTeams(active!.id),
    enabled: !!active,
  });
  const mainAssignments = useQuery({
    queryKey: ["teamPlayers", active?.id],
    queryFn: () => getTeamPlayers(active!.id),
    enabled: !!active,
  });
  const reserveAssignments = useQuery({
    queryKey: ["reserveTeamPlayers", active?.id],
    queryFn: () => getReserveTeamPlayers(active!.id),
    enabled:
      !!active &&
      !!matches.data?.some((match) => match.match_type !== "main_main"),
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
      setNotice(t("Sessions created.", "أُنشئت الجلسات."));
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
      setNotice(t("Attendance updated.", "حُدّث الحضور."));
    },
    onError: (e) => setNotice(e.message),
  });
  const lock = useMutation({
    mutationFn: () => lockRoster(active!.id),
    onSuccess: () => {
      setConfirmLock(false);
      client.invalidateQueries({ queryKey: ["football", groupId] });
      setNotice(t("Roster locked.", "أُغلقت القائمة."));
    },
    onError: (e) => setNotice(e.message),
  });
  const reopen = useMutation({
    mutationFn: () => reopenRoster(active!.id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["football", groupId] });
      client.invalidateQueries({ queryKey: ["teams", active?.id] });
      setNotice(
        t(
          "Roster reopened. Draft teams for this session were cleared.",
          "أُعيد فتح القائمة. مُسحت مسودات فرق هذه الجلسة.",
        ),
      );
    },
    onError: (e) => setNotice(e.message),
  });
  const fixtures = useMutation({
    mutationFn: () => scheduleMatches(active!.id),
    onSuccess: () => {
      setConfirmFixtures(false);
      client.invalidateQueries({ queryKey: ["matches", active?.id] });
      setNotice(t("Matches scheduled.", "جُدولت المباريات."));
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
      setNotice(t("Player added.", "أُضيف اللاعب."));
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
      setNotice(
        ar
          ? status === "active"
            ? "بدأت المقرأة."
            : "أُغلقت المقرأة."
          : `Maqraa ${status}.`,
      );
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
    setNotice(error?.message || t("Official assigned.", "عُيّن الحكم."));
  };
  const confirmedCount =
    bookings.data?.filter((x) => x.status === "confirmed").length || 0;
  const fridayInput = {
    hasSession: !!active,
    sessionStatus: active?.status || null,
    confirmedCount,
    teamCount: teams.data?.filter((team) => team.kind === "main").length || 0,
    publishedTeamCount:
      teams.data?.filter(
        (team) => team.kind === "main" && team.status === "published",
      ).length || 0,
    matchCount: matches.data?.length || 0,
  };
  const rosterText = (bookings.data || [])
    .filter((x) => x.status === "confirmed")
    .map((x, i) => `${i + 1}. ${x.profile?.full_name || x.user_id}`)
    .join("\n");
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">
          {t("Group operations", "إدارة المجموعة")} · {membership?.group.name}
        </span>
        <h1 className="page-title">{t("Admin dashboard", "لوحة الإدارة")}</h1>
        <p className="muted">
          {t(
            "Manage the weekly community and football workflow.",
            "إدارة لقاءات المجتمع وكرة القدم الأسبوعية.",
          )}
        </p>
      </div>
      <div className="metric-grid">
        <div className="metric">
          <div className="stat">{players.data?.length || 0}</div>
          <div className="stat-label">{t("Players", "اللاعبون")}</div>
        </div>
        <div className="metric">
          <div className="stat">
            {bookings.data?.filter((x) => x.status === "confirmed").length || 0}
          </div>
          <div className="stat-label">{t("Confirmed", "المؤكدون")}</div>
        </div>
        <div className="metric">
          <div className="stat">{matches.data?.length || 0}</div>
          <div className="stat-label">{t("Matches", "المباريات")}</div>
        </div>
      </div>
      {groupId && <GroupInviteCard groupId={groupId} />}
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
          <h2 className="section-title">
            {t("Create weekly sessions", "إنشاء الجلسات الأسبوعية")}
          </h2>
          <div className="form-stack">
            <Field
              label={t(
                "Tuesday Maqraa (group time)",
                "مقرأة الثلاثاء (توقيت المجموعة)",
              )}
              type="datetime-local"
              value={maqraaDate}
              onChange={(e) => setMaqraaDate(e.target.value)}
            />
            <Field
              label={t(
                "Friday football (group time)",
                "كرة الجمعة (توقيت المجموعة)",
              )}
              type="datetime-local"
              value={footballDate}
              onChange={(e) => setFootballDate(e.target.value)}
            />
            <Field
              label={t("Venue", "المكان")}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
            <p className="tiny muted">
              {t("Group display timezone", "المنطقة الزمنية للمجموعة")}:{" "}
              {membership?.group.timezone}.{" "}
              {t(
                "Times are stored as timezone aware timestamps.",
                "تُحفظ الأوقات مع المنطقة الزمنية.",
              )}
            </p>
            <ActionButton
              disabled={create.isPending || !maqraaDate || !footballDate}
              onClick={() => create.mutate()}
            >
              {t("Create sessions", "إنشاء الجلسات")}
            </ActionButton>
          </div>
        </Card>
        <Card>
          <h2 className="section-title">
            {t("Player management", "إدارة اللاعبين")}
          </h2>
          <div className="form-stack">
            <Field
              label={t("Existing account email", "بريد حساب موجود")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <ActionButton
              disabled={invite.isPending || !email.includes("@")}
              onClick={() => invite.mutate()}
            >
              {t("Add player", "إضافة لاعب")}
            </ActionButton>
            <p className="tiny muted">
              {t(
                "The player must create a MAIDAN account first. Only a group admin can add members.",
                "يجب أن ينشئ اللاعب حساب ميدان أولًا. لا يضيف الأعضاء إلا مشرف المجموعة.",
              )}
            </p>
          </div>
        </Card>
      </div>
      <InitialAssessments groupId={groupId!} players={players.data || []} />
      {membership?.group && <GroupSettings group={membership.group} />}
      <section>
        <h2 className="section-title">
          {t("Maqraa QR administration", "إدارة رمز المقرأة")}
        </h2>
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
                    {t("Start session", "بدء الجلسة")}
                  </ActionButton>
                )}
                {s.status === "active" && (
                  <ActionButton
                    variant="quiet"
                    onClick={() => setMaqraaStatus(s.id, "closed")}
                  >
                    {t("Close session", "إغلاق الجلسة")}
                  </ActionButton>
                )}
              </div>
            </div>
          ))}
          {maqraa.data?.length === 0 && (
            <Card className="empty">
              {t("No Maqraa sessions.", "لا توجد جلسات مقرأة.")}
            </Card>
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
        <h2 className="section-title">
          {t("Friday attendance administration", "إدارة حضور الجمعة")}
        </h2>
        {sessions.data && (
          <select
            className="select"
            aria-label={t("Friday session", "جلسة الجمعة")}
            value={active?.id || ""}
            onChange={(e) => setSelectedSession(e.target.value)}
          >
            {sessions.data.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.starts_at).toLocaleDateString(ar ? "ar" : "en", {
                  timeZone: zone,
                })}{" "}
                · {s.status}
              </option>
            ))}
          </select>
        )}
        {active && (
          <Card style={{ marginTop: 12 }}>
            <div className="row">
              <strong>
                {new Date(active.starts_at).toLocaleString(ar ? "ar" : "en", {
                  timeZone: zone,
                })}
              </strong>
              <span className="pill blue">
                {bookings.data?.filter((x) => x.status === "confirmed")
                  .length || 0}
                /{active.capacity}
              </span>
            </div>
            <div className="actions" style={{ margin: "14px 0" }}>
              <ActionButton
                disabled={active.status !== "open" || lock.isPending}
                onClick={() => {
                  if (!confirmLock) {
                    setConfirmLock(true);
                    return;
                  }
                  lock.mutate();
                }}
              >
                {confirmLock
                  ? t("Confirm roster lock", "تأكيد إغلاق القائمة")
                  : t("Lock roster", "إغلاق القائمة")}
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={!rosterText}
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${t("MAIDAN · Friday roster", "ميدان · قائمة الجمعة")}\n${rosterText}`,
                  );
                  setNotice(
                    t("Confirmed roster copied.", "نُسخت قائمة المؤكدين."),
                  );
                }}
              >
                {t("Copy WhatsApp roster", "نسخ القائمة لواتساب")}
              </ActionButton>
              <Link to="/teams">
                <ActionButton variant="quiet">
                  {t("Team builder", "تكوين الفرق")}
                </ActionButton>
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
                        {booking
                          ? bookingLabel(booking.status)
                          : t("not registered", "غير مسجل")}
                      </small>
                    </div>
                    <select
                      className="select"
                      aria-label={
                        ar
                          ? `حضور ${p.full_name}`
                          : `Attendance for ${p.full_name}`
                      }
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
                          {bookingLabel(s)}
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
          <h2 className="section-title">
            {t("Match operations", "إدارة المباريات")}
          </h2>
          <Link to="/matches" style={{ color: "var(--blue)" }}>
            {t("View schedule", "عرض الجدول")}
          </Link>
        </div>
        <div className="actions" style={{ marginBottom: 12 }}>
          <ActionButton
            disabled={
              !active || matches.data?.length !== 0 || fixtures.isPending
            }
            onClick={() => {
              if (!confirmFixtures) {
                setConfirmFixtures(true);
                return;
              }
              fixtures.mutate();
            }}
          >
            {confirmFixtures
              ? t("Confirm fixture generation", "تأكيد جدولة المباريات")
              : t(
                  "Generate fixtures from published teams",
                  "جدولة مباريات الفرق المنشورة",
                )}
          </ActionButton>
          <Link to="/admin/demo">
            <ActionButton variant="secondary">
              {t("Open match demonstration", "فتح تجربة المباراة")}
            </ActionButton>
          </Link>
        </div>
        <Card>
          <h3 className="section-title">
            {t(
              "Match controls appear only after these conditions",
              "تظهر تحكمات المباراة بعد هذه الشروط فقط",
            )}
          </h3>
          <ol className="gate-list">
            {matchControlRequirements[ar ? "ar" : "en"].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </Card>
        {sessions.isSuccess &&
          (!active ||
            (matches.isSuccess && teams.isSuccess && bookings.isSuccess)) &&
          (matches.data?.length || 0) === 0 && (
            <FridayGateCard
              input={fridayInput}
              reopenPending={reopen.isPending}
              onReopen={() => reopen.mutate()}
            />
          )}
        {active && (
          <FixtureOrder sessionId={active.id} matches={matches.data || []} />
        )}
        {active && teams.data && matches.data && players.data && (
          <ReserveOperations
            sessionId={active.id}
            sessionStartsAt={active.starts_at}
            sessionEndsAt={active.ends_at}
            teams={teams.data}
            matches={matches.data}
            players={players.data}
            bookings={bookings.data || []}
            officialIds={officialIds}
          />
        )}
        <div className="list" style={{ marginTop: 12 }}>
          {matches.data?.map((m) => {
            const participantIds = new Set([
              ...(mainAssignments.data || [])
                .filter((p) =>
                  [m.home_team_id, m.away_team_id].includes(p.team_id),
                )
                .map((p) => p.user_id),
              ...(reserveAssignments.data || [])
                .filter((p) =>
                  [m.home_team_id, m.away_team_id].includes(p.team_id),
                )
                .map((p) => p.reserve_player?.member_user_id)
                .filter((id): id is string => !!id),
            ]);
            return (
              <Card key={m.id}>
                <div className="row">
                  <Link to={`/matches/${m.id}`}>
                    <strong>
                      {t("Match", "المباراة")} {m.order_no}: {m.home_team?.name}{" "}
                      {t("vs", "ضد")} {m.away_team?.name}
                    </strong>
                  </Link>
                  <span className="pill gray">
                    {ar
                      ? {
                          scheduled: "مجدولة",
                          live: "جارية",
                          paused: "متوقفة",
                          completed: "مكتملة",
                        }[m.status]
                      : m.status}
                  </span>
                  <span className="pill blue">
                    {ar
                      ? {
                          main_main: "أساسي ضد أساسي",
                          reserve_reserve: "احتياط ضد احتياط",
                          reserve_main: "احتياط ضد أساسي",
                        }[m.match_type]
                      : m.match_type.replaceAll("_", " vs ")}{" "}
                    · {m.duration_seconds / 60} {ar ? "دقائق" : "min"}
                  </span>
                </div>
                <div className="toolbar" style={{ marginTop: 12 }}>
                  {(["head", "assistant"] as const).map((role) => (
                    <label className="field" key={role}>
                      {ar
                        ? role === "head"
                          ? "الحكم الرئيسي"
                          : "الحكم المساعد"
                        : `${role} referee`}
                      <select
                        className="select"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value)
                            void assign(m.id, e.target.value, role);
                        }}
                      >
                        <option value="">{t("Assign", "تعيين")}</option>
                        {players.data
                          ?.filter(
                            (p) =>
                              officialIds.has(p.id) &&
                              !participantIds.has(p.id),
                          )
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
            );
          })}
        </div>
      </section>
    </div>
  );
}
