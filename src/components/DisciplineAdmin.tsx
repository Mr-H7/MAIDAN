import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../lib/supabase";
import { ActionButton } from "./ui/ActionButton";
import { Card } from "./ui/Card";
type CardEvent = {
  id: string;
  group_id: string;
  player_id: string;
  event_type: "red" | "green";
  occurred_at: string;
  reversed_at: string | null;
  profiles: { full_name: string } | null;
};
export function DisciplineAdmin({
  groupId,
  enabled,
}: {
  groupId: string;
  enabled: boolean;
}) {
  const client = useQueryClient();
  const [green, setGreen] = useState("");
  const [red, setRed] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const cards = useQuery({
    queryKey: ["disciplinaryCards", groupId],
    queryFn: async () => {
      const { data, error } = await db()
        .from("match_events")
        .select(
          "id,group_id,player_id,event_type,occurred_at,reversed_at,profiles!match_events_player_id_fkey(full_name)",
        )
        .eq("group_id", groupId)
        .in("event_type", ["green", "red"])
        .is("reversed_at", null)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CardEvent[];
    },
  });
  const redemptions = useQuery({
    queryKey: ["redemptions", groupId],
    queryFn: async () => {
      const { data, error } = await db()
        .from("disciplinary_redemptions")
        .select("green_event_id,red_event_id")
        .eq("group_id", groupId);
      if (error) throw error;
      return data;
    },
  });
  const usedRed = new Set(redemptions.data?.map((x) => x.red_event_id));
  const usedGreen = new Set(redemptions.data?.map((x) => x.green_event_id));
  const redCards =
    cards.data?.filter((c) => c.event_type === "red" && !usedRed.has(c.id)) ||
    [];
  const greenCards =
    cards.data?.filter(
      (c) =>
        c.event_type === "green" &&
        !usedGreen.has(c.id) &&
        (!red || c.player_id === redCards.find((r) => r.id === red)?.player_id),
    ) || [];
  const save = async () => {
    setBusy(true);
    const { error } = await db().rpc("redeem_green_for_red", {
      p_green_event_id: green,
      p_red_event_id: red,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setNotice(
        "Redemption recorded. The red match event remains in the timeline.",
      );
      setGreen("");
      setRed("");
      setReason("");
      client.invalidateQueries({ queryKey: ["redemptions", groupId] });
    }
  };
  return (
    <Card>
      <h2 className="section-title">Disciplinary redemption</h2>
      <p className="muted tiny">
        Admin approval is required. Redemption is tracked separately from the
        match event.
      </p>
      <div className="form-stack">
        <label className="field">
          Red card
          <select
            className="select"
            value={red}
            onChange={(e) => {
              setRed(e.target.value);
              setGreen("");
            }}
          >
            <option value="">Select red card</option>
            {redCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.profiles?.full_name || c.player_id} ·{" "}
                {new Date(c.occurred_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Green card
          <select
            className="select"
            value={green}
            onChange={(e) => setGreen(e.target.value)}
          >
            <option value="">Select earned green card</option>
            {greenCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.profiles?.full_name || c.player_id} ·{" "}
                {new Date(c.occurred_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </label>
        <ActionButton
          disabled={
            !enabled || !red || !green || reason.trim().length < 5 || busy
          }
          onClick={save}
        >
          Authorize redemption
        </ActionButton>
        {!enabled && (
          <div className="notice">
            Enable redemption in group settings first.
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
      </div>
    </Card>
  );
}
