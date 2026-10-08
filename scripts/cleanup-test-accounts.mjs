/** Run after the exact fixture group and its dependent rows have been deleted. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = new URL("../", import.meta.url);
const state = JSON.parse(
  readFileSync(
    new URL("../tmp/live-football-state.json", import.meta.url),
    "utf8",
  ),
);
const parse = (path) =>
  Object.fromEntries(
    readFileSync(new URL(path, root), "utf8")
      .split(/\r?\n/)
      .filter((x) => /^[A-Z][A-Z0-9_]*=/.test(x))
      .map((x) => {
        const i = x.indexOf("=");
        return [x.slice(0, i), x.slice(i + 1).trim()];
      }),
  );
const pub = parse(".env.local"),
  priv = parse("tmp/admin.env");
if (
  pub.VITE_SUPABASE_URL !== "https://rynofloqzddbdtqtyboj.supabase.co" ||
  !priv.SUPABASE_ADMIN_KEY
)
  throw new Error("Wrong project or missing Admin key");
if (
  state.accounts.length !== 21 ||
  state.accounts.some(
    (a) => !a.email.startsWith(`maidan-fixture-${state.run}-`) || !a.id,
  )
)
  throw new Error("Fixture account identity mismatch");
const admin = createClient(pub.VITE_SUPABASE_URL, priv.SUPABASE_ADMIN_KEY, {
  auth: { persistSession: false },
});
// Verify group removal separately through a scoped database read before running.
// This Admin client is used only for Auth Admin getUserById/deleteUser calls.
let deleted = 0;
for (const account of state.accounts) {
  const { data, error } = await admin.auth.admin.getUserById(account.id);
  if (error || data.user?.email !== account.email)
    throw new Error(`Auth identity ${deleted + 1} mismatch; stopped`);
  const result = await admin.auth.admin.deleteUser(account.id);
  if (result.error)
    throw new Error(`Auth deletion ${deleted + 1}: ${result.error.message}`);
  deleted++;
  console.log(`Deleted disposable Auth identity ${deleted}/21`);
}
console.log(
  `Verified scoped Auth cleanup: ${deleted} fixture identities deleted`,
);
