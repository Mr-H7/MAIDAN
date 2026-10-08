# Live security test results — 2026-10-08

Project: `rynofloqzddbdtqtyboj`. Testing used three confirmed Supabase Auth accounts, signed in through `signInWithPassword`, with roles assigned only through MAIDAN's `create_group` and `add_member_by_email` RPCs. Passwords and tokens were held in an ignored local file and were deleted after testing. The two isolated test groups and their three memberships remain for follow-up tests. The test Maqraa was closed.

## Passed

- **52 signed-in API checks:** three logins and authenticated identity lookups; Group A/B provisioning; player role verification; cross-group `SELECT` filtering; direct role, rating-summary, disciplinary and foreign-profile write denial; admin RPC denial for a player and an admin from another group; private-table access denial; linked Tuesday/Friday creation; real QR rotation, invalid and wrong-group token rejection, valid attendance, duplicate rejection; Friday `pre_registered` rather than auto-confirmed; player confirmation, admin roster view and lock; locked-roster and incomplete-team rejection.
- **QR expiry:** after waiting 123 seconds, a signed-in player received the server's invalid/expired-token rejection.
- **Five follow-up checks:** null manual correction rejected without removing attendance; direct player match-event insert denied with `42501`; admin closed the test Maqraa; logout cleared both test sessions.
- **Anonymous API:** `public.groups` read denied with `42501`.
- **Database catalog:** 18 public tables, all with RLS; two applied migrations. Both private tables deny ordinary `SELECT`/`INSERT`, with RLS enabled and no allow policies.
- **Local quality gate:** production build and four unit tests passed.

## Not yet verified

- A successful 20-player team save, swap, publish, and reload, because the test roster has only three real Auth accounts.
- A valid scheduled match, official assignment, referee state/event operations, score persistence, and eligible post-match rating. Direct player event insertion was denied, but that is not a substitute for valid-match authorization tests.
- Browser registration/login persistence, Arabic/mobile interaction, and multi-device Realtime.

An attempted direct SQL match fixture was rejected by automatic approval review because it bypassed the authorized roster/team workflow and would leave persistent test data. No fixture was created. The required end-to-end checks need 17 more legitimately provisioned player accounts or a separate authorized test environment. **Do not deploy until these checks pass.**

The post-test Supabase Security Advisor still reports 23 intentional public `SECURITY DEFINER` RPC warnings, two informational no-policy private tables, and leaked-password protection disabled. See [Supabase's definer lint](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [private-table lint](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and [password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
