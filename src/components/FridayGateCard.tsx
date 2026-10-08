import { Link } from "react-router-dom";
import type { FridayGateInput } from "../lib/fridayGate";
import { fridaySteps } from "../lib/fridayGate";
import { useApp } from "../context/AppContext";
import { ActionButton } from "./ui/ActionButton";
import { Card } from "./ui/Card";

export function FridayGateCard({
  input,
  onReopen,
  reopenPending = false,
}: {
  input: FridayGateInput;
  onReopen?: () => void;
  reopenPending?: boolean;
}) {
  const { isAdmin, language } = useApp();
  const ar = language === "ar";
  const steps = fridaySteps(input);
  const current = steps.find((step) => step.current);
  if (!current) return null;
  const reopen = current.id === "confirmations" && current.actionEn === "Reopen roster";
  return (
    <Card className="empty friday-gate">
      <p>
        <strong>{ar ? current.ar : current.en}</strong>
      </p>
      <ol className="gate-list">
        {steps.map((step) => (
          <li key={step.id} className={step.current ? "current" : undefined}>
            {step.done ? "✓ " : step.current ? "→ " : ""}
            {ar ? step.ar : step.en}
          </li>
        ))}
      </ol>
      {isAdmin && reopen && onReopen && (
        <ActionButton disabled={reopenPending} onClick={onReopen}>
          {ar ? current.actionAr : current.actionEn}
        </ActionButton>
      )}
      {isAdmin && !reopen && (
        <Link to={current.href}>
          <ActionButton>{ar ? current.actionAr : current.actionEn}</ActionButton>
        </Link>
      )}
      {!isAdmin && (
        <p className="tiny">
          {ar
            ? "هذه الخطوة متاحة لمشرف المجموعة."
            : "A group admin completes this step."}
        </p>
      )}
    </Card>
  );
}
