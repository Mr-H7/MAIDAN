import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { useApp } from "../context/AppContext";
import { getBookings, getFootball, getMyBooking, setBooking } from "../lib/api";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import type { Football } from "../lib/types";
function Session({ session }: { session: Football }) {
  const { user, membership, language } = useApp();
  const ar = language === "ar";
  const stateLabel: Record<string, string> = ar
    ? {
        open: "مفتوح",
        locked: "مغلق",
        completed: "مكتمل",
        pre_registered: "مسجل مبدئيًا",
        confirmed: "مؤكد",
        declined: "اعتذر",
        pending: "قيد الانتظار",
        waitlisted: "قائمة الانتظار",
      }
    : {};
  const client = useQueryClient();
  const [error, setError] = useState("");
  const booking = useQuery({
    queryKey: ["myBooking", session.id, user?.id],
    queryFn: () => getMyBooking(session.id, user!.id),
    enabled: !!user,
  });
  const roster = useQuery({
    queryKey: ["bookings", session.id],
    queryFn: () => getBookings(session.id),
  });
  const mutate = useMutation({
    mutationFn: (status: "confirmed" | "declined") =>
      setBooking(session.id, status),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["myBooking", session.id] });
      client.invalidateQueries({ queryKey: ["bookings", session.id] });
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  const tz = membership?.group.timezone || "Africa/Cairo";
  const date = new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(session.starts_at));
  const confirmed = roster.data?.filter((x) => x.status === "confirmed") || [];
  return (
    <Card>
      <div className="row">
        <div className="row-start">
          <CalendarDays size={20} />
          <strong>{date}</strong>
        </div>
        <span className={`pill ${session.status === "locked" ? "gray" : ""}`}>
          {stateLabel[session.status] || session.status}
        </span>
      </div>
      <p className="muted">
        <MapPin size={15} style={{ display: "inline" }} />{" "}
        {session.venue ||
          (ar ? "سيُعلن المكان لاحقًا" : "Venue to be announced")}
      </p>
      <div className="row">
        <span className="row-start">
          <Users size={17} /> {confirmed.length}/{session.capacity}{" "}
          {ar ? "مؤكد" : "confirmed"}
        </span>
        <span className="pill blue">
          {booking.data?.status
            ? stateLabel[booking.data.status] ||
              booking.data.status.replace("_", " ")
            : ar
              ? "لم تسجل"
              : "Not registered"}
        </span>
      </div>
      <hr className="divider" />
      <div className="actions">
        <ActionButton
          disabled={
            mutate.isPending ||
            session.status !== "open" ||
            booking.data?.status === "confirmed"
          }
          onClick={() => mutate.mutate("confirmed")}
        >
          {ar ? "تأكيد الحضور" : "Confirm attendance"}
        </ActionButton>
        <ActionButton
          variant="secondary"
          disabled={
            mutate.isPending ||
            session.status !== "open" ||
            booking.data?.status === "declined"
          }
          onClick={() => mutate.mutate("declined")}
        >
          {ar ? "اعتذار" : "Decline"}
        </ActionButton>
      </div>
      <p className="tiny muted">
        {ar
          ? "حضور المقرأة يسجلك مبدئيًا فقط. أكّد هنا للانضمام إلى القائمة النهائية."
          : "Maqraa check in creates a pre-registration. Confirm here to join the final roster."}
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </Card>
  );
}
export function BookingPage() {
  const { groupId, language } = useApp();
  const ar = language === "ar";
  const sessions = useQuery({
    queryKey: ["football", groupId],
    queryFn: () => getFootball(groupId!),
    enabled: !!groupId,
  });
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">{ar ? "يوم المباراة" : "Match day"}</span>
        <h1 className="page-title">{ar ? "حجز الجمعة" : "Friday booking"}</h1>
        <p className="muted">
          {ar
            ? "الجمعة · ٩:٠٠–١١:٠٠ مساءً افتراضيًا. أكّد مكانك قبل إغلاق القائمة."
            : "Friday · 9:00 PM–11:00 PM by default. Confirm your place before the roster locks."}
        </p>
      </div>
      {sessions.isLoading && (
        <div role="status">
          {ar ? "جارٍ تحميل الجلسات…" : "Loading sessions…"}
        </div>
      )}
      {sessions.isError && (
        <div className="notice error">
          {ar ? "تعذّر تحميل جلسات الجمعة." : "Could not load Friday sessions."}
        </div>
      )}
      {sessions.data?.length === 0 && (
        <Card className="empty">
          {ar
            ? "لا توجد جلسات جمعة مجدولة بعد."
            : "No Friday sessions scheduled yet."}
        </Card>
      )}
      {sessions.data?.map((x) => (
        <Session key={x.id} session={x} />
      ))}
    </div>
  );
}
