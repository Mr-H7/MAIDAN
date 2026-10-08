import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Match } from "../lib/types";
import { db } from "../lib/supabase";
import { ActionButton } from "./ui/ActionButton";
export function FixtureOrder({
  sessionId,
  matches,
}: {
  sessionId: string;
  matches: Match[];
}) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ordered = [...matches].sort((a, b) => a.order_no - b.order_no);
  const move = async (index: number, direction: -1 | 1) => {
    const next = [...ordered];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setBusy(true);
    const { error } = await db().rpc("set_match_order", {
      p_session_id: sessionId,
      p_order: next.map((m) => m.id),
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setError("");
      client.invalidateQueries({ queryKey: ["matches", sessionId] });
    }
  };
  if (!matches.length) return null;
  return (
    <div className="card">
      <h3 className="section-title">Match order</h3>
      <div className="list">
        {ordered.map((m, i) => (
          <div className="list-row" key={m.id}>
            <strong>
              {i + 1}. {m.home_team?.name} vs {m.away_team?.name}
            </strong>
            <div className="actions">
              <ActionButton
                variant="quiet"
                aria-label={`Move match ${i + 1} earlier`}
                disabled={
                  busy ||
                  i === 0 ||
                  ordered.some((x) => x.status !== "scheduled")
                }
                onClick={() => move(i, -1)}
              >
                ↑
              </ActionButton>
              <ActionButton
                variant="quiet"
                aria-label={`Move match ${i + 1} later`}
                disabled={
                  busy ||
                  i === ordered.length - 1 ||
                  ordered.some((x) => x.status !== "scheduled")
                }
                onClick={() => move(i, 1)}
              >
                ↓
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
      {error && <div className="notice error">{error}</div>}
    </div>
  );
}
