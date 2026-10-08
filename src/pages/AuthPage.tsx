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
  const { user } = useApp();
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
          "Account created. Check your email if confirmation is enabled.",
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
      <Card className="auth-card">
        <img
          className="auth-logo"
          src="/brand/maidan-logo.png"
          alt="MAIDAN | ميدان"
        />
        {onboarding ? (
          <>
            <h1 className="page-title">Start your group</h1>
            <p>
              Create your first football community. You will be its group admin.
            </p>
            <div className="form-stack">
              <Field
                label="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <ActionButton
                disabled={busy || groupName.trim().length < 2}
                onClick={makeGroup}
              >
                Create group
              </ActionButton>
              <div className="notice">
                If an admin added your account to an existing group, refresh
                your memberships to enter it.
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
                Refresh my groups
              </ActionButton>
              <ActionButton variant="quiet" onClick={() => db().auth.signOut()}>
                Sign out
              </ActionButton>
            </div>
          </>
        ) : (
          <>
            <h1 className="page-title">
              {mode === "signin" ? "Welcome back" : "Join MAIDAN"}
            </h1>
            <p>Football, community, and match day in one place.</p>
            <form className="form-stack" onSubmit={submit}>
              {mode === "signup" && (
                <Field
                  label="Full name"
                  {...register("name")}
                  error={errors.name?.message}
                />
              )}
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                {...register("email")}
                error={errors.email?.message}
              />
              <Field
                label="Password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                {...register("password")}
                error={errors.password?.message}
              />
              <ActionButton type="submit" disabled={isSubmitting} arrow>
                {mode === "signin" ? "Sign in" : "Create account"}
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
                ? "New here? Create an account"
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
