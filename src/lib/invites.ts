const PENDING_INVITE_KEY = "maidan_pending_invite";

export function normalizeInviteCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatInviteCode(code: string) {
  const normalized = normalizeInviteCode(code);
  return normalized.replace(/(.{4})(?=.)/g, "$1-");
}

export function inviteCodeFromLocation(location: Location = window.location) {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/join") return "";
  return normalizeInviteCode(
    new URLSearchParams(location.search).get("code") || "",
  );
}

export function rememberInviteFromLocation(location: Location = window.location) {
  const fromUrl = inviteCodeFromLocation(location);
  if (fromUrl) localStorage.setItem(PENDING_INVITE_KEY, fromUrl);
  return localStorage.getItem(PENDING_INVITE_KEY) || "";
}

export function clearPendingInvite() {
  localStorage.removeItem(PENDING_INVITE_KEY);
}

export function inviteLink(code: string, origin = window.location.origin) {
  return `${origin}/join?code=${encodeURIComponent(normalizeInviteCode(code))}`;
}
