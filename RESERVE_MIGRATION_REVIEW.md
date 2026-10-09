# v1.1 reserve migration impact review

**Target reviewed:** `supabase/migrations/20261009070500_reserve_match_rules.sql` on `codex/v1.1-reserve-match-rules`. **Production status: not applied.** No production migration, deployment, merge, or real-group mutation is authorized by this review.

## Isolated execution and migration history

On 2026-10-09, PostgreSQL 18.6 was initialized under ignored `tmp/reserve-pgdata` and bound to `127.0.0.1:55439`. Two local databases were built: `maidan_baseline_test` with the four pre-v1.1 source migrations, and `maidan_reserve_test` with those migrations plus v1.1. The local-only `tmp/reserve-auth-shim.sql` supplies minimal `auth.users`, `auth.uid()`, and `authenticated`/`anon` roles; it is not a Supabase Auth server. The five-file reserve build ran in one transaction with `ON_ERROR_STOP=1`. The first attempt rolled back on a syntax error in the new fixture time-budget expression at line 247. The corrected sequence then committed locally without SQL errors. No production connection was used for migration execution.

Production project `rynofloqzddbdtqtyboj` reports: `20261008085320_maidan_initial`, `20261008090319_security_hardening`, `20261008121844_group_invites`, `20261008145526_google_profile_name`. Local source files use `20261008114656_group_invites.sql` and `20261008145510_google_profile_name.sql` for the last two. Read-only production comparison against the pre-v1.1 local baseline found exact normalized function-body hashes and signatures for all seven invite/profile functions, exact column-definition hashes for both private invite tables, and matching check/PK/unique/FK constraints and RLS flags. PostgreSQL 18 emits NOT NULL constraints as separate catalog rows; excluding those catalog-only rows reconciled constraint hashes. All nine RPCs replaced by v1.1 also match production's pre-v1.1 normalized function-body hashes, signatures, and empty `search_path` settings. **The inspected effects match; the version identifiers do not.** Do not rename source files, replay them against production, or mark versions as applied blindly. A production plan must explicitly map the two source versions to the remote versions and apply only the reviewed v1.1 change.

Read-only production preflight on 2026-10-09 found 3 groups, 7 football attendance rows, 0 teams, 0 matches, 0 match events, and no `public.reserve_players` table. Production is not an empty database; inspection changed no rows.

## Exact schema and data impact

- Adds `teams.kind` (`main` default) and `matches.match_type` (`main_main` default), plus `priority_acknowledged_by` and `created_by` on matches. Existing rows retain main classification through defaults.
- Adds a `NOT VALID` match-type/duration check. It enforces future writes but does not validate or rewrite historical matches. Any later validation needs a separate duration preflight.
- Creates group/session-scoped `reserve_players` and `reserve_team_players` with UUID keys, foreign keys, unique membership, indexes, RLS, and member-only SELECT policies. Clients have no direct write grants.
- Drops only the `NOT NULL` constraints on `match_events.player_id` and `disciplinary_transactions.user_id`, then adds nullable reserve-player FKs and exactly-one-identity checks. Existing event/card rows are not rewritten.
- Adds four Admin reserve RPCs, a walk-in event RPC, and three private helpers. The private match helpers have `EXECUTE` denied to `authenticated` in the local catalog check; every new definer function has an empty `search_path`.
- Replaces the nine existing functions below. Their signatures match the production baseline, so `CREATE OR REPLACE` preserves existing grants. The migration does not grant administrative roles.

There is **no migration-time table `DROP`, `DELETE`, `TRUNCATE`, or unrestricted `UPDATE`**. The only `DROP` keywords are two `DROP NOT NULL` alterations. Later authorized `reopen_teams` calls can delete officials and matches for one session; a new reserve-team guard blocks this after reserves exist. Later authorized `assign_match_official` calls can replace one match's head official. Fixture insertion can shift `order_no` for unplayed matches in the same session, only after acknowledgement when a reserve fixture delays main play. These are runtime effects, not migration-time changes.

## Nine replacement RPC review

| Function | Authorization and compatibility | Changed behavior |
| --- | --- | --- |
| `schedule_matches` | Existing group Admin guard, same signature | Six 600-second fixtures from four published **main** teams only. |
| `reopen_teams` | Existing group Admin guard, same signature | Rejects reserve teams or started matches; scoped deletion remains possible for main-only sessions. |
| `set_match_state` | Existing assigned-official guard, same signature | Valid transitions, persisted elapsed time, full-time refusal, one active fixture per session. |
| `set_match_order` | Existing group Admin guard, same signature | Rejects mixed schedules or started fixtures; retains complete-permutation validation. |
| `assign_match_official` | Existing group Admin guard, same signature | Requires active same-group Admin who plays for neither side, including linked reserves. |
| `record_match_event` | Existing signature and assigned-official guard via private core | Validates live match, actual side/player, idempotency key, and full-time threshold. |
| `reverse_match_event` | Existing assigned-official guard, same signature | Preserves identity and hat-trick reward reversal; blocks cards tied to redemption. |
| `redeem_green_for_red` | Existing group Admin guard and enabled setting, same signature | Requires same group/player, active cards, and reason. |
| `submit_rating` | Existing authenticated rater/teammate/window checks, same signature | Restricts community OVR aggregation to Main vs Main. |

All nine compiled against the local deployed-schema baseline. The SQL suite exercised their main paths or denials; see `RESERVE_TEST_RESULTS.md`. Role-scoped PostgreSQL tests demonstrate database authorization without React, but the local Auth shim does **not** prove Supabase Auth/JWT/Realtime integration.

## Remaining production gate

Before production application, obtain explicit migration-impact approval, verify a restorable backup, recheck migration history and row counts, and run isolated full Supabase Auth/Realtime integration. A CLI `db push` against production is unsafe while local version identifiers differ. Current production Security Advisor findings remain 28 authenticated `SECURITY DEFINER` warnings, four intentionally policy-free private tables, and leaked-password protection disabled. The v1.1 migration would add authenticated RPC advisories; no post-v1.1 production advisor result exists. No changes to the real حبايب الجمعة group were made.
