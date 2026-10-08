# Live football workflow verification — 2026-10-08

Target: MAIDAN Supabase project `rynofloqzddbdtqtyboj`. The original migrations were **not** rerun. Tests used 21 synthetic Supabase Auth identities created through Auth Admin: one non-playing group admin and 20 players. All football mutations used password-authenticated application clients and the existing RPCs. No service or secret key was sent to browser code.

## Executed results

| Area                            | Result | Evidence                                                                                                                                                                                                                        |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth and isolated group         | PASS   | 21 password sign-ins; one group admin plus 20 players; a player could not set another player's initial OVR.                                                                                                                     |
| Friday roster                   | PASS   | 20 players independently confirmed; roster locked; a later booking change was rejected.                                                                                                                                         |
| Teams                           | PASS   | Deterministic 4 × 5 balance, draft persisted, manual cross-team swap persisted, four teams published; player publication rejected.                                                                                              |
| Fixtures and officials          | PASS   | Six fixtures with 600-second duration; non-playing group admin assigned head referee; player appointment and match start rejected.                                                                                              |
| Match operations                | PASS   | Start, pause, resume and finish RPCs succeeded; unauthorized goal rejected; repeated idempotency key returned the same goal; three goals yielded a green hat-trick card; yellow/red transactions and completed match persisted. |
| Ratings and statistics          | PASS   | Participating teammate submitted 9/8/10 evaluation; self and duplicate ratings rejected; summary became 90 OVR with one rating; goals, cards, and transactions matched the event history.                                       |
| Group isolation                 | PASS   | A signed-in fixture player could not select a private record from an unrelated existing group.                                                                                                                                  |
| Two browser sessions            | PASS   | Two independent password-authenticated Edge contexts at a 390 px mobile viewport loaded the same match. Match start, pause, goal and completion reached the second browser through Realtime; 1:0 persisted after refresh.       |
| Unauthorized operations         | PASS   | Player role was rejected for rating administration, roster lock, team publication, referee appointment, match start, goal submission, and roster administration.                                                                |
| Auth/mobile/RTL                 | PASS   | Auth page checked at 320, 390, 768 and 1280 px: approved images loaded, Arabic RTL default, no horizontal overflow; English LTR switch worked at 390 px.                                                                        |
| Production build and unit tests | PASS   | `npm run build` and `npm test` (4 tests). Vite reports a non-failing large chunk warning.                                                                                                                                       |

The server-side lifecycle harness recorded 46 PASS checks; the two-browser harness recorded six more, for **52 PASS and zero observed FAIL**. The scripts are in `scripts/`. Their ignored state and passwords were removed after testing.

## Cleanup and current limits

The isolated fixture group was removed with a transaction scoped by its exact ID and name after its dependent application rows were deleted in foreign-key order. A read-back returned zero groups, members, matches and audit rows for that ID. All 21 fixture Auth identities were verified by ID/email prefix and deleted through Auth Admin. No unrelated users or groups were changed.

The Supabase Security Advisor still reports [23 intentionally callable SECURITY DEFINER RPC warnings](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [two intentionally inaccessible private tables with no policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The prior detailed function review is in `SECURITY_AUDIT.md`; this run exercised the critical football denials. Advisor warnings are not being represented as resolved.

The dedicated `maidan_local_testing` secret key was revoked and verified absent from the Supabase key list on 2026-10-08. Its local `tmp/admin.env` file was removed. At the time of this Phase C test, no Vercel deployment existed; later production status is tracked in `PRODUCTION_ACCEPTANCE.md`. The post-test profile statistics UI passed a production build but was not exercised with the now-deleted fixture; only its underlying live query data was verified.
