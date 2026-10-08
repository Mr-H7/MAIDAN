import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../lib/supabase";
import type { Maqraa, Profile } from "../lib/types";
import { ActionButton } from "./ui/ActionButton";
import { Card } from "./ui/Card";
export function InitialAssessments({
  groupId,
  players,
}: {
  groupId: string;
  players: Profile[];
}) {
  const client = useQueryClient();
  const [userId, setUserId] = useState("");
  const [ovr, setOvr] = useState("50");
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await db().rpc("admin_set_initial_ovr", {
        p_group_id: groupId,
        p_user_id: userId,
        p_ovr: Number(ovr),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["players", groupId] });
      setNotice("Initial assessment saved.");
    },
    onError: (e) => setNotice(e.message),
  });
  return (
    <Card>
      <h2 className="section-title">Initial player assessment</h2>
      <div className="form-stack">
        <label className="field">
          Player
          <select
            className="select"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setOvr(
                players
                  .find((p) => p.id === e.target.value)
                  ?.initial_ovr?.toString() || "50",
              );
            }}
          >
            <option value="">Select player</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          OVR · 0 to 100
          <input
            type="number"
            min="0"
            max="100"
            value={ovr}
            onChange={(e) => setOvr(e.target.value)}
          />
        </label>
        <ActionButton
          disabled={
            !userId ||
            Number(ovr) < 0 ||
            Number(ovr) > 100 ||
            mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          Save assessment
        </ActionButton>
        {notice && (
          <div className={`notice ${mutation.isError ? "error" : "success"}`}>
            {notice}
          </div>
        )}
      </div>
    </Card>
  );
}
export function MaqraaCorrection({
  session,
  players,
}: {
  session: Maqraa;
  players: Profile[];
}) {
  const client = useQueryClient();
  const [userId, setUserId] = useState("");
  const [notice, setNotice] = useState("");
  const attendance = useQuery({
    queryKey: ["maqraaAttendance", session.id],
    queryFn: async () => {
      const { data, error } = await db()
        .from("maqraa_attendance")
        .select("user_id,checked_in_at,source")
        .eq("session_id", session.id);
      if (error) throw error;
      return data;
    },
  });
  const mutation = useMutation({
    mutationFn: async (present: boolean) => {
      const { error } = await db().rpc("admin_correct_maqraa", {
        p_session_id: session.id,
        p_user_id: userId,
        p_present: present,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["maqraaAttendance", session.id] });
      setNotice("Attendance correction saved.");
    },
    onError: (e) => setNotice(e.message),
  });
  return (
    <Card>
      <h2 className="section-title">Manual Maqraa correction</h2>
      <p className="muted tiny">
        {attendance.data?.length || 0} checked in · {session.title}
      </p>
      <div className="form-stack">
        <label className="field">
          Player
          <select
            className="select"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Select player</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
                {attendance.data?.some((a) => a.user_id === p.id) ? " ✓" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <ActionButton
            disabled={!userId || mutation.isPending}
            onClick={() => mutation.mutate(true)}
          >
            Mark present
          </ActionButton>
          <ActionButton
            variant="quiet"
            disabled={!userId || mutation.isPending}
            onClick={() => mutation.mutate(false)}
          >
            Remove check in
          </ActionButton>
        </div>
        {notice && (
          <div className={`notice ${mutation.isError ? "error" : "success"}`}>
            {notice}
          </div>
        )}
      </div>
    </Card>
  );
}
