import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "../lib/supabase";
import { createGroup, joinGroupWithInvite } from "../lib/api";
import {
  clearPendingInvite,
  normalizeInviteCode,
  rememberInviteFromLocation,
} from "../lib/invites";
import { useApp } from "../context/AppContext";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
const schema = (ar: boolean) =>
  z.object({
    email: z
      .string()
      .email(
        ar ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address.",
      ),
    password: z
      .string()
      .min(
        8,
        ar
          ? "كلمة المرور ٨ أحرف على الأقل."
          : "Password must have at least 8 characters.",
      ),
    name: z
      .string()
      .min(
        2,
        ar ? "الاسم حرفان على الأقل." : "Name must have at least 2 characters.",
      )
      .max(100, ar ? "الاسم طويل جدًا." : "Name is too long.")
      .optional(),
  });
type Values = z.infer<ReturnType<typeof schema>>;
export function AuthPage({ onboarding = false }: { onboarding?: boolean }) {
  const { user, language, toggleLanguage, selectGroup } = useApp();
  const ar = language === "ar";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState(() =>
    rememberInviteFromLocation(),
  );
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema(ar)) });
  const submit = handleSubmit(async (values) => {
    setError("");
    setSuccess("");
    try {
      if (mode === "signin") {
        const { error } = await db().auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
      } else {
        const { error } = await db().auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.name || values.email.split("@")[0] },
            emailRedirectTo: import.meta.env.PROD
              ? "https://maidan-cyan.vercel.app/"
              : window.location.origin,
          },
        });
        if (error) throw error;
        setSuccess(
          ar
            ? "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده إذا طُلب ذلك."
            : "Account created. Check your email if confirmation is enabled.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  });
  const joinGroup = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const groupId = await joinGroupWithInvite(normalizeInviteCode(inviteCode));
      clearPendingInvite();
      selectGroup(groupId);
      await client.invalidateQueries({ queryKey: ["memberships", user.id] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const makeGroup = async () => {
    if (!user || groupName.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      await createGroup(groupName.trim(), user.id);
      await client.invalidateQueries({ queryKey: ["memberships", user.id] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-wrap">
      <div className="auth-intro" aria-hidden="true">
        <img src="/brand/mark.png" alt="" />
        <span className="eyebrow">MAIDAN | ميدان</span>
        <h2>
          {ar ? "مكان فريقك. يوم مباراتك." : "Your team. Your match day."}
        </h2>
        <p>
          {ar
            ? "نظّم الحضور، كوّن الفرق، وتابع كل لحظة على أرض الملعب."
            : "Bring your community together for every session, team and match."}
        </p>
      </div>
      <Card className="auth-card">
        <div className="auth-language">
          <button
            type="button"
            className="group-switch"
            onClick={toggleLanguage}
            aria-label={ar ? "Switch to English" : "التبديل إلى العربية"}
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>
        <img
          className="auth-logo"
          src="/brand/maidan-logo.png"
          alt="MAIDAN | ميدان"
        />
        {onboarding ? (
          <>
            <h1 className="page-title">
              {ar ? "ابدأ مجموعتك" : "Start your group"}
            </h1>
            <p>
              {ar
                ? "أنشئ مجتمعك الكروي الأول، أو أدخل برمز دعوة كلاعب."
                : "Create your first football community, or enter with an invite code as a player."}
            </p>
            {inviteCode && (
              <div className="notice">
                {ar
                  ? "وُجد رمز دعوة على هذا الجهاز. الانضمام يضيفك كلاعب ولا يمنحك صلاحية مشرف."
                  : "An invite code is saved on this device. Joining adds you as a player and does not grant admin permission."}
              </div>
            )}
            <div className="form-stack">
              <Field
                label={ar ? "اسم المجموعة" : "Group name"}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <ActionButton
                disabled={busy || groupName.trim().length < 2}
                onClick={makeGroup}
              >
                {ar ? "إنشاء المجموعة" : "Create group"}
              </ActionButton>
              <Field
                label={ar ? "رمز الدعوة" : "Invite code"}
                dir="ltr"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <ActionButton
                variant="secondary"
                disabled={busy || normalizeInviteCode(inviteCode).length < 8}
                onClick={joinGroup}
              >
                {ar ? "الانضمام بالرمز" : "Join with code"}
              </ActionButton>
              <div className="notice">
                {ar
                  ? "إذا أضافك مشرف إلى مجموعة، حدّث عضوياتك للدخول إليها."
                  : "If an admin added your account to an existing group, refresh your memberships to enter it."}
              </div>
              <ActionButton
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  client.invalidateQueries({
                    queryKey: ["memberships", user?.id],
                  })
                }
              >
                {ar ? "تحديث مجموعاتي" : "Refresh my groups"}
              </ActionButton>
              <ActionButton variant="quiet" onClick={() => db().auth.signOut()}>
                {ar ? "تسجيل الخروج" : "Sign out"}
              </ActionButton>
            </div>
          </>
        ) : (
          <>
            <h1 className="page-title">
              {mode === "signin"
                ? ar
                  ? "مرحبًا بعودتك"
                  : "Welcome back"
                : ar
                  ? "انضم إلى ميدان"
                  : "Join MAIDAN"}
            </h1>
            <p>
              {ar
                ? "مجتمعك الكروي ويوم المباراة في مكان واحد."
                : "Football, community, and match day in one place."}
            </p>
            {inviteCode && (
              <div className="notice">
                {ar
                  ? "بعد تسجيل الدخول سيبقى رمز الدعوة جاهزًا للانضمام كلاعب."
                  : "After you sign in, the invite code stays ready so you can join as a player."}
              </div>
            )}
            <form className="form-stack" onSubmit={submit} noValidate>
              {mode === "signup" && (
                <Field
                  label={ar ? "الاسم الكامل" : "Full name"}
                  {...register("name")}
                  error={errors.name?.message}
                />
              )}
              <Field
                label={ar ? "البريد الإلكتروني" : "Email"}
                dir="ltr"
                type="email"
                autoComplete="email"
                {...register("email")}
                error={errors.email?.message}
              />
              <Field
                label={ar ? "كلمة المرور" : "Password"}
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                {...register("password")}
                error={errors.password?.message}
              />
              <ActionButton type="submit" disabled={isSubmitting} arrow>
                {mode === "signin"
                  ? ar
                    ? "تسجيل الدخول"
                    : "Sign in"
                  : ar
                    ? "إنشاء حساب"
                    : "Create account"}
              </ActionButton>
            </form>
            <button
              className="icon-button"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
                setSuccess("");
              }}
            >
              {mode === "signin"
                ? ar
                  ? "جديد هنا؟ أنشئ حسابًا"
                  : "New here? Create an account"
                : ar
                  ? "لديك حساب؟ سجّل الدخول"
                  : "Already registered? Sign in"}
            </button>
          </>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="notice success" role="status">
            {success}
          </div>
        )}
      </Card>
    </div>
  );
}
