/** Verify expected public configuration and reject credential/fixture markers. */
import { readFileSync, readdirSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [
        line.slice(0, i),
        line
          .slice(i + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      ];
    }),
);
const bundle = readdirSync("dist/assets")
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(`dist/assets/${name}`, "utf8"))
  .join("");
const checks = {
  onlyPublicViteKeys: Object.keys(env)
    .filter((name) => name.startsWith("VITE_"))
    .every((name) =>
      ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"].includes(name),
    ),
  maidanUrl:
    env.VITE_SUPABASE_URL === "https://rynofloqzddbdtqtyboj.supabase.co",
  publicKeyPresent:
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") ?? false,
  publicKeyEmbedded: bundle.includes(env.VITE_SUPABASE_PUBLISHABLE_KEY || "\0"),
  noSecretKey: !/sb_secret_[A-Za-z0-9]{8,}/.test(bundle),
  noAdminVariable: !bundle.includes("SUPABASE_ADMIN_KEY"),
  noFixtureIdentity:
    !/maidan-fixture-|live-football-state|fixture@example.com/.test(bundle),
  noDatabaseUrl: !/postgres(?:ql)?:\/\//.test(bundle),
};
for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}
if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
