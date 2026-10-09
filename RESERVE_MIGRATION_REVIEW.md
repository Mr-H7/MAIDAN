# v1.1 reserve migration impact review

Migration draft: `supabase/migrations/20261009070500_reserve_match_rules.sql` on `codex/v1.1-reserve-match-rules`.

**Status: NOT APPLIED. Production deployment is blocked pending explicit migration-impact approval and live tests in an isolated disposable group.** The local Supabase CLI, PostgreSQL client, and Docker runtime are unavailable in this workspace, so SQL execution and RLS behavior have not been verified. The migration file was created manually because `supabase migration new` was unavailable; its filename and ordering must be confirmed before application.

## Target and data scope

The intended target is only MAIDAN project `rynofloqzddbdtqtyboj`. The draft has no project connection string and cannot select a project by itself. It does not mention `auth.users` or change Supabase Auth/system schemas. It adds `kind` to `public.teams`, `match_type` and approval metadata to `public.matches`, new `public.reserve_players` and `public.reserve_team_players` tables, and nullable reserve identity references on `public.match_events` and `public.disciplinary_transactions`. Existing teams and matches receive `main` and `main_main` defaults; existing event/card identity values remain intact. The new duration check is `NOT VALID` so it does not scan or rewrite historical rows at migration time. A preflight must inspect any historical main matches whose stored duration is not 600 seconds before validating the check in a later migration.

Read-only inspection on 2026-10-09 found 18 public tables with RLS enabled, zero rows in `teams` and `matches`, and zero existing non-600-second matches. There are other real application rows, including groups and attendance, so production is not an empty test database. The reserve columns and tables are absent. No application data was changed by this inspection.

**Migration-history drift:** Supabase lists `20261008121844_group_invites` and `20261008145526_google_profile_name`, while this checkout names their source files `20261008114656_group_invites.sql` and `20261008145510_google_profile_name.sql`. Their effects must be compared and migration history reconciled through an authorized workflow before any CLI push; otherwise older SQL may be replayed. The reserve draft is absent from remote history.

Read-only `pg_proc` inspection confirmed that all nine existing RPC signatures targeted by `CREATE OR REPLACE` are present remotely, are already `SECURITY DEFINER`, and have an empty `search_path`. This checks signatures only; it does not compile or execute the draft replacements.

RLS is enabled on both new public tables. Authenticated group members may read their group's reserve identities and assignments. There are no direct client insert/update/delete policies; all writes go through Admin or referee RPCs. Temporary walk-ins receive application UUIDs and no Auth account. Private helpers have EXECUTE revoked from ordinary roles. Public `SECURITY DEFINER` RPCs set an empty `search_path` and check the authenticated caller through group-scoped Admin/referee predicates. These are code-review findings, **not live security-test results**.

## Potentially destructive statements

There is **no migration-time `DROP`, `DELETE`, `TRUNCATE`, or unrestricted `UPDATE`**. `ALTER COLUMN player_id DROP NOT NULL` and `ALTER COLUMN user_id DROP NOT NULL` remove constraints so a temporary walk-in can be attributed to an event/card; the added exactly-one-identity checks preserve attribution. `CREATE OR REPLACE FUNCTION` changes existing RPC behavior for main fixture generation, team reopening, fixture order, referee assignment, match state, event recording/reversal, green redemption, and rating aggregation. These replacements take effect on future calls and must receive regression testing.

The replaced `reopen_teams` RPC contains scoped deletes of `match_officials` and `matches` for a supplied session, as the previously approved reopen action already did. The new guard rejects that action if reserve teams exist or any match has started. The replaced `assign_match_official` RPC deletes only an existing head-referee assignment for the selected match when an Admin selects a replacement. Neither DELETE runs while applying the migration. They run only after an authorized explicit RPC call. Fixture insertion updates `order_no` only on later fixtures in the selected session, after checking that none has started, and logs how many main fixtures move. It does not change opponents, team membership, duration, or match events.

## Required preflight and approval gate

1. Confirm the target project reference and take a restorable backup or snapshot under the authorized Supabase workflow.
2. Record row counts for teams, matches, match events, disciplinary transactions, and any main duration exceptions. Review foreign-key and `NOT VALID` check impact.
3. Review the function replacements against the deployed schema, especially any migrations added since this branch began. Do not reapply earlier migrations.
   Resolve the two version mismatches above before using a migration CLI command against the remote project.
4. Apply this migration **only after explicit approval**. Inspect migration history, new tables, RLS policies, function definitions, grants, and Security Advisor findings immediately afterward.
5. Use a new disposable group to run signed-in Admin, player, and cross-group denials; 600/480/480 timers; five-player eligibility; reserve/main priority; guest and member goals/cards/hat-trick/reversal; rating exclusion; team/referee conflicts; refresh and Realtime. Do not use the real حبايب الجمعة group.
6. Keep the production branch and deployment unchanged until all critical tests pass and deployment receives separate approval.

## Known limitations before live testing

- Fixture conflicts use exclusive schedule positions and a server rule allowing only one live or paused match per session. The schema does not yet store wall-clock start times for the old published fixtures; a future timed-slot feature needs a separate impact review.
- The final whistle uses browser audio and may be blocked by browser autoplay policy; the visual FULL TIME state is always shown.
- Temporary walk-ins have stable reserve IDs and event history. Linking them to a later Auth identity is intentionally deferred; it requires an audited merge design.
- The current Supabase Security Advisor still reports 28 authenticated `SECURITY DEFINER` RPC warnings, four intentionally policy-free private tables, and leaked-password protection disabled. The draft adds authenticated RPCs, so an advisor rerun and signed-in permission tests are required after migration. These are unresolved findings, not post-migration passes.
