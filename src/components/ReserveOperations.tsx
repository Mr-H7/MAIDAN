import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdditionalMatch,
  createReservePair,
  createReserveTeam,
  getReservePlayers,
  getReserveTeamPlayers,
  getTeamPlayers,
  registerReservePlayer,
} from "../lib/api";
import {
  balanceReservePair,
  matchDuration,
  remainingSessionSeconds,
  validSides,
  type MatchType,
} from "../lib/reserveRules";
import type { Booking, Match, Profile, Team } from "../lib/types";
import { useApp } from "../context/AppContext";
import { ActionButton } from "./ui/ActionButton";
import { Card } from "./ui/Card";

export function ReserveOperations({
  sessionId,
  sessionStartsAt,
  sessionEndsAt,
  teams,
  matches,
  players,
  bookings,
  officialIds,
}: {
  sessionId: string;
  sessionStartsAt: string;
  sessionEndsAt: string;
  teams: Team[];
  matches: Match[];
  players: Profile[];
  bookings: Booking[];
  officialIds: Set<string>;
}) {
  const { language } = useApp();
  const ar = language === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [ovr, setOvr] = useState("");
  const [memberId, setMemberId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState<MatchType>("reserve_reserve");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [schedulePosition, setSchedulePosition] = useState(matches.length + 1);
  const [refereeId, setRefereeId] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [notice, setNotice] = useState("");
  const reserve = useQuery({
    queryKey: ["reservePlayers", sessionId],
    queryFn: () => getReservePlayers(sessionId),
  });
  const reserveTeamPlayers = useQuery({
    queryKey: ["reserveTeamPlayers", sessionId],
    queryFn: () => getReserveTeamPlayers(sessionId),
  });
  const mainTeamPlayers = useQuery({
    queryKey: ["teamPlayers", sessionId],
    queryFn: () => getTeamPlayers(sessionId),
  });
  const assigned = new Set(
    reserveTeamPlayers.data?.map((p) => p.reserve_player_id),
  );
  const waiting = reserveTeamPlayers.isSuccess
    ? reserve.data?.filter((p) => !assigned.has(p.id)) || []
    : [];
  const selectedPlayers = selected
    .map((id) => waiting.find((p) => p.id === id))
    .filter((p) => !!p);
  const home = teams.find((team) => team.id === homeId);
  const away = teams.find((team) => team.id === awayId);
  const mainDelayed = matches.some(
    (match) =>
      match.match_type === "main_main" && match.order_no >= schedulePosition,
  );
  const availableSeconds = remainingSessionSeconds(
    sessionStartsAt,
    sessionEndsAt,
    matches.map((match) => match.duration_seconds),
  );
  const participants = useMemo(() => {
    const ids = new Set<string>();
    for (const p of mainTeamPlayers.data || [])
      if ([homeId, awayId].includes(p.team_id)) ids.add(p.user_id);
    for (const assignment of reserveTeamPlayers.data || []) {
      if (
        [homeId, awayId].includes(assignment.team_id) &&
        assignment.reserve_player?.member_user_id
      )
        ids.add(assignment.reserve_player.member_user_id);
    }
    return ids;
  }, [homeId, awayId, mainTeamPlayers.data, reserveTeamPlayers.data]);
  const eligibleOfficials = players.filter(
    (p) => officialIds.has(p.id) && !participants.has(p.id),
  );
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservePlayers", sessionId] });
    queryClient.invalidateQueries({
      queryKey: ["reserveTeamPlayers", sessionId],
    });
    queryClient.invalidateQueries({ queryKey: ["teams", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["matches", sessionId] });
  };
  const addPlayer = useMutation({
    mutationFn: () =>
      registerReservePlayer(
        sessionId,
        name,
        position || null,
        ovr ? Number(ovr) : null,
        memberId || null,
      ),
    onSuccess: () => {
      invalidate();
      setName("");
      setOvr("");
      setMemberId("");
      setNotice(
        t("Added to reserve waiting list.", "أُضيف إلى قائمة انتظار الاحتياط."),
      );
    },
    onError: (error) => setNotice(error.message),
  });
  const makeTeam = useMutation({
    mutationFn: async () => {
      if (selected.length === 10) {
        const [first, second] = balanceReservePair(selectedPlayers);
        return createReservePair(
          sessionId,
          first,
          second,
          teams.filter((team) => team.kind === "reserve").length + 1,
        );
      }
      if (selected.length === 5)
        return createReserveTeam(
          sessionId,
          `Reserve ${teams.filter((team) => team.kind === "reserve").length + 1}`,
          "#14B8A6",
          selected,
        );
      throw new Error("Select five or ten waiting reserves.");
    },
    onSuccess: () => {
      invalidate();
      setSelected([]);
      setNotice(t("Reserve team assignments saved.", "حُفظت فرق الاحتياط."));
    },
    onError: (error) => setNotice(error.message),
  });
  const addFixture = useMutation({
    mutationFn: () =>
      createAdditionalMatch({
        sessionId,
        type,
        homeId,
        awayId,
        position: schedulePosition,
        refereeId,
        acknowledgeMainDelay: acknowledge,
      }),
    onSuccess: () => {
      invalidate();
      setHomeId("");
      setAwayId("");
      setRefereeId("");
      setAcknowledge(false);
      setSchedulePosition(matches.length + 2);
      setNotice(t("Additional fixture saved.", "حُفظت المباراة الإضافية."));
    },
    onError: (error) => setNotice(error.message),
  });
  const candidates = teams.filter((team) => team.status === "published");
  const mainReady =
    teams.filter((team) => team.kind === "main" && team.status === "published")
      .length === 4 &&
    matches.filter((match) => match.match_type === "main_main").length >= 6;
  const kindLabel = (kind: Team["kind"]) =>
    kind === "main" ? t("Main", "أساسي") : t("Reserve", "احتياط");
  const positionLabel = (value: string) =>
    ar
      ? (
          {
            Goalkeeper: "حارس",
            Defender: "مدافع",
            Midfielder: "وسط",
            Forward: "مهاجم",
          } as Record<string, string>
        )[value]
      : value;
  const unconfirmedMembers = players.filter(
    (p) =>
      !bookings.some(
        (booking) => booking.user_id === p.id && booking.status === "confirmed",
      ) && !reserve.data?.some((r) => r.member_user_id === p.id),
  );
  return (
    <section
      className="page-stack"
      aria-label={t("Reserve match operations", "إدارة مباريات الاحتياط")}
    >
      <div>
        <h2 className="section-title">
          {t("Reserve match operations", "إدارة مباريات الاحتياط")}
        </h2>
        <p className="muted tiny">
          {t(
            "Confirmed players and published main teams retain priority. Reserve fixtures require explicit approval.",
            "تبقى الأولوية للاعبين المؤكدين والفرق الأساسية المنشورة. تتطلب مباريات الاحتياط موافقة صريحة.",
          )}
        </p>
      </div>
      <Card>
        <h3 className="section-title">
          {t("Reserve waiting list", "قائمة انتظار الاحتياط")}
        </h3>
        <div className="form-stack">
          <label className="field">
            {t("Existing member (optional)", "عضو موجود (اختياري)")}
            <select
              className="select"
              value={memberId}
              onChange={(event) => {
                const id = event.target.value;
                setMemberId(id);
                const member = players.find((p) => p.id === id);
                if (member) setName(member.full_name);
              }}
            >
              <option value="">
                {t("Temporary walk-in profile", "ملف لاعب زائر مؤقت")}
              </option>
              {unconfirmedMembers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t("Player name", "اسم اللاعب")}
            <input
              className="input"
              value={name}
              maxLength={100}
              readOnly={!!memberId}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            {t("Position", "المركز")}
            <select
              className="select"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">{t("Unknown", "غير محدد")}</option>
              {["Goalkeeper", "Defender", "Midfielder", "Forward"].map(
                (value) => (
                  <option key={value} value={value}>
                    {positionLabel(value)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="field">
            {t("Estimated OVR (optional)", "التقييم التقديري (اختياري)")}
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              value={ovr}
              onChange={(e) => setOvr(e.target.value)}
            />
          </label>
          <ActionButton
            disabled={name.trim().length < 2 || addPlayer.isPending}
            onClick={() => addPlayer.mutate()}
          >
            {t("Add to waiting list", "أضف إلى قائمة الانتظار")}
          </ActionButton>
        </div>
        {reserve.isLoading && (
          <p role="status">{t("Loading reserves…", "جارٍ تحميل الاحتياط…")}</p>
        )}
        {reserve.isError && (
          <p className="notice error" role="alert">
            {t("Could not load reserves.", "تعذّر تحميل الاحتياط.")}
          </p>
        )}
        {reserveTeamPlayers.isError && (
          <p className="notice error" role="alert">
            {t(
              "Could not verify reserve assignments.",
              "تعذّر التحقق من توزيع الاحتياط.",
            )}
          </p>
        )}
        <div className="list" style={{ marginTop: 12 }}>
          {waiting.map((player) => (
            <label className="list-row" key={player.id}>
              <span>
                <strong>{player.full_name}</strong>
                <small>
                  {player.estimated_ovr ?? "—"} OVR ·{" "}
                  {player.preferred_position ||
                    t("Unknown position", "مركز غير محدد")}
                </small>
              </span>
              <input
                type="checkbox"
                checked={selected.includes(player.id)}
                disabled={
                  !selected.includes(player.id) && selected.length >= 10
                }
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, player.id]
                      : selected.filter((id) => id !== player.id),
                  )
                }
                aria-label={t(
                  `Select ${player.full_name}`,
                  `اختر ${player.full_name}`,
                )}
              />
            </label>
          ))}
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <ActionButton
            variant="secondary"
            disabled={
              !mainReady ||
              !reserveTeamPlayers.isSuccess ||
              selected.length !== 5 ||
              makeTeam.isPending
            }
            onClick={() => makeTeam.mutate()}
          >
            {t("Save one team of five", "احفظ فريقًا من خمسة")}
          </ActionButton>
          <ActionButton
            disabled={
              !mainReady ||
              !reserveTeamPlayers.isSuccess ||
              selected.length !== 10 ||
              makeTeam.isPending
            }
            onClick={() => makeTeam.mutate()}
          >
            {t("Balance and save two teams", "وازن واحفظ فريقين")}
          </ActionButton>
        </div>
        {!mainReady && (
          <p className="tiny muted">
            {t(
              "Publish all four main teams and generate their fixtures before creating reserve teams.",
              "انشر الفرق الأساسية الأربعة وجدول مبارياتها قبل إنشاء فرق الاحتياط.",
            )}
          </p>
        )}
      </Card>
      {teams.some((team) => team.kind === "reserve") && (
        <Card>
          <h3 className="section-title">
            {t("Saved reserve teams", "فرق الاحتياط المحفوظة")}
          </h3>
          <div className="grid-two">
            {teams
              .filter((team) => team.kind === "reserve")
              .map((team) => {
                const members = (reserveTeamPlayers.data || []).filter(
                  (assignment) => assignment.team_id === team.id,
                );
                const average =
                  members.length === 5
                    ? Math.round(
                        members.reduce(
                          (sum, assignment) =>
                            sum +
                            (assignment.reserve_player?.estimated_ovr ?? 50),
                          0,
                        ) / 5,
                      )
                    : null;
                return (
                  <div className="card" key={team.id}>
                    <div className="row">
                      <strong>{team.name}</strong>
                      <span className="pill blue">
                        {t("Average OVR", "متوسط التقييم")} {average ?? "—"}
                      </span>
                    </div>
                    <div className="list">
                      {members.map((assignment) => (
                        <div className="list-row" key={assignment.id}>
                          <span>
                            {assignment.reserve_player?.full_name ||
                              assignment.reserve_player_id}
                          </span>
                          <small>
                            {assignment.reserve_player?.estimated_ovr ?? "—"}{" "}
                            OVR
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}
      <Card>
        <h3 className="section-title">{t("Add a fixture", "أضف مباراة")}</h3>
        <div className="form-stack">
          <label className="field">
            {t("Match type", "نوع المباراة")}
            <select
              className="select"
              value={type}
              onChange={(e) => {
                setType(e.target.value as MatchType);
                setHomeId("");
                setAwayId("");
              }}
            >
              <option value="main_main">
                {t("Main vs Main", "أساسي ضد أساسي")}
              </option>
              <option value="reserve_reserve">
                {t("Reserve vs Reserve", "احتياط ضد احتياط")}
              </option>
              <option value="reserve_main">
                {t("Reserve vs Main", "احتياط ضد أساسي")}
              </option>
            </select>
          </label>
          <p className="pill blue">
            {matchDuration[type] / 60} {t("minutes", "دقائق")}
          </p>
          <p className="tiny muted">
            {t("Unallocated session time", "الوقت غير المخصص من الجلسة")}:{" "}
            {Math.floor(availableSeconds / 60)} {t("minutes", "دقائق")}
          </p>
          <label className="field">
            {t("Home team", "الفريق الأول")}
            <select
              className="select"
              value={homeId}
              onChange={(e) => {
                setHomeId(e.target.value);
                setRefereeId("");
              }}
            >
              <option value="">{t("Select team", "اختر الفريق")}</option>
              {candidates
                .filter((team) =>
                  type === "main_main"
                    ? team.kind === "main"
                    : type === "reserve_reserve"
                      ? team.kind === "reserve"
                      : true,
                )
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} · {kindLabel(team.kind)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            {t("Away team", "الفريق الثاني")}
            <select
              className="select"
              value={awayId}
              onChange={(e) => {
                setAwayId(e.target.value);
                setRefereeId("");
              }}
            >
              <option value="">{t("Select team", "اختر الفريق")}</option>
              {candidates
                .filter(
                  (team) =>
                    team.id !== homeId &&
                    (!home || validSides(type, home.kind, team.kind)),
                )
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} · {kindLabel(team.kind)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            {t("Position in schedule", "الترتيب في الجدول")}
            <select
              className="select"
              value={schedulePosition}
              onChange={(e) => {
                setSchedulePosition(Number(e.target.value));
                setAcknowledge(false);
              }}
            >
              {Array.from({ length: matches.length + 1 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          {type !== "main_main" && mainDelayed && (
            <div className="notice" role="alert">
              {t(
                "This position delays a scheduled main fixture. Confirmed players keep their full 10-minute match and original teams.",
                "هذا الموضع يؤخر مباراة أساسية مجدولة. يحتفظ اللاعبون المؤكدون بمباراتهم الكاملة لمدة 10 دقائق وفرقهم الأصلية.",
              )}
              <label className="row-start">
                <input
                  type="checkbox"
                  checked={acknowledge}
                  onChange={(e) => setAcknowledge(e.target.checked)}
                />
                {t(
                  "I approve this schedule change",
                  "أوافق على تغيير الترتيب هذا",
                )}
              </label>
            </div>
          )}
          <label className="field">
            {t("Head referee", "الحكم الرئيسي")}
            <select
              className="select"
              value={refereeId}
              onChange={(e) => setRefereeId(e.target.value)}
            >
              <option value="">
                {t("Select eligible admin", "اختر مشرفًا مؤهلًا")}
              </option>
              {eligibleOfficials.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          {eligibleOfficials[0] && (
            <p className="tiny muted">
              {t("Available referee suggestion", "اقتراح حكم متاح")}:{" "}
              {eligibleOfficials[0].full_name}
            </p>
          )}
          <ActionButton
            disabled={
              !mainTeamPlayers.isSuccess ||
              !reserveTeamPlayers.isSuccess ||
              availableSeconds < matchDuration[type] ||
              !home ||
              !away ||
              !validSides(type, home.kind, away.kind) ||
              !refereeId ||
              (type !== "main_main" && mainDelayed && !acknowledge) ||
              addFixture.isPending
            }
            onClick={() => addFixture.mutate()}
          >
            {t("Approve and save fixture", "وافق واحفظ المباراة")}
          </ActionButton>
          {availableSeconds < matchDuration[type] && (
            <p className="notice error" role="alert">
              {t(
                "Not enough session time for another full match.",
                "لا يوجد وقت كافٍ لمباراة كاملة أخرى.",
              )}
            </p>
          )}
        </div>
      </Card>
      {notice && (
        <div
          className={`notice ${addPlayer.isError || makeTeam.isError || addFixture.isError ? "error" : "success"}`}
          role="status"
        >
          {notice}
        </div>
      )}
    </section>
  );
}
