# MAIDAN v1.1 reserve-match test evidence

Branch: `codex/v1.1-reserve-match-rules`. Date: 2026-10-09. **Production migration and deployment: not performed.**

## Executed

| Check | Result | Evidence |
| --- | --- | --- |
| Isolated schema migration | PASS after one fix | PostgreSQL 18.6 localhost `maidan_reserve_test`; five local migrations in one transaction, `ON_ERROR_STOP=1`. The first run rolled back at the v1.1 time-budget syntax error; corrected run completed. |
| Production migration reconciliation | PASS for inspected effects | Remote history queried read-only; seven invite/profile normalized function hashes and two invite-table column/constraint sets match the local pre-v1.1 baseline. Nine replaced RPC signatures/body hashes/search paths match. Version identifiers still differ and are documented. |
| SQL authorization and football suite | PASS for tested cases | `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/reserve_rules.sql` against isolated localhost. Synthetic `example.invalid` users only; `SET ROLE authenticated` plus per-user `auth.uid()` claims; all fixtures rolled back. |
| Main fixtures and reserve eligibility | PASS | Six main fixtures at 600 seconds; main-only reorder/reopen/publish/schedule regression; incomplete team rejection; ten distinct walk-ins form two complete five-player reserve teams; confirmed member denied reserve entry. |
| Reserve fixture types and priority | PASS | Reserve vs Main and Reserve vs Reserve each at 480 seconds; original six main IDs/opponents/durations and main-team assignments unchanged; unacknowledged reserve insertion ahead of main denied; mixed-schedule reorder and main reopen after reserves denied. |
| Referees, timers, cards and ratings | PASS | Player, other-group Admin, and actively playing same-group Admin referee assignments denied; simultaneous live fixture denied; start/pause/resume/complete; walk-in goals, yellow transaction, hat-trick green reward, goal/reward reversal; main goal and teammate rating summary. |
| Group isolation and member state | PASS for tested behavior | Group A player cannot read Group B; player cannot create reserve identity/fixture, alter team kind, or operate match; Group B Admin cannot read or register Group A reserve identities; inactive member loses group read access, and `add_member_by_email` reactivates an existing member. |
| Private helper grants | PASS | Local catalog shows no authenticated `EXECUTE` on `private.match_side_member`, `private.match_side_walk_in`, or `private.record_match_event_core`; all have empty `search_path`. |
| Unit tests | PASS | `npm test`: 12 files, 31 tests. `TEMP`/`TMP` set to ignored workspace `tmp` for this sandbox. |
| Production build and bundle audit | PASS | `npm run build` successful; `npm run audit:bundle` passes public-key/secret/fixture checks. Build emits a nonfatal large-chunk warning. |
| Production untouched | PASS by read-only inspection | Production still lists four pre-v1.1 migrations, no reserve table, 0 teams/matches/events. Existing three groups and seven attendance rows were not modified. |

## Not verified or blocked

- The local Auth shim is **not** Supabase Auth. There were no actual signed-in Supabase JWT sessions, PostgREST calls, or two-client Realtime tests for v1.1. Docker Desktop and Supabase CLI are not installed or accessible; local PostgreSQL tooling is available. A disposable isolated Supabase stack or separate project is needed for this integration gate. No cloud infrastructure was provisioned.
- No Admin-facing member **deactivation/removal** RPC exists in the current schema. The test changed a synthetic membership to `inactive` as the local database owner, then verified RLS denial and authorized reactivation through `add_member_by_email`. This validates state enforcement, not a complete member-removal workflow.
- The SQL suite checks state before rollback. A separate v1.1 browser refresh/persistence and mobile/RTL pass was not run in this PostgreSQL setup.
- Fixture order is sequential and one live/paused match is enforced per session. The schema does not model future wall-clock fixture start slots; no timed-slot overlap test exists. Browser whistle audio is untested.
- Production Security Advisor remains at 28 authenticated `SECURITY DEFINER` warnings, four policy-free private tables, and leaked-password protection disabled. See [function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [private-table advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and [password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). These are current production findings, not a post-v1.1 scan.

**Recommendation: NO-GO for production migration/deployment yet.** SQL compatibility and core authorization passed locally, but v1.1 needs an isolated full Supabase Auth/PostgREST/Realtime run, a member-removal workflow decision, and a controlled migration-history deployment plan. Explicit production approval is still required.
