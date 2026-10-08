import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "../lib/supabase";
import { createGroup } from "../lib/api";
import { useApp } from "../context/AppContext";
import { ActionButton } from "../components/ui/ActionButton";
import { Card } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100).optional(),
});
type Values = z.infer<typeof schema>;
export function AuthPage({ onboarding = false }: { onboarding?: boolean }) {
  const { user, language, toggleLanguage } = useApp();
  const ar = language === "ar";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
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
                ? "أنشئ مجتمعك الكروي الأول. ستكون مشرف المجموعة."
                : "Create your first football community. You will be its group admin."}
            </p>
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
            <form className="form-stack" onSubmit={submit}>
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
