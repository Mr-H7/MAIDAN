# MAIDAN security audit — 2026-10-08

The MAIDAN project is `rynofloqzddbdtqtyboj`. The applied migration history is `20261008085320_maidan_initial` followed by `20261008090319_security_hardening`. Do not rerun either migration. This is a static and catalog audit supplemented by the signed-in tests in `SECURITY_TEST_RESULTS.md`.

## Callable function review

All 23 public RPCs are `SECURITY DEFINER` with `search_path=''`. They use schema-qualified application tables/functions and grant execution to `authenticated`, not `anon`. The checks below are inside the database function, so a hidden frontend control is not the authorization boundary.

| RPC | Authentication and scope | Input and state checks |
| --- | --- | --- |
| `create_group` | `auth.uid()` required; creator gains admin only in new group | Name length 2–100 |
| `add_member_by_email` | Existing group admin | Existing account email; membership upsert scoped to group |
| `create_weekly_sessions` | Group admin | Tuesday/Friday in group timezone, Friday follows Tuesday |
| `set_maqraa_status` | Session group admin | Scheduled→active→closed only |
| `rotate_maqraa_token` | Session group admin | Active session; random 256-bit token, hash stored, 2-minute expiry |
| `check_in_maqraa` | Authenticated active group member | 64-character token, hash and expiry; unique attendance; Friday pre-registration only |
| `set_booking` | Authenticated active group member | Confirm/decline only, open future session, capacity/waitlist |
| `admin_set_booking` | Session group admin | Active member, open roster, capacity |
| `lock_roster` | Session group admin | Open roster only |
| `save_teams` | Session group admin | Locked roster, exactly 20 confirmed players and 4×5 assignments |
| `publish_teams` | Session group admin | Four complete saved teams |
| `schedule_matches` | Session group admin | Four published teams; fixtures not already scheduled |
| `assign_match_official` | Match group admin | Admin official, valid role, not on either playing team |
| `set_match_state` | Assigned official who is still a group admin | Valid transition; rejects another active match |
| `record_match_event` | Assigned official who is still a group admin | Live match, actual team player, idempotency key |
| `reverse_match_event` | Assigned official who is still a group admin | Active event; blocks reversal tied to card redemption |
| `submit_rating` | `auth.uid()` as participating teammate | Completed match, window, 1–10 scores, no self or duplicate rating |
| `admin_set_initial_ovr` | Group admin | Active group member; 0–100 |
| `admin_correct_maqraa` | Session group admin | Active member; explicit boolean after hardening migration |
| `update_group_settings` | Group admin | Valid timezone, capacity and rating-window bounds |
| `reopen_teams` | Session group admin | No match has started |
| `redeem_green_for_red` | Group admin | Feature enabled; same player/group, active cards, reason |
| `set_match_order` | Session group admin | All and only the session's scheduled fixtures |

`private.is_member`, `private.is_admin`, `private.is_official`, and `private.shares_group` are definer helpers with empty search paths. `private.make_profile` is a trigger function; its client `EXECUTE` grants were removed in the second migration. Neither `private.maqraa_tokens` nor `private.super_admins` grants ordinary users `SELECT` or `INSERT`; both have RLS enabled with no policies, intentionally denying direct access.

## Advisor and live-test status

The Supabase Security Advisor still reports 23 public definer RPC warnings. These are expected for the controlled RPC design; their safety depends on the checks above and live unauthorized-call tests. The two private-table no-policy findings are informational deny-all findings. The advisor also reports leaked-password protection disabled, which is an Auth setting outside these migrations: [password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The publishable-key API connection was tested. An anonymous `SELECT` from `public.groups` was denied by the database. Three real signed-in accounts passed group-isolation and permission-denial checks. Complete team/match/rating workflows and React browser verification remain required before deployment.
