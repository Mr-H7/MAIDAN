# MAIDAN v1.1 reserve-match verification

Branch: `codex/v1.1-reserve-match-rules`. Database migration and deployment: **not performed**.

## Executed locally

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript and Vite production build | PASS | `npm run build` on the development branch. |
| Unit suite | PASS | `npm test` with `TEMP`/`TMP` set to the ignored workspace `tmp` directory: 12 files, 31 tests. The default sandbox temp path intermittently returned `ENOENT`; this did not reproduce with the workspace temp path. |
| Browser bundle secret audit | PASS | `npm run audit:bundle`: public Vite keys only; no Admin key, disposable identity, or database URL detected. |
| Duration mapping, side compatibility | PASS (unit) | `src/lib/reserveRules.test.ts`: 600/480/480 and eligible side combinations. |
| Reserve balancing and minimum player count | PASS (unit) | Deterministic ten-player suggestion; five per team; incomplete/duplicate input rejected. |
| Count-up timer and full-time rendering | PASS (unit) | Persisted elapsed time, pause state, and full-time threshold. |
| Standard/reserve/combined event classification | PASS (unit) | Reversed events excluded and combined totals equal category totals. |
| Complete fixture time budget | PASS (unit) | Local helper returns zero remaining when stored match durations exhaust the session window. The database rejection remains untested. |
| Informed schedule approval in the Admin UI | PASS (component) | A Reserve vs Main fixture placed ahead of a main match cannot be submitted until the Admin checks the explicit delay approval. The submitted payload contains the selected teams, position, referee, and approval flag. |

## Required live checks after migration approval

| Acceptance check | Status |
| --- | --- |
| Main vs Main uses 600 seconds | NOT RUN in database |
| Reserve vs Reserve uses 480 seconds | NOT RUN in database |
| Reserve vs Main uses 480 seconds | NOT RUN in database |
| Admin can create both reserve formats with eligible sides, order, and referee | NOT RUN |
| Reserve fixtures cannot silently change published main fixtures | NOT RUN |
| Reserve vs Main preserves the main team's original assignment | NOT RUN |
| Schedule conflicts are rejected or explicitly approved | NOT RUN |
| No player appears on both sides or in simultaneous active matches | NOT RUN |
| Insufficient reserve players cannot form a team | NOT RUN in database |
| Goals, cards, hat-trick reward, reversal, referee eligibility, and results across all types | NOT RUN |
| Cross-group, player, and unassigned-referee denials through authenticated API sessions | NOT RUN |
| Refresh persistence, Realtime in two sessions, Arabic RTL, and mobile match console | NOT RUN |

The SQL draft is under `RESERVE_MIGRATION_REVIEW.md`. It needs execution against an isolated disposable group and a second Supabase Security Advisor review before production acceptance. No tests touched حبايب الجمعة data.

Read-only remote checks on 2026-10-09 confirmed that the reserve schema is not deployed, all 18 current public tables have RLS, and existing `teams`/`matches` contain zero rows. The migration versions for group invites and Google profile differ between local filenames and remote history; this must be reconciled before applying the reserve draft. Security Advisor findings remain: 28 callable authenticated `SECURITY DEFINER` functions ([advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)), four policy-free private tables ([advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)), and leaked-password protection disabled ([guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). No post-migration security result exists.
