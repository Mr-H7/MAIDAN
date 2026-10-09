# MAIDAN | ميدان

React + TypeScript + Vite frontend for the MAIDAN football community, backed by Supabase Auth/PostgreSQL and intended for Vercel hosting.

## Source inventory and implementation plan

The supplied Stitch archive contains six standalone HTML screens: player home, Maqraa attendance, Friday booking, team builder, match schedule, and live match center. Its six `screen.png` files are 28 byte placeholders. `sport_tech_precision/DESIGN.md` supplies the light surfaces, rounded cards, graphite/teal/blue palette, and typography guidance. The HTML uses Tailwind CDN, temporary logo URLs, inline DOM handlers, hardcoded dates and players, and placeholder interactions. Those local reference files are excluded from the public Git repository.

The approved logo and favicon PNG files from `D:\MAIDAN` are copied unchanged into `public/brand/`. `UX IN APP.png` is retained locally in `reference/` as a visual reference and excluded from the public repository.

Implementation sequence: reusable branded layout and controls; group-aware Auth and RLS; Tuesday QR check-in and Friday booking; locked roster/team generation; persisted fixtures/referee events; ratings, Realtime, and deployment verification.

## Run locally

1. `npm ci`
2. Start a local Supabase stack with Docker installed: `npx supabase start`. On this development branch, **do not run `db reset` or apply the v1.1 migration until its impact review is explicitly approved**. After approval, use an isolated local database for migration and workflow tests.
3. Copy `.env.example` to `.env` and use the local Supabase URL and publishable key printed by the CLI. Never put a secret/service-role key in a `VITE_` variable.
4. `npm run dev`

The seed supplies a sample group, 20 placeholder players, a Tuesday Maqraa, and a Friday session. Seed Auth rows cannot sign in. Use local Studio or the app to create a real account and group for UI testing.

## Production setup

The MAIDAN Supabase project is `rynofloqzddbdtqtyboj`. The initial migration has been applied; **do not rerun it**. Vercel serves the app at `https://maidan-cyan.vercel.app/`; the SPA rewrite is in `vercel.json`. Supabase Auth's Site URL and redirect allowlist use this public origin. Production builds send signup confirmation to this origin, including when the build is opened through a protected Vercel deployment hostname.

## Verification status

- `npm run build`: passes.
- `npm test`: the current development-branch suite passes 31 tests when `TEMP` and `TMP` point to the ignored workspace `tmp` directory.
- `supabase/tests/security.sql` contains a local seed-based SQL check; the live signed-in API tests are recorded in `SECURITY_TEST_RESULTS.md`.
- Earlier production migrations are applied on the MAIDAN Supabase project. The v1.1 reserve migration is a local draft and has **not** been applied. The prior live inspection found 18 public tables with RLS enabled.
- Three real Auth accounts passed 52 signed-in API checks, then QR expiry and five follow-up checks passed. Group isolation, permission denials, Maqraa attendance, Friday pre-registration, confirmation, and roster locking were exercised.
- A separate 21-identity disposable Auth run passed 52 live lifecycle and two-browser checks: 20 confirmations, roster lock, 4 × 5 team balance and swap, publishing, fixtures, referee operations, goals/cards/hat-trick reward, ratings, permission denials, and Realtime. See `LIVE_FOOTBALL_TEST_RESULTS.md`. The fixture group and Auth users were removed afterward.
- Arabic RTL is the first-run default and the main player and admin workflows now have Arabic copy. English LTR remains selectable. Auth viewport checks passed at 320–1280 px. The profile statistics card now has component tests for scoped values and error handling; its live signed-in UI still needs a preview smoke test. See `DEPLOYMENT_READINESS.md`.
- The app is deployed publicly. The user manually verified production email confirmation, login, logout, and session persistence; see `PRODUCTION_ACCEPTANCE.md`. Real players must not be invited until group onboarding, a live joined-player profile, and authenticated match Realtime receive current production acceptance. The dedicated test key was revoked; Security Advisor findings remain.

## v1.1 reserve-match development

The approved rules are in `MAIDAN_V1_1_SPEC.md`. The isolated development branch adds reserve/walk-in identities, typed 600/480-second fixtures, Admin approval controls, referee and event attribution, and separate matchday statistics. The SQL draft and its exact impact/approval gate are in `RESERVE_MIGRATION_REVIEW.md`; executed and pending checks are in `RESERVE_TEST_RESULTS.md`. No v1.1 migration has been applied and no v1.1 build has been deployed.

## Critical verification checklist for a connected project

Create two groups with separate users. Verify user A cannot select group B's sessions, members, bookings, teams, events, ratings, or audit logs. Verify a player cannot call admin RPCs or set `initial_ovr`/roles directly. Rotate a QR, test valid check-in, duplicate rejection, wrong-group rejection, and expiry after two minutes. Verify check-in yields only `pre_registered`, then confirm and lock the roster. Generate, swap, save, publish, refresh, schedule fixtures, assign a non-playing admin, record and reverse a goal/card, refresh, and verify scores from active events. Submit a rating as a participating teammate, then test self-rating and duplicate rejection.

## Remaining product work

The connected backend and deployment must be provisioned and tested before this can be called a complete MVP. The app does not show fake data or fake success when disconnected. Match referee controls are restricted by server RPC to assigned group admins. Super-admin rows require trusted database provisioning; clients cannot grant them.
