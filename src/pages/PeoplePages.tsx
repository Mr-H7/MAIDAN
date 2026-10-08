import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../context/AppContext";
import { getPlayerStats, getPlayers, updateProfile } from "../lib/api";
import { db } from "../lib/supabase";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
export function PlayersPage() {
  const { groupId, language } = useApp();
  const ar = language === "ar";
  const players = useQuery({
    queryKey: ["players", groupId],
    queryFn: () => getPlayers(groupId!),
    enabled: !!groupId,
  });
  const [search, setSearch] = useState("");
  const filtered =
    players.data?.filter((p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">{ar ? "المجتمع" : "Community"}</span>
        <h1 className="page-title">
          {ar ? "دليل اللاعبين" : "Player directory"}
        </h1>
        <p className="muted">
          {ar
            ? "اللاعبون في مجموعتك الحالية."
            : "Players in your current group."}
        </p>
      </div>
      <Field
        label={ar ? "ابحث عن اللاعبين" : "Search players"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={ar ? "الاسم" : "Name"}
      />
      <div className="grid-two">
        {filtered.map((player) => (
          <Card key={player.id}>
            <div className="row-start">
              <div className="avatar">{player.full_name[0]}</div>
              <div>
                <strong>{player.full_name}</strong>
                <div className="muted tiny">
                  {player.preferred_position ||
                    (ar ? "لم يُحدد المركز" : "Position not set")}
                </div>
              </div>
            </div>
            {(player.overall_ovr != null || player.initial_ovr != null) && (
              <div className="pill blue" style={{ marginTop: 14 }}>
                {player.overall_ovr != null
                  ? ar
                    ? "المجتمع"
                    : "Community"
                  : ar
                    ? "الأولي"
                    : "Initial"}{" "}
                {ar ? "تقييم" : "OVR"}{" "}
                {player.overall_ovr ?? player.initial_ovr}
              </div>
            )}
          </Card>
        ))}
      </div>
      {players.isLoading && (
        <div role="status">
          {ar ? "جارٍ تحميل اللاعبين…" : "Loading players…"}
        </div>
      )}
      {players.isError && (
        <div className="notice error">
          {ar ? "تعذّر تحميل اللاعبين." : "Could not load players."}
        </div>
      )}
      {players.data?.length === 0 && (
        <Card className="empty">
          {ar
            ? "لم ينضم لاعبون لهذه المجموعة بعد."
            : "No players have joined this group."}
        </Card>
      )}
    </div>
  );
}
export function ProfilePage() {
  const { user, profile, memberships, groupId, selectGroup, language } =
    useApp();
  const ar = language === "ar";
  const client = useQueryClient();
  const stats = useQuery({
    queryKey: ["playerStats", groupId, user?.id],
    queryFn: () => getPlayerStats(groupId!, user!.id),
    enabled: !!groupId && !!user,
  });
  const [name, setName] = useState(profile?.full_name || "");
  const [position, setPosition] = useState(profile?.preferred_position || "");
  const [selfOvr, setSelfOvr] = useState(profile?.self_ovr?.toString() || "");
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      updateProfile(user!.id, {
        full_name: name.trim(),
        preferred_position: position || null,
        self_ovr: selfOvr ? Number(selfOvr) : null,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["profile", user?.id] });
      setNotice(ar ? "حُفظ الملف الشخصي." : "Profile saved.");
    },
    onError: (e) => setNotice(e.message),
  });
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">{ar ? "حسابك" : "Your account"}</span>
        <h1 className="page-title">{ar ? "ملف اللاعب" : "Player profile"}</h1>
        <p className="muted">{user?.email}</p>
      </div>
      <Card>
        <div className="form-stack">
          <Field
            label={ar ? "الاسم الكامل" : "Full name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
          <label className="field">
            {ar ? "المركز المفضل" : "Preferred position"}
            <select
              className="select"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">{ar ? "غير محدد" : "Not set"}</option>
              {["Goalkeeper", "Defender", "Midfielder", "Forward"].map((x) => (
                <option key={x} value={x}>
                  {ar
                    ? {
                        Goalkeeper: "حارس مرمى",
                        Defender: "مدافع",
                        Midfielder: "وسط",
                        Forward: "مهاجم",
                      }[x]
                    : x}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={ar ? "تقييمك الذاتي (٠–١٠٠)" : "Self assessment OVR (0–100)"}
            type="number"
            min={0}
            max={100}
            value={selfOvr}
            onChange={(e) => setSelfOvr(e.target.value)}
          />
          <p className="tiny muted">
            {ar
              ? "تقييمك الذاتي منفصل عن تقييم المجتمع."
              : "Your self assessment is separate from the community rating."}
          </p>
          <ActionButton
            disabled={
              mutation.isPending ||
              !name.trim() ||
              Number(selfOvr) > 100 ||
              Number(selfOvr) < 0
            }
            onClick={() => mutation.mutate()}
          >
            {ar ? "حفظ الملف" : "Save profile"}
          </ActionButton>
          {notice && (
            <div
              className={`notice ${mutation.isError ? "error" : "success"}`}
              role="status"
            >
              {notice}
            </div>
          )}
        </div>
      </Card>
      <Card>
        <h2 className="section-title">{ar ? "إحصاءاتي" : "My statistics"}</h2>
        {stats.isLoading && (
          <p className="muted">
            {ar ? "جارٍ تحميل الإحصاءات…" : "Loading statistics…"}
          </p>
        )}
        {stats.isError && (
          <p className="notice error">
            {ar ? "تعذّر تحميل الإحصاءات." : "Could not load statistics."}
          </p>
        )}
        {stats.data && (
          <div className="metric-grid">
            {[
              [ar ? "الأهداف" : "Goals", stats.data.goals],
              [ar ? "البطاقات الصفراء" : "Yellow cards", stats.data.yellow],
              [ar ? "البطاقات الحمراء" : "Red cards", stats.data.red],
              [ar ? "البطاقات الخضراء" : "Green cards", stats.data.green],
              [
                ar ? "تقييم المجتمع" : "Community OVR",
                stats.data.communityOvr ?? "—",
              ],
            ].map(([label, value]) => (
              <div className="metric" key={label}>
                <div className="stat">{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="section-title">{ar ? "المجموعات" : "Groups"}</h2>
        <div className="list">
          {memberships.map((m) => (
            <div className="list-row" key={m.group_id}>
              <div>
                <strong>{m.group.name}</strong>
                <div className="muted tiny">
                  {ar
                    ? {
                        player: "لاعب",
                        group_admin: "مشرف المجموعة",
                        super_admin: "مشرف عام",
                      }[m.role]
                    : m.role.replace("_", " ")}
                </div>
              </div>
              <button
                className="group-switch"
                type="button"
                disabled={m.group_id === groupId}
                onClick={() => selectGroup(m.group_id)}
                aria-label={
                  ar ? `انتقل إلى ${m.group.name}` : `Switch to ${m.group.name}`
                }
              >
                {m.group_id === groupId
                  ? ar
                    ? "الحالية"
                    : "Current"
                  : ar
                    ? "انتقال"
                    : "Switch"}
              </button>
            </div>
          ))}
        </div>
      </Card>
      <ActionButton variant="quiet" onClick={() => db().auth.signOut()}>
        {ar ? "تسجيل الخروج" : "Sign out"}
      </ActionButton>
    </div>
  );
}
