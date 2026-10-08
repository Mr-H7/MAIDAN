import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../context/AppContext";
import { getPlayers, updateProfile } from "../lib/api";
import { db } from "../lib/supabase";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
export function PlayersPage() {
  const { groupId } = useApp();
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
        <span className="eyebrow">Community</span>
        <h1 className="page-title">Player directory</h1>
        <p className="muted">Players in your current group.</p>
      </div>
      <Field
        label="Search players"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Name"
      />
      <div className="grid-two">
        {filtered.map((player) => (
          <Card key={player.id}>
            <div className="row-start">
              <div className="avatar">{player.full_name[0]}</div>
              <div>
                <strong>{player.full_name}</strong>
                <div className="muted tiny">
                  {player.preferred_position || "Position not set"}
                </div>
              </div>
            </div>
            {(player.overall_ovr != null || player.initial_ovr != null) && (
              <div className="pill blue" style={{ marginTop: 14 }}>
                {player.overall_ovr != null ? "Community" : "Initial"} OVR{" "}
                {player.overall_ovr ?? player.initial_ovr}
              </div>
            )}
          </Card>
        ))}
      </div>
      {players.isLoading && <div role="status">Loading players…</div>}
      {players.isError && (
        <div className="notice error">Could not load players.</div>
      )}
      {players.data?.length === 0 && (
        <Card className="empty">No players have joined this group.</Card>
      )}
    </div>
  );
}
export function ProfilePage() {
  const { user, profile, memberships, groupId, selectGroup } = useApp();
  const client = useQueryClient();
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
      setNotice("Profile saved.");
    },
    onError: (e) => setNotice(e.message),
  });
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">Your account</span>
        <h1 className="page-title">Player profile</h1>
        <p className="muted">{user?.email}</p>
      </div>
      <Card>
        <div className="form-stack">
          <Field
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
          <label className="field">
            Preferred position
            <select
              className="select"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">Not set</option>
              {["Goalkeeper", "Defender", "Midfielder", "Forward"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <Field
            label="Self assessment OVR (0–100)"
            type="number"
            min={0}
            max={100}
            value={selfOvr}
            onChange={(e) => setSelfOvr(e.target.value)}
          />
          <p className="tiny muted">
            Your self assessment is separate from the community rating.
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
            Save profile
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
        <h2 className="section-title">Groups</h2>
        <div className="list">
          {memberships.map((m) => (
            <div className="list-row" key={m.group_id}>
              <div>
                <strong>{m.group.name}</strong>
                <div className="muted tiny">{m.role.replace("_", " ")}</div>
              </div>
              <button
                className="group-switch"
                type="button"
                disabled={m.group_id === groupId}
                onClick={() => selectGroup(m.group_id)}
                aria-label={`Switch to ${m.group.name}`}
              >
                {m.group_id === groupId ? "Current" : "Switch"}
              </button>
            </div>
          ))}
        </div>
      </Card>
      <ActionButton variant="quiet" onClick={() => db().auth.signOut()}>
        Sign out
      </ActionButton>
    </div>
  );
}
