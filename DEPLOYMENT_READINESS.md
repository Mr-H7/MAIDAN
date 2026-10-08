# MAIDAN preview deployment readiness — 2026-10-08

Target source: `Mr-H7/MAIDAN` main. Supabase project: `rynofloqzddbdtqtyboj`. This document records the earlier preview plan; current production results are in `PRODUCTION_ACCEPTANCE.md`.

## Verified locally

| Check                   | Result              | Evidence                                                                                                                                                                                                                                    |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build        | PASS                | `npm run build`; Vite emitted a non-failing 769 kB chunk warning.                                                                                                                                                                           |
| Automated tests         | PASS                | `npm test`: seven tests, including profile statistics card and Arabic navigation.                                                                                                                                                           |
| SPA fallback            | PASS locally        | `vercel.json` rewrites all paths to `/index.html`; `/profile` loaded the protected React route in Edge. The deployed Vercel rewrite remains untested.                                                                                       |
| Frontend variables      | PASS locally        | The only app `VITE_` names are `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The latter is a publishable key. `npm run audit:bundle` checks the compiled JavaScript without printing values.                                     |
| Credential isolation    | PASS locally        | `.env.local` and `tmp/` are Git ignored. The bundle audit found no secret key pattern, admin variable, fixture identity, or database URL. The publishable key is intentionally embedded in the client bundle.                               |
| Auth, mobile, RTL       | PASS locally        | Headless Edge at 320, 390, 768, 1280 px: approved assets, Arabic default, RTL, no horizontal overflow. At 390 px, Arabic and English validation, sign-up switch, and protected route loaded. This does not replace physical-device testing. |
| Mobile navigation       | PASS component test | Five Arabic destination links, active route, group switch and language control worked. No signed-in physical-device navigation check yet.                                                                                                   |
| Profile statistics card | PASS component test | Scoped stats fetch, Arabic values and query failure state verified. The underlying data query passed Phase C live testing; this card was not used with a fresh live signed-in account.                                                      |

## First Vercel preview setup

1. Create or link a Vercel project to `Mr-H7/MAIDAN` with Vite as the framework, repository root as the root directory, `npm run build` as the build command, and `dist` as output. The checked SPA rewrite follows [Vercel's Vite guidance](https://vercel.com/docs/frameworks/frontend/vite). Keep the first deployment in **Preview** and enable deployment protection for invited testers. Do not promote to Production.
2. Set exactly two frontend environment variables for Preview: `VITE_SUPABASE_URL=https://rynofloqzddbdtqtyboj.supabase.co` and the MAIDAN `VITE_SUPABASE_PUBLISHABLE_KEY` from Supabase. Do not add `SUPABASE_ADMIN_KEY`, a service-role key, or database credentials. Repeat for Production only when a production release is approved.
3. Production builds now direct signup confirmation to the canonical public origin `https://maidan-cyan.vercel.app/`, even when opened through a protected Vercel deployment hostname. [Supabase requires this URL in its redirect allowlist](https://supabase.com/docs/guides/auth/redirect-urls). Keep the Supabase **Site URL** on the same public origin. Test an actual confirmation email before inviting anyone.
4. Confirm the preview deployment serves `/`, `/profile`, `/booking`, and `/matches` on direct navigation and refresh. Confirm its Vercel environment contains only the two public frontend variables and that a preview build does not reveal private values.

The Vercel project was subsequently created and deployed at `https://maidan-cyan.vercel.app/`. Its production behavior and remaining acceptance gates are tracked in `PRODUCTION_ACCEPTANCE.md`.

## Supabase Security Advisor, refreshed 2026-10-08

- **23 WARN:** authenticated users can invoke intentionally exposed `SECURITY DEFINER` application RPCs. The prior [security audit](SECURITY_AUDIT.md) and [live football tests](LIVE_FOOTBALL_TEST_RESULTS.md) record scoped authorization checks and critical denials; the advisor finding remains. Review every changed RPC before a production release. [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- **2 INFO:** `private.maqraa_tokens` and `private.super_admins` have RLS and no allow policies. Their inaccessibility to ordinary users is intentional and was tested. [Supabase explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- **1 WARN:** leaked-password protection is disabled. Enable it in Supabase Auth password security settings if available for this project, then rerun the advisor and test sign-up with a disposable account. Until then, breached passwords may be accepted. [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The dedicated `maidan_local_testing` secret key was removed from local files after Phase C and its project-side revocation was verified on 2026-10-08.

## Mobile smoke test at the first preview URL

Use disposable accounts only, one player and one group admin in an isolated group. Test iPhone Safari and Android Chrome at narrow and wide widths.

1. Open the protected preview link and confirm the real MAIDAN logo, Arabic RTL, Tajawal, no horizontal scroll, readable contrast, safe-area bottom navigation, and usable touch targets. Switch to English; verify LTR and Plus Jakarta Sans. Rotate the device.
2. Submit empty and invalid sign-in/sign-up forms, then sign in, refresh, and sign out. Check email confirmation lands on the preview origin. Confirm private routes return to Auth when signed out.
3. As a player, navigate Home, Friday, Matches, Players, and Profile via the bottom bar; check direct deep-link refresh. Verify the statistics card shows current real values or a clear empty/error state.
4. As an admin, switch groups and inspect the admin dashboard. Confirm a player cannot reach admin mutations via direct URLs or API calls. Test Friday confirmation, roster visibility and a match result with the isolated group.
5. Run the same match in two devices to verify Realtime changes after a goal and after refresh. Check network failures show recoverable errors. Capture screenshots and console/network errors, then remove the disposable fixture.

Do not invite real players or promote to Production until the preview smoke test, Auth redirect, advisor decision, and test-key revocation are complete.
