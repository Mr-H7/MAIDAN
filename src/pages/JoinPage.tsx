import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { joinGroupWithInvite } from "../lib/api";
import {
  clearPendingInvite,
  normalizeInviteCode,
  rememberInviteFromLocation,
} from "../lib/invites";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import { Field } from "../components/ui/Field";

export function JoinPage() {
  const { user, language, selectGroup } = useApp();
  const ar = language === "ar";
  const client = useQueryClient();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => rememberInviteFromLocation());
  const [error, setError] = useState("");
  const join = useMutation({
    mutationFn: () => joinGroupWithInvite(normalizeInviteCode(code)),
    onSuccess: async (groupId) => {
      clearPendingInvite();
      selectGroup(groupId);
      await client.invalidateQueries({ queryKey: ["memberships", user?.id] });
      navigate("/", { replace: true });
    },
    onError: (reason) => setError(reason.message),
  });
  return (
    <div className="page-stack">
      <div>
        <span className="eyebrow">{ar ? "الانضمام" : "Invitation"}</span>
        <h1 className="page-title">
          {ar ? "الانضمام إلى مجموعة" : "Join a group"}
        </h1>
        <p className="muted">
          {ar
            ? "رمز الدعوة يضيفك كلاعب. إذا كنت عضوًا بالفعل تبقى صلاحيتك كما هي."
            : "An invite code adds you as a player. If you already belong to the group, your current role stays as it is."}
        </p>
      </div>
      <Card>
        <div className="form-stack">
          <Field
            label={ar ? "رمز الدعوة" : "Invite code"}
            dir="ltr"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <ActionButton
            disabled={join.isPending || normalizeInviteCode(code).length < 8}
            onClick={() => join.mutate()}
          >
            {ar ? "انضم" : "Join"}
          </ActionButton>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
