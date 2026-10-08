/** Two disposable password-authenticated Edge sessions against local MAIDAN. */
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

const root = new URL("../", import.meta.url);
const statePath = new URL("../tmp/live-football-state.json", import.meta.url);
const state = JSON.parse(readFileSync(statePath, "utf8"));
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((x) => x.includes("="))
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1).trim()];
    }),
);
const client = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const { error: loginError } = await client.auth.signInWithPassword({
  email: state.accounts[0].email,
  password: state.accounts[0].password,
});
if (loginError) throw new Error(`Test admin sign-in: ${loginError.message}`);
const { data: all, error: matchesError } = await client
  .from("matches")
  .select("id,home_team_id,away_team_id,status,order_no")
  .eq("session_id", state.sessionId)
  .order("order_no");
if (matchesError) throw matchesError;
const match = all.find((x) => x.status === "scheduled");
if (!match)
  throw new Error("No scheduled match left for browser Realtime test");
const { error: officialError } = await client.rpc("assign_match_official", {
  p_match_id: match.id,
  p_user_id: state.accounts[0].id,
  p_role: "head",
});
if (officialError) throw officialError;
const { data: homePlayers, error: playersError } = await client
  .from("team_players")
  .select("user_id")
  .eq("session_id", state.sessionId)
  .eq("team_id", match.home_team_id);
if (playersError) throw playersError;
const player = state.accounts.find((a) => a.id === homePlayers[0].user_id);
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  { cwd: new URL("..", import.meta.url), stdio: "ignore", windowsHide: true },
);
let browser;
const base = "http://127.0.0.1:4174";
const pass = (name) => {
  state.checks.push({ name, result: "PASS" });
  writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  console.log(`PASS ${name}`);
};
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(base);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error("Local Vite server did not start");
  browser = await chromium.launch({
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
    args: ["--no-sandbox"],
  });
  const adminContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const playerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const adminPage = await adminContext.newPage(),
    playerPage = await playerContext.newPage();
  const signIn = async (page, account) => {
    await page.goto(`${base}/matches/${match.id}`);
    await page.locator("input[type=email]").fill(account.email);
    await page.locator("input[type=password]").fill(account.password);
    await page.locator("button[type=submit]").click();
    await page.locator(".scoreboard").waitFor({ timeout: 15000 });
  };
  await signIn(adminPage, state.accounts[0]);
  await signIn(playerPage, player);
  pass("Two authenticated mobile browser sessions loaded same match");
  await adminPage.getByRole("button", { name: /Start|ابدأ/ }).click();
  await adminPage
    .getByRole("button", { name: /Pause|إيقاف مؤقت/ })
    .waitFor({ timeout: 10000 });
  await playerPage.locator(".scoreboard .pill.red").waitFor({ timeout: 15000 });
  pass("Realtime match start reached second browser");
  await adminPage.getByRole("button", { name: /Pause|إيقاف مؤقت/ }).click();
  await playerPage
    .locator(".scoreboard .pill.red")
    .waitFor({ state: "detached", timeout: 15000 });
  pass("Realtime pause reached second browser");
  await adminPage.getByRole("button", { name: /Resume|استئناف/ }).click();
  await playerPage.locator(".scoreboard .pill.red").waitFor({ timeout: 15000 });
  const teamSelect = adminPage.locator(".form-stack select").first();
  await teamSelect.selectOption(match.home_team_id);
  await adminPage.locator(".form-stack select").nth(1).selectOption(player.id);
  await adminPage
    .getByRole("button", { name: /Record event|تسجيل الحدث/ })
    .click();
  await playerPage
    .locator(".score-num")
    .getByText(/1\s*:\s*0/)
    .waitFor({ timeout: 15000 });
  pass("Realtime goal reached second browser and score updated");
  await playerPage.reload();
  await playerPage
    .locator(".score-num")
    .getByText(/1\s*:\s*0/)
    .waitFor({ timeout: 15000 });
  pass("Mobile score persists after browser refresh");
  await adminPage.getByRole("button", { name: /Complete|إنهاء/ }).click();
  await playerPage
    .locator(".scoreboard .pill.gray")
    .filter({ hasText: /completed|مكتملة/ })
    .waitFor({ timeout: 15000 });
  pass("Realtime completion reached second browser");
} finally {
  await browser?.close();
  server.kill();
  await client.auth.signOut();
}
