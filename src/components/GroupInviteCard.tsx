import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../context/AppContext";
import {
  getGroupInvite,
  rotateGroupInvite,
  setGroupInviteEnabled,
} from "../lib/api";
import { formatInviteCode, inviteLink } from "../lib/invites";
import { ActionButton } from "./ui/ActionButton";
import { Card } from "./ui/Card";

export function GroupInviteCard({ groupId }: { groupId: string }) {
  const { language } = useApp();
  const ar = language === "ar";
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmRotate, setConfirmRotate] = useState(false);
  const invite = useQuery({
    queryKey: ["groupInvite", groupId],
    queryFn: () => getGroupInvite(groupId),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["groupInvite", groupId] });
  const rotate = useMutation({
    mutationFn: () => rotateGroupInvite(groupId),
    onSuccess: async () => {
      setConfirmRotate(false);
      setError("");
      setNotice(
        ar
          ? "أُنشئ رمز دعوة جديد. الرمز السابق لم يعد يعمل."
          : "A new invitation code is active. The previous code no longer works.",
      );
      await refresh();
    },
    onError: (reason) => setError(reason.message),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setGroupInviteEnabled(groupId, enabled),
    onSuccess: async (_result, enabled) => {
      setError("");
      setNotice(
        enabled
          ? ar
            ? "أُعيد تفعيل الدعوة. صلاحيات الأعضاء الحالية لم تتغير."
            : "Invitation enabled again. Existing membership permissions are unchanged."
          : ar
            ? "أُوقفت الدعوة. الأعضاء الحاليون يبقون في المجموعة."
            : "Invitation disabled. Current members stay in the group.",
      );
      await refresh();
    },
    onError: (reason) => setError(reason.message),
  });
  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setError("");
    setNotice(message);
  };
  const code = invite.data?.code || "";
  return (
    <Card>
      <h2 className="section-title">
        {ar ? "رمز الدعوة ورابط الانضمام" : "Invite code and link"}
      </h2>
      <p className="muted tiny">
        {ar
          ? "الدعوة تضيف الحساب كلاعب فقط. لا تغيّر دعوة جديدة صلاحية مشرف أو لاعب موجود."
          : "An invitation adds an account as a player. Regenerating it does not change an existing admin or player role."}
      </p>
      {invite.isLoading && (
        <p role="status">{ar ? "جارٍ تحميل الدعوة…" : "Loading invitation…"}</p>
      )}
      {invite.isError && (
        <div className="notice error" role="alert">
          {(invite.error as Error).message}
        </div>
      )}
      {!invite.isLoading && !invite.data && (
        <ActionButton
          disabled={rotate.isPending}
          onClick={() => rotate.mutate()}
        >
          {ar ? "إنشاء رمز الدعوة" : "Generate invite code"}
        </ActionButton>
      )}
      {invite.data && (
        <div className="form-stack">
          <div>
            <div className="muted tiny">
              {ar ? "رمز المجموعة" : "Group code"}
            </div>
            <div className="invite-code" dir="ltr">
              {formatInviteCode(code)}
            </div>
            <span className={`pill ${invite.data.enabled ? "blue" : "gray"}`}>
              {invite.data.enabled
                ? ar
                  ? "مفعّلة"
                  : "Enabled"
                : ar
                  ? "موقوفة"
                  : "Disabled"}
            </span>
          </div>
          <div className="invite-link" dir="ltr">
            {inviteLink(code)}
          </div>
          <div className="actions">
            <ActionButton
              variant="secondary"
              onClick={() =>
                copy(
                  code,
                  ar ? "نُسخ رمز الدعوة." : "Invite code copied.",
                )
              }
            >
              {ar ? "نسخ الرمز" : "Copy code"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() =>
                copy(
                  inviteLink(code),
                  ar ? "نُسخ رابط الدعوة." : "Invite link copied.",
                )
              }
            >
              {ar ? "نسخ الرابط" : "Copy link"}
            </ActionButton>
            <ActionButton
              variant="quiet"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(!invite.data?.enabled)}
            >
              {invite.data.enabled
                ? ar
                  ? "إيقاف الدعوة"
                  : "Disable invitation"
                : ar
                  ? "تفعيل الدعوة"
                  : "Enable invitation"}
            </ActionButton>
            <ActionButton
              variant="quiet"
              disabled={rotate.isPending}
              onClick={() => {
                if (!confirmRotate) {
                  setConfirmRotate(true);
                  return;
                }
                rotate.mutate();
              }}
            >
              {confirmRotate
                ? ar
                  ? "تأكيد استبدال الرمز"
                  : "Confirm new code"
                : ar
                  ? "استبدال الرمز"
                  : "Regenerate code"}
            </ActionButton>
          </div>
        </div>
      )}
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </Card>
  );
}
