import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Match } from "../lib/types";
import { db } from "../lib/supabase";
import { ActionButton } from "./ui/ActionButton";
import { useApp } from "../context/AppContext";
export function FixtureOrder({
  sessionId,
  matches,
}: {
  sessionId: string;
  matches: Match[];
}) {
  const { language } = useApp();
  const ar = language === "ar";
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
  if (matches.some((match) => match.match_type !== "main_main"))
    return (
      <div className="notice">
        {ar
          ? "يُعتمد موضع مباريات الاحتياط عند إنشائها. لا يمكن إعادة ترتيب جدول مختلط دون مراجعة أولوية المباريات الأساسية."
          : "Reserve positions are approved when created. Mixed schedules cannot be reordered without reviewing main-fixture priority."}
      </div>
    );
  return (
    <div className="card">
      <h3 className="section-title">
        {ar ? "ترتيب المباريات" : "Match order"}
      </h3>
      <div className="list">
        {ordered.map((m, i) => (
          <div className="list-row" key={m.id}>
            <strong>
              {i + 1}. {m.home_team?.name} {ar ? "ضد" : "vs"}{" "}
              {m.away_team?.name}
            </strong>
            <div className="actions">
              <ActionButton
                variant="quiet"
                aria-label={
                  ar ? `تقديم المباراة ${i + 1}` : `Move match ${i + 1} earlier`
                }
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
                aria-label={
                  ar ? `تأخير المباراة ${i + 1}` : `Move match ${i + 1} later`
                }
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
