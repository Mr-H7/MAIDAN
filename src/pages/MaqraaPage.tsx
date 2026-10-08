import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Html5QrcodeScanner } from "html5-qrcode";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { checkIn, getMaqraa } from "../lib/api";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
function Scanner({ onResult }: { onResult: (value: string) => void }) {
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let cancelled = false;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 8, qrbox: 220 },
        false,
      );
      scanner.render(
        (decoded) => {
          onResult(decoded);
          void scanner?.clear();
        },
        () => {},
      );
    });
    return () => {
      cancelled = true;
      if (scanner) void scanner.clear().catch(() => {});
    };
  }, [onResult]);
  return <div id="qr-reader" className="scan-region" />;
}
export function MaqraaPage() {
  const { groupId, membership, language } = useApp();
  const ar = language === "ar";
  const [params] = useSearchParams();
  const [showScanner, setShowScanner] = useState(false);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const sessions = useQuery({
    queryKey: ["maqraa", groupId],
    queryFn: () => getMaqraa(groupId!),
    enabled: !!groupId,
  });
  const mutation = useMutation({
    mutationFn: (value: string) => {
      let token = value.trim();
      try {
        const url = new URL(token);
        token = url.searchParams.get("token") || token;
      } catch {
        /* raw token */
      }
      return checkIn(token);
    },
    onSuccess: () => {
      setMessage(
        ar
          ? "سُجّل حضورك. أُنشئ تسجيل مبدئي للجمعة؛ أكّد حضورك بشكل منفصل."
          : "Attendance recorded. Friday pre-registration was created; confirm it separately.",
      );
      setShowScanner(false);
      client.invalidateQueries({ queryKey: ["maqraa", groupId] });
    },
    onError: (error) => setMessage(error.message),
  });
  useEffect(() => {
    const token = params.get("token");
    if (
      token &&
      !mutation.isPending &&
      !mutation.isSuccess &&
      !mutation.isError
    )
      mutation.mutate(token);
  }, [params, mutation]);
  const tz = membership?.group.timezone || "Africa/Cairo";
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">
          {ar ? "لقاء الثلاثاء" : "Tuesday community"}
        </span>
        <h1 className="page-title">
          {ar ? "حضور المقرأة" : "Maqraa attendance"}
        </h1>
        <p className="muted">
          {ar
            ? "امسح رمز الجلسة الحالية بعد تسجيل الدخول."
            : "Scan the current session QR while signed in."}
        </p>
      </div>
      <Card>
        <h2 className="section-title">{ar ? "تسجيل الحضور" : "Check in"}</h2>
        <div className="actions">
          <ActionButton onClick={() => setShowScanner((v) => !v)}>
            {showScanner
              ? ar
                ? "إغلاق الكاميرا"
                : "Close camera"
              : ar
                ? "مسح رمز QR"
                : "Scan QR code"}
          </ActionButton>
        </div>
        {showScanner && (
          <Scanner onResult={(value) => mutation.mutate(value)} />
        )}
        <div className="form-stack" style={{ marginTop: 16 }}>
          <label className="field">
            {ar ? "ألصق رابط QR أو الرمز" : "Paste QR link or token"}
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={ar ? "رابط رمز الجلسة" : "Session QR link"}
              dir="ltr"
            />
          </label>
          <ActionButton
            variant="secondary"
            disabled={!manual.trim() || mutation.isPending}
            onClick={() => mutation.mutate(manual)}
          >
            {ar ? "تسجيل الحضور" : "Check in"}
          </ActionButton>
        </div>
        {message && (
          <div
            className={`notice ${mutation.isError ? "error" : "success"}`}
            role="status"
          >
            {message}
          </div>
        )}
      </Card>
      <section>
        <h2 className="section-title">{ar ? "الجلسات" : "Sessions"}</h2>
        <div className="list">
          {sessions.data?.map((x) => (
            <Card key={x.id}>
              <div className="row">
                <div>
                  <strong>{x.title}</strong>
                  <p className="muted tiny">
                    {new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: tz,
                    }).format(new Date(x.starts_at))}
                  </p>
                </div>
                <span className="pill">
                  {ar
                    ? { scheduled: "مجدولة", active: "جارية", closed: "مغلقة" }[
                        x.status
                      ]
                    : x.status}
                </span>
              </div>
            </Card>
          ))}
          {sessions.data?.length === 0 && (
            <Card className="empty">
              {ar ? "لا توجد جلسات مقرأة بعد." : "No Maqraa sessions yet."}
            </Card>
          )}
        </div>
      </section>
      {sessions.isError && (
        <div className="notice error">
          {ar
            ? "تعذّر تحميل جلسات المقرأة."
            : "Could not load Maqraa sessions."}
        </div>
      )}
    </div>
  );
}
