import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../context/AppContext";
import {
  getBookings,
  getFootball,
  getTeamPlayers,
  getTeams,
  publishTeams,
  reopenTeams,
  saveTeams,
} from "../lib/api";
import {
  balanceTeams,
  effectiveRating,
  teamAverage,
  type Assignment,
} from "../lib/balance";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import { FridayGateCard } from "../components/FridayGateCard";
import type { Profile } from "../lib/types";
export function TeamsPage() {
  const { groupId, isAdmin, language } = useApp();
  const ar = language === "ar";
  const client = useQueryClient();
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<Assignment[] | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sessions = useQuery({
    queryKey: ["football", groupId],
    queryFn: () => getFootball(groupId!),
    enabled: !!groupId,
  });
  const active =
    sessions.data?.find((x) => x.id === selected) ||
    sessions.data?.find((x) => x.status === "locked") ||
    sessions.data?.[0];
  const bookings = useQuery({
    queryKey: ["bookings", active?.id],
    queryFn: () => getBookings(active!.id),
    enabled: !!active,
  });
  const teams = useQuery({
    queryKey: ["teams", active?.id],
    queryFn: () => getTeams(active!.id),
    enabled: !!active,
  });
  const teamPlayers = useQuery({
    queryKey: ["teamPlayers", active?.id],
    queryFn: () => getTeamPlayers(active!.id),
    enabled: !!active,
  });
  const assignments = useMemo(
    () =>
      draft ||
      teams.data?.map((t) => ({
        name: t.name,
        color: t.color,
        userIds:
          teamPlayers.data
            ?.filter((p) => p.team_id === t.id)
            .map((p) => p.user_id) || [],
      })) ||
      [],
    [draft, teams.data, teamPlayers.data],
  );
  const profiles = new Map<string, Profile>(
    (bookings.data || [])
      .filter((x) => x.profile)
      .map((x) => [x.user_id, x.profile!]),
  );
  const saved = useMutation({
    mutationFn: () => saveTeams(active!.id, assignments),
    onSuccess: () => {
      setDraft(null);
      client.invalidateQueries({ queryKey: ["teams", active?.id] });
      client.invalidateQueries({ queryKey: ["teamPlayers", active?.id] });
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  const published = useMutation({
    mutationFn: () => publishTeams(active!.id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["teams", active?.id] }),
    onError: (e) => setError(e.message),
  });
  const reopened = useMutation({
    mutationFn: () => reopenTeams(active!.id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["teams", active?.id] });
      client.invalidateQueries({ queryKey: ["matches", active?.id] });
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  const generate = () => {
    try {
      setDraft(balanceTeams(bookings.data || []));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const move = (userId: string, target: number) => {
    const copy = assignments.map((a) => ({ ...a, userIds: [...a.userIds] }));
    const source = copy.findIndex((a) => a.userIds.includes(userId));
    if (source < 0 || source === target) return;
    if (copy[target].userIds.length >= 5) {
      setError(
        ar
          ? "الفريق ممتلئ. اختر لاعبًا منه للتبديل."
          : "Target team is full. Select a player there to swap.",
      );
      return;
    }
    copy[source].userIds = copy[source].userIds.filter((id) => id !== userId);
    copy[target].userIds.push(userId);
    setDraft(copy);
    setMoving(null);
    setError("");
  };
  const swap = (a: string, b: string) => {
    const copy = assignments.map((t) => ({ ...t, userIds: [...t.userIds] }));
    const ai = copy.findIndex((t) => t.userIds.includes(a)),
      bi = copy.findIndex((t) => t.userIds.includes(b));
    if (ai < 0 || bi < 0 || ai === bi) return;
    copy[ai].userIds[copy[ai].userIds.indexOf(a)] = b;
    copy[bi].userIds[copy[bi].userIds.indexOf(b)] = a;
    setDraft(copy);
    setMoving(null);
  };
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">{ar ? "كرة الجمعة" : "Friday football"}</span>
        <h1 className="page-title">{ar ? "تكوين الفرق" : "Team builder"}</h1>
        <p className="muted">
          {ar
            ? "توزيع ثابت يراعي التقييمات. تُحفظ تعديلات المشرف في قاعدة بيانات المجموعة."
            : "Rating aware, deterministic assignments. Admin changes are saved to the group database."}
        </p>
      </div>
      {(sessions.data?.length || 0) > 1 && (
        <select
          className="select"
          aria-label={ar ? "الجلسة" : "Session"}
          value={selected || active?.id || ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          {sessions.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {new Date(s.starts_at).toLocaleDateString(ar ? "ar" : "en", {
                timeZone: "Africa/Cairo",
              })}
            </option>
          ))}
        </select>
      )}
      {sessions.isSuccess && !active && (
        <FridayGateCard
          input={{
            hasSession: false,
            sessionStatus: null,
            confirmedCount: 0,
            teamCount: 0,
            publishedTeamCount: 0,
            matchCount: 0,
          }}
        />
      )}
      {active && (
        <>
          <div className="toolbar">
            <span className="pill gray">
              {ar ? "القائمة" : "Roster"}{" "}
              {ar
                ? { open: "مفتوحة", locked: "مغلقة", completed: "مكتملة" }[
                    active.status
                  ]
                : active.status}
            </span>
            <span className="pill blue">
              {bookings.data?.filter((x) => x.status === "confirmed").length ||
                0}{" "}
              {ar ? "مؤكد" : "confirmed"}
            </span>
            {isAdmin && (
              <>
                <ActionButton
                  disabled={active.status !== "locked"}
                  onClick={generate}
                >
                  {ar ? "تكوين ٤ × ٥" : "Generate 4 × 5"}
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  disabled={!draft || saved.isPending}
                  onClick={() => saved.mutate()}
                >
                  {ar ? "حفظ المسودة" : "Save draft"}
                </ActionButton>
                <ActionButton
                  variant="quiet"
                  disabled={
                    !!draft ||
                    !teams.data?.length ||
                    published.isPending ||
                    teams.data?.[0]?.status === "published"
                  }
                  onClick={() => published.mutate()}
                >
                  {ar ? "نشر الفرق" : "Publish teams"}
                </ActionButton>
                {teams.data?.[0]?.status === "published" && (
                  <ActionButton
                    variant="quiet"
                    disabled={reopened.isPending}
                    onClick={() => reopened.mutate()}
                  >
                    {ar ? "إعادة فتح التوزيع" : "Reopen assignments"}
                  </ActionButton>
                )}
              </>
            )}
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {assignments.length === 0 && bookings.isSuccess && (
            <FridayGateCard
              input={{
                hasSession: true,
                sessionStatus: active.status,
                confirmedCount:
                  bookings.data?.filter((row) => row.status === "confirmed")
                    .length || 0,
                teamCount: teams.data?.length || 0,
                publishedTeamCount:
                  teams.data?.filter((team) => team.status === "published")
                    .length || 0,
                matchCount: 0,
              }}
            />
          )}
          <div className="team-grid">
            {assignments.map((team, index) => {
              const members = team.userIds
                .map((id) => profiles.get(id))
                .filter(Boolean) as Profile[];
              return (
                <Card key={team.name} className="team-card">
                  <div className="row">
                    <h2 className="section-title" style={{ margin: 0 }}>
                      {team.name}
                    </h2>
                    <span className="pill blue">
                      {ar ? "التقييم" : "OVR"} {teamAverage(members)}
                    </span>
                  </div>
                  <p className="muted tiny">
                    {members.length} {ar ? "لاعبين" : "players"} ·{" "}
                    {ar
                      ? teams.data?.[index]?.status === "published"
                        ? "منشور"
                        : teams.data?.[index]?.status === "draft"
                          ? "مسودة"
                          : "مسودة غير محفوظة"
                      : teams.data?.[index]?.status || "unsaved draft"}
                  </p>
                  <div className="list">
                    {members.map((p) => (
                      <div className="list-row" key={p.id}>
                        <div>
                          <strong>{p.full_name}</strong>
                          <small>
                            {p.preferred_position ||
                              (ar ? "أي مركز" : "Any position")}{" "}
                            · {effectiveRating(p)} {ar ? "تقييم" : "OVR"}
                          </small>
                        </div>
                        {isAdmin && (
                          <button
                            className="icon-button"
                            aria-label={
                              ar
                                ? `اختر ${p.full_name} للتبديل`
                                : `Select ${p.full_name} for swap`
                            }
                            onClick={() => {
                              if (moving && moving !== p.id) swap(moving, p.id);
                              else setMoving(p.id);
                            }}
                            style={{
                              color:
                                moving === p.id ? "var(--teal)" : undefined,
                            }}
                          >
                            ⇄
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {isAdmin && moving && (
                    <ActionButton
                      variant="quiet"
                      onClick={() => move(moving, index)}
                    >
                      {ar ? "انقل اللاعب المحدد هنا" : "Move selected here"}
                    </ActionButton>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
