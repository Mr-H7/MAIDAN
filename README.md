# MAIDAN | ميدان

React + TypeScript + Vite frontend for the MAIDAN football community, backed by Supabase Auth/PostgreSQL and intended for Vercel hosting.

## Source inventory and implementation plan

The supplied Stitch archive contains six standalone HTML screens: player home, Maqraa attendance, Friday booking, team builder, match schedule, and live match center. Its six `screen.png` files are 28 byte placeholders. `sport_tech_precision/DESIGN.md` supplies the light surfaces, rounded cards, graphite/teal/blue palette, and typography guidance. The HTML uses Tailwind CDN, temporary logo URLs, inline DOM handlers, hardcoded dates and players, and placeholder interactions. Those local reference files are excluded from the public Git repository.

The approved logo and favicon PNG files from `D:\MAIDAN` are copied unchanged into `public/brand/`. `UX IN APP.png` is retained locally in `reference/` as a visual reference and excluded from the public repository.

Implementation sequence: reusable branded layout and controls; group-aware Auth and RLS; Tuesday QR check-in and Friday booking; locked roster/team generation; persisted fixtures/referee events; ratings, Realtime, and deployment verification.

## Run locally

1. `npm ci`
2. Start a local Supabase stack with Docker installed: `npx supabase start`, then `npx supabase db reset`. The migration and seed run on reset.
3. Copy `.env.example` to `.env` and use the local Supabase URL and publishable key printed by the CLI. Never put a secret/service-role key in a `VITE_` variable.
4. `npm run dev`

The seed supplies a sample group, 20 placeholder players, a Tuesday Maqraa, and a Friday session. Seed Auth rows cannot sign in. Use local Studio or the app to create a real account and group for UI testing.

## Production setup

The MAIDAN Supabase project is `rynofloqzddbdtqtyboj`. The initial migration has been applied; **do not rerun it**. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel project only after live security and workflow checks pass. The Vercel SPA rewrite is in `vercel.json`. Add the deployed URL to Supabase Auth redirect URLs before deployment.

## Verification status

- `npm run build`: passes.
- `npm test`: four deterministic team-balancing and rating-priority tests pass.
- `supabase/tests/security.sql` contains transactional group-isolation and admin-role checks. It has not run because no database is connected.
- Initial migration: applied on the MAIDAN Supabase project. The live schema has 18 public tables, all with RLS enabled.
- Authenticated-player RLS behavior, QR expiry, roster transitions, multi-device Realtime, and deployment: **not yet verified**. Auth test-account creation is currently rate limited.
- English layout is implemented; Arabic switches typography and direction and translates the home/navigation labels. Full Arabic copy remains incomplete.

## Critical verification checklist for a connected project

Create two groups with separate users. Verify user A cannot select group B's sessions, members, bookings, teams, events, ratings, or audit logs. Verify a player cannot call admin RPCs or set `initial_ovr`/roles directly. Rotate a QR, test valid check-in, duplicate rejection, wrong-group rejection, and expiry after two minutes. Verify check-in yields only `pre_registered`, then confirm and lock the roster. Generate, swap, save, publish, refresh, schedule fixtures, assign a non-playing admin, record and reverse a goal/card, refresh, and verify scores from active events. Submit a rating as a participating teammate, then test self-rating and duplicate rejection.

## Remaining product work

The connected backend and deployment must be provisioned and tested before this can be called a complete MVP. The app does not show fake data or fake success when disconnected. Match referee controls are restricted by server RPC to assigned group admins. Super-admin rows require trusted database provisioning; clients cannot grant them.
