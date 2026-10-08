import { useState } from "react";
import { Link } from "react-router-dom";
import { Flag, Play, Pause, Square, Undo2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import {
  demoTeams,
  demoTransition,
  loadDemoState,
  saveDemoState,
  type DemoEventType,
  type DemoState,
} from "../lib/demoMatch";
import { matchControlRequirements } from "../lib/fridayGate";

const labels: Record<DemoEventType, { en: string; ar: string }> = {
  goal: { en: "Goal", ar: "هدف" },
  yellow: { en: "Yellow", ar: "صفراء" },
  red: { en: "Red", ar: "حمراء" },
  green: { en: "Green", ar: "خضراء" },
};

export function MatchDemoPage() {
  const { language, membership } = useApp();
  const ar = language === "ar";
  const [state, setState] = useState<DemoState>(() => loadDemoState());
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState("");
  const apply = (next: DemoState) => {
    saveDemoState(next);
    setState(next);
    setError("");
  };
  const run = (action: Parameters<typeof demoTransition>[1]) => {
    try {
      apply(demoTransition(state, action));
    } catch (reason) {
      setError((reason as Error).message);
    }
  };
  const players = demoTeams.find((team) => team.id === teamId)?.players || [];
  const score = (id: string) =>
    state.events.filter(
      (event) => event.teamId === id && event.type === "goal" && !event.reversed,
    ).length;
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">
          {ar ? "تجربة معزولة" : "Isolated demonstration"}
        </span>
        <h1 className="page-title">
          {ar ? "تجربة لوحة المباراة" : "Match control demonstration"}
        </h1>
        <p className="muted">
          {ar
            ? "هذه المباراة محلية في هذا المتصفح. لا تُغلق قائمة الجمعة، ولا تُنشئ مباراة للمجموعة، ولا تُسجل إحصاءات لاعبين."
            : "This match stays in this browser. It does not lock Friday attendance, create a group fixture, or write player statistics."}
        </p>
      </div>
      <div className="notice">
        {ar
          ? "الأحداث تبقى بعد تحديث الصفحة داخل هذه التجربة فقط. امسح التجربة لإزالتها."
          : "Events remain after refresh inside this demonstration only. Clear the demonstration to remove them."}
      </div>
      <Card>
        <h2 className="section-title">
          {ar ? "متى تظهر التحكمات الحقيقية" : "When the real controls appear"}
        </h2>
        <ol className="gate-list">
          {matchControlRequirements[ar ? "ar" : "en"].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <p className="tiny muted">
          {ar ? "إعداد الهاتريك في المجموعة الآن: " : "Group hat-trick setting now: "}
          {membership?.group.green_hat_trick_enabled
            ? ar
              ? "مفعّل"
              : "on"
            : ar
              ? "متوقف"
              : "off"}
          {ar
            ? ". مفتاح التجربة أدناه لا يغيّر ذلك الإعداد."
            : ". The switch below does not change that setting."}
        </p>
      </Card>
      <div className="scoreboard">
        <div className="row" style={{ justifyContent: "center" }}>
          <span className={`pill ${state.status === "live" ? "red" : "gray"}`}>
            {state.status}
          </span>
          <span className="pill gray">
            {state.refereeAssigned
              ? ar
                ? "حكم معين في التجربة"
                : "Demo referee assigned"
              : ar
                ? "لا يوجد حكم"
                : "No referee"}
          </span>
        </div>
        <div className="score-line">
          <span>{ar ? demoTeams[0].nameAr : demoTeams[0].name}</span>
          <span className="score-num">
            {score(demoTeams[0].id)} : {score(demoTeams[1].id)}
          </span>
          <span>{ar ? demoTeams[1].nameAr : demoTeams[1].name}</span>
        </div>
      </div>
      <Card>
        <div className="actions">
          <ActionButton
            variant="secondary"
            onClick={() => run(state.refereeAssigned ? { type: "revoke" } : { type: "assign" })}
          >
            {state.refereeAssigned
              ? ar
                ? "إلغاء تعيين الحكم"
                : "Remove referee"
              : ar
                ? "تعيين نفسي حكمًا للتجربة"
                : "Assign me as demo referee"}
          </ActionButton>
          <ActionButton
            variant="quiet"
            onClick={() =>
              run({ type: "hatTrick", enabled: !state.hatTrickEnabled })
            }
          >
            {state.hatTrickEnabled
              ? ar
                ? "إيقاف مكافأة الهاتريك"
                : "Disable hat-trick reward"
              : ar
                ? "تفعيل مكافأة الهاتريك"
                : "Enable hat-trick reward"}
          </ActionButton>
          <ActionButton variant="quiet" onClick={() => run({ type: "reset" })}>
            {ar ? "مسح التجربة" : "Clear demonstration"}
          </ActionButton>
          <Link to="/admin">
            <ActionButton variant="quiet">
              {ar ? "العودة للإدارة" : "Back to admin"}
            </ActionButton>
          </Link>
        </div>
      </Card>
      {state.refereeAssigned ? (
        <Card>
          <h2 className="section-title">
            {ar ? "لوحة الحكم التجريبية" : "Demo referee console"}
          </h2>
          <div className="actions">
            {state.status === "scheduled" && (
              <ActionButton onClick={() => run({ type: "start" })}>
                <Play size={16} /> {ar ? "ابدأ" : "Start"}
              </ActionButton>
            )}
            {state.status === "live" && (
              <ActionButton variant="secondary" onClick={() => run({ type: "pause" })}>
                <Pause size={16} /> {ar ? "إيقاف مؤقت" : "Pause"}
              </ActionButton>
            )}
            {state.status === "paused" && (
              <ActionButton onClick={() => run({ type: "resume" })}>
                <Play size={16} /> {ar ? "استئناف" : "Resume"}
              </ActionButton>
            )}
            {(state.status === "live" || state.status === "paused") && (
              <ActionButton variant="quiet" onClick={() => run({ type: "complete" })}>
                <Square size={16} /> {ar ? "إنهاء" : "Complete"}
              </ActionButton>
            )}
          </div>
          <div className="form-stack" style={{ marginTop: 16 }}>
            <label className="field">
              {ar ? "الفريق" : "Team"}
              <select
                className="select"
                value={teamId}
                onChange={(event) => {
                  setTeamId(event.target.value);
                  setPlayerId("");
                }}
              >
                <option value="">{ar ? "اختر الفريق" : "Select team"}</option>
                {demoTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {ar ? team.nameAr : team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {ar ? "اللاعب التجريبي" : "Demo player"}
              <select
                className="select"
                value={playerId}
                onChange={(event) => setPlayerId(event.target.value)}
              >
                <option value="">{ar ? "اختر لاعبًا" : "Select player"}</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              {(Object.keys(labels) as DemoEventType[]).map((eventType) => (
                <ActionButton
                  key={eventType}
                  variant={eventType === "goal" ? "primary" : "secondary"}
                  disabled={!teamId || !playerId || state.status !== "live"}
                  onClick={() =>
                    run({
                      type: "record",
                      teamId,
                      playerId,
                      eventType,
                    })
                  }
                >
                  <Flag size={15} /> {ar ? labels[eventType].ar : labels[eventType].en}
                </ActionButton>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <div className="notice">
          {ar
            ? "لوحة البطاقات مخفية حتى تعيين حكم. في المباراة الحقيقية يجب أن يكون الحكم مشرفًا معيّنًا وغير مشارك في المباراة."
            : "Card controls stay hidden until a referee is assigned. In a real match that referee must be an assigned admin who is not playing."}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <Card>
        <h2 className="section-title">{ar ? "تسلسل التجربة" : "Demo timeline"}</h2>
        <div className="timeline">
          {state.events.filter((event) => !event.reversed).length === 0 && (
            <p className="muted">{ar ? "لا توجد أحداث." : "No events yet."}</p>
          )}
          {state.events
            .filter((event) => !event.reversed)
            .map((event) => (
              <div className="timeline-item" key={event.id}>
                <div className="row">
                  <div>
                    <strong>
                      {ar ? labels[event.type].ar : labels[event.type].en}
                      {event.reason === "Hat-trick"
                        ? ar
                          ? " · هاتريك"
                          : " · hat-trick"
                        : ""}
                    </strong>
                    <div className="muted tiny">{event.playerId}</div>
                  </div>
                  {state.refereeAssigned && (
                    <button
                      className="icon-button"
                      aria-label={ar ? "إلغاء الحدث" : "Reverse event"}
                      onClick={() => run({ type: "reverse", eventId: event.id })}
                    >
                      <Undo2 size={17} />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
