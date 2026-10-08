/**
 * Run only from a trusted local shell: node scripts/live-football.mjs
 * All credentials and resumable state stay in Git-ignored tmp/. No Admin key is
 * used for application RPCs; those run with password-authenticated clients.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { balanceTeams } from "../src/lib/balance.ts";

const root = new URL("../", import.meta.url);
const tmp = new URL("../tmp/", import.meta.url);
const statePath = new URL("../tmp/live-football-state.json", import.meta.url);
const parseEnv = (file) =>
  Object.fromEntries(
    readFileSync(new URL(file, root), "utf8")
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
const publicEnv = parseEnv(".env.local");
if (!existsSync(new URL("../tmp/admin.env", import.meta.url)))
  throw new Error("Ignored tmp/admin.env is required");
const adminEnv = parseEnv("tmp/admin.env");
const url = publicEnv.VITE_SUPABASE_URL;
const key = publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
const adminKey = adminEnv.SUPABASE_ADMIN_KEY;
if (
  url !== "https://rynofloqzddbdtqtyboj.supabase.co" ||
  !key ||
  !adminKey ||
  adminKey === key
)
  throw new Error("MAIDAN project URL or distinct Admin/public keys missing");
mkdirSync(tmp, { recursive: true });
const admin = createClient(url, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const makeClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { run: randomBytes(5).toString("hex"), accounts: [], checks: [] };
const save = () =>
  writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
const record = (name, ok, detail = "") => {
  state.checks.push({ name, result: ok ? "PASS" : "FAIL", detail });
  save();
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) throw new Error(`${name} failed`);
};
const req = async (promise, label) => {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};
const expectRejected = async (promise, label) => {
  const { error } = await promise;
  record(label, !!error, error ? error.message : "unexpected success");
};
const query = async (client, table, columns, filters = {}) => {
  let q = client.from(table).select(columns);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  return req(q, `select ${table}`);
};

try {
  // Auth Admin only provisions disposable identities. The app's own signed-in
  // RPCs provision membership and carry out all football mutations under RLS.
  for (let i = state.accounts.length; i < 21; i++) {
    const role = i === 0 ? "admin" : "player";
    const email = `maidan-fixture-${state.run}-${String(i).padStart(2, "0")}@example.com`;
    const password = randomBytes(24).toString("base64url");
    const data = await req(
      admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: `Test ${role} ${String(i).padStart(2, "0")}`,
        },
      }),
      "Auth Admin createUser",
    );
    state.accounts.push({ id: data.user.id, email, password, role });
    save();
    console.log(`Created disposable Auth identity ${i + 1}/21`);
  }
  const clients = [];
  for (const account of state.accounts) {
    const client = makeClient();
    const data = await req(
      client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      }),
      "Auth password sign-in",
    );
    record(`Auth session ${clients.length + 1}`, data.user.id === account.id);
    clients.push(client);
  }
  const owner = clients[0],
    players = clients.slice(1);
  if (!state.groupId) {
    const group = await req(
      owner.rpc("create_group", {
        p_name: `MAIDAN isolated football test ${state.run}`,
      }),
      "create_group",
    );
    state.groupId = group.id;
    save();
  }
  for (let i = 0; i < 20; i++) {
    await req(
      owner.rpc("add_member_by_email", {
        p_group_id: state.groupId,
        p_email: state.accounts[i + 1].email,
      }),
      "add_member_by_email",
    );
    await req(
      owner.rpc("admin_set_initial_ovr", {
        p_group_id: state.groupId,
        p_user_id: state.accounts[i + 1].id,
        p_ovr: 48 + ((i * 17) % 48),
      }),
      "admin_set_initial_ovr",
    );
  }
  record(
    "21 isolated memberships with one group admin",
    (
      await query(owner, "group_members", "user_id", {
        group_id: state.groupId,
      })
    ).length === 21,
  );
  await expectRejected(
    players[0].rpc("admin_set_initial_ovr", {
      p_group_id: state.groupId,
      p_user_id: state.accounts[2].id,
      p_ovr: 99,
    }),
    "Player cannot set rating",
  );
  const now = DateTime.now().setZone("Africa/Cairo");
  let tuesday = now.set({
    weekday: 2,
    hour: 20,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  if (tuesday <= now) tuesday = tuesday.plus({ weeks: 1 });
  const friday = tuesday.plus({ days: 3 }).set({ hour: 21 });
  if (!state.sessionId) {
    await req(
      owner.rpc("create_weekly_sessions", {
        p_group_id: state.groupId,
        p_maqraa_start: tuesday.toUTC().toISO(),
        p_football_start: friday.toUTC().toISO(),
        p_venue: "Test venue",
      }),
      "create_weekly_sessions",
    );
    const sessions = await query(
      owner,
      "football_sessions",
      "id,starts_at,status,capacity",
      { group_id: state.groupId },
    );
    state.sessionId = sessions[0].id;
    save();
  }
  for (const player of players)
    await req(
      player.rpc("set_booking", {
        p_session_id: state.sessionId,
        p_state: "confirmed",
      }),
      "player set_booking",
    );
  const bookings = await query(owner, "football_attendance", "user_id,status", {
    session_id: state.sessionId,
  });
  record(
    "20 authenticated players confirmed",
    bookings.length === 20 && bookings.every((b) => b.status === "confirmed"),
  );
  await expectRejected(
    players[0].rpc("lock_roster", { p_session_id: state.sessionId }),
    "Player cannot lock roster",
  );
  await req(
    owner.rpc("lock_roster", { p_session_id: state.sessionId }),
    "lock_roster",
  );
  await expectRejected(
    players[0].rpc("set_booking", {
      p_session_id: state.sessionId,
      p_state: "declined",
    }),
    "Booking rejected after roster lock",
  );
  const members = await query(owner, "group_members", "user_id,initial_ovr", {
    group_id: state.groupId,
  });
  const assessed = new Map(members.map((m) => [m.user_id, m.initial_ovr]));
  const assignments = balanceTeams(
    bookings.map((b) => ({
      status: b.status,
      profile: {
        id: b.user_id,
        initial_ovr: assessed.get(b.user_id),
        preferred_position: null,
      },
    })),
  );
  record(
    "Balance yields four teams of five",
    assignments.length === 4 &&
      assignments.every((t) => t.userIds.length === 5),
  );
  await req(
    owner.rpc("save_teams", {
      p_session_id: state.sessionId,
      p_assignments: assignments,
    }),
    "save_teams draft",
  );
  const before = await query(owner, "team_players", "team_id,user_id", {
    session_id: state.sessionId,
  });
  record("Draft team assignments persist", before.length === 20);
  [assignments[0].userIds[0], assignments[1].userIds[0]] = [
    assignments[1].userIds[0],
    assignments[0].userIds[0],
  ];
  await req(
    owner.rpc("save_teams", {
      p_session_id: state.sessionId,
      p_assignments: assignments,
    }),
    "save_teams swapped",
  );
  const draftTeams = await query(owner, "teams", "id,name,status", {
    session_id: state.sessionId,
  });
  const after = await query(owner, "team_players", "team_id,user_id", {
    session_id: state.sessionId,
  });
  const teamIdByName = new Map(draftTeams.map((t) => [t.name, t.id]));
  record(
    "Manual swap persisted",
    after.some(
      (r) =>
        r.team_id === teamIdByName.get(assignments[0].name) &&
        r.user_id === assignments[0].userIds[0],
    ) &&
      after.some(
        (r) =>
          r.team_id === teamIdByName.get(assignments[1].name) &&
          r.user_id === assignments[1].userIds[0],
      ),
  );
  await expectRejected(
    players[0].rpc("publish_teams", { p_session_id: state.sessionId }),
    "Player cannot publish teams",
  );
  await req(
    owner.rpc("publish_teams", { p_session_id: state.sessionId }),
    "publish_teams",
  );
  record(
    "Four published teams",
    (
      await query(players[0], "teams", "id,status", {
        session_id: state.sessionId,
      })
    ).length === 4,
  );
  await req(
    owner.rpc("schedule_matches", { p_session_id: state.sessionId }),
    "schedule_matches",
  );
  const matches = await query(
    owner,
    "matches",
    "id,home_team_id,away_team_id,status,duration_seconds,order_no",
    { session_id: state.sessionId },
  );
  record(
    "Six 10-minute matches scheduled",
    matches.length === 6 && matches.every((m) => m.duration_seconds === 600),
  );
  const match = matches.sort((a, b) => a.order_no - b.order_no)[0];
  await expectRejected(
    players[0].rpc("assign_match_official", {
      p_match_id: match.id,
      p_user_id: state.accounts[0].id,
      p_role: "head",
    }),
    "Player cannot appoint referee",
  );
  await req(
    owner.rpc("assign_match_official", {
      p_match_id: match.id,
      p_user_id: state.accounts[0].id,
      p_role: "head",
    }),
    "assign_match_official",
  );
  await expectRejected(
    players[0].rpc("set_match_state", {
      p_match_id: match.id,
      p_state: "live",
    }),
    "Unassigned player cannot start match",
  );
  await req(
    owner.rpc("set_match_state", { p_match_id: match.id, p_state: "live" }),
    "match start",
  );
  await req(
    owner.rpc("set_match_state", { p_match_id: match.id, p_state: "paused" }),
    "match pause",
  );
  await req(
    owner.rpc("set_match_state", { p_match_id: match.id, p_state: "live" }),
    "match resume",
  );
  const scorer = after.find((r) => r.team_id === match.home_team_id)?.user_id;
  const opponent = after.find((r) => r.team_id === match.away_team_id)?.user_id;
  record("Match teams contain players", !!scorer && !!opponent);
  await expectRejected(
    players[0].rpc("record_match_event", {
      p_match_id: match.id,
      p_team_id: match.home_team_id,
      p_player_id: scorer,
      p_type: "goal",
      p_idempotency_key: randomUUID(),
    }),
    "Player cannot record goal",
  );
  const goalKey = randomUUID();
  const goal = await req(
    owner.rpc("record_match_event", {
      p_match_id: match.id,
      p_team_id: match.home_team_id,
      p_player_id: scorer,
      p_type: "goal",
      p_idempotency_key: goalKey,
    }),
    "goal 1",
  );
  const duplicate = await req(
    owner.rpc("record_match_event", {
      p_match_id: match.id,
      p_team_id: match.home_team_id,
      p_player_id: scorer,
      p_type: "goal",
      p_idempotency_key: goalKey,
    }),
    "idempotent goal retry",
  );
  record("Idempotent goal event", goal === duplicate);
  for (let i = 0; i < 2; i++)
    await req(
      owner.rpc("record_match_event", {
        p_match_id: match.id,
        p_team_id: match.home_team_id,
        p_player_id: scorer,
        p_type: "goal",
        p_idempotency_key: randomUUID(),
      }),
      `goal ${i + 2}`,
    );
  await req(
    owner.rpc("record_match_event", {
      p_match_id: match.id,
      p_team_id: match.away_team_id,
      p_player_id: opponent,
      p_type: "yellow",
      p_idempotency_key: randomUUID(),
    }),
    "yellow card",
  );
  await req(
    owner.rpc("record_match_event", {
      p_match_id: match.id,
      p_team_id: match.away_team_id,
      p_player_id: opponent,
      p_type: "red",
      p_idempotency_key: randomUUID(),
    }),
    "red card",
  );
  const events = await query(
    owner,
    "match_events",
    "id,event_type,team_id,player_id,reversed_at",
    { match_id: match.id },
  );
  record(
    "Hat-trick green card issued",
    events.filter((e) => e.event_type === "goal" && e.player_id === scorer)
      .length === 3 &&
      events.some((e) => e.event_type === "green" && e.player_id === scorer),
  );
  record(
    "Yellow and red cards persisted",
    events.some((e) => e.event_type === "yellow") &&
      events.some((e) => e.event_type === "red"),
  );
  await req(
    owner.rpc("set_match_state", {
      p_match_id: match.id,
      p_state: "completed",
    }),
    "match finish",
  );
  const result = await query(
    players[0],
    "matches",
    "id,status,elapsed_seconds",
    { id: match.id },
  );
  record(
    "Completed match survives fresh query",
    result[0]?.status === "completed",
  );
  const teammate = after.find(
    (r) => r.team_id === match.home_team_id && r.user_id !== scorer,
  )?.user_id;
  const raterIndex = state.accounts.findIndex((a) => a.id === teammate) - 1;
  await expectRejected(
    players[raterIndex].rpc("submit_rating", {
      p_match_id: match.id,
      p_ratee_id: teammate,
      p_performance: 8,
      p_teamwork: 8,
      p_effort: 8,
    }),
    "Self rating rejected",
  );
  await req(
    players[raterIndex].rpc("submit_rating", {
      p_match_id: match.id,
      p_ratee_id: scorer,
      p_performance: 9,
      p_teamwork: 8,
      p_effort: 10,
    }),
    "teammate rating",
  );
  await expectRejected(
    players[raterIndex].rpc("submit_rating", {
      p_match_id: match.id,
      p_ratee_id: scorer,
      p_performance: 9,
      p_teamwork: 8,
      p_effort: 10,
    }),
    "Duplicate rating rejected",
  );
  const summaries = await query(
    players[0],
    "player_rating_summaries",
    "user_id,overall_ovr,rating_count",
    { group_id: state.groupId },
  );
  record(
    "Rating summary updated",
    summaries.some(
      (s) =>
        s.user_id === scorer && s.rating_count === 1 && s.overall_ovr === 90,
    ),
  );
  const cards = await query(
    owner,
    "disciplinary_transactions",
    "card_type,action,user_id",
    { group_id: state.groupId },
  );
  record(
    "Card transactions persisted",
    cards.some((c) => c.card_type === "green" && c.user_id === scorer) &&
      cards.some((c) => c.card_type === "red" && c.user_id === opponent),
  );
  const otherGroup = adminEnv.TEST_OTHER_GROUP_ID;
  if (!otherGroup)
    throw new Error(
      "Set TEST_OTHER_GROUP_ID to an unrelated private group in ignored tmp/admin.env",
    );
  record(
    "Cross-group RLS isolation",
    (await query(players[0], "groups", "id", { id: otherGroup })).length === 0,
  );
  await expectRejected(
    players[0].rpc("admin_set_booking", {
      p_session_id: state.sessionId,
      p_user_id: scorer,
      p_state: "declined",
    }),
    "Player cannot administer locked roster",
  );
  console.log(
    `Completed ${state.checks.filter((c) => c.result === "PASS").length} passing checks. Evidence: ignored tmp/live-football-state.json`,
  );
} catch (error) {
  console.error(
    `Stopped at ${state.checks.at(-1)?.name || "setup"}: ${error.message}`,
  );
  process.exitCode = 1;
}
