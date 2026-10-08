export const PRODUCTION_ORIGIN = "https://maidan-cyan.vercel.app";

export function oauthRedirectUrl(options: {
  production: boolean;
  origin: string;
  inviteCode?: string;
}) {
  const base = (
    options.production ? PRODUCTION_ORIGIN : options.origin
  ).replace(/\/$/, "");
  const code = (options.inviteCode || "").trim();
  if (code) return `${base}/join?code=${encodeURIComponent(code)}`;
  return `${base}/auth`;
}
