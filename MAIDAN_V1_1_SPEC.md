# MAIDAN v1.1 — Matchday operations

Status: approved product rules; implementation on `codex/v1.1-reserve-match-rules`. The existing v1.0 member management, referee permissions, persisted match timer, and security rules continue to apply. This document does not authorize a production migration or deployment.

## Match types and durations

| Type | Sides | Duration | Roster effect |
| --- | --- | ---: | --- |
| Main vs Main | Two published teams from the original 20 confirmed players | 600 seconds | Existing four-team fixtures and assignments remain authoritative. |
| Reserve vs Reserve | Two complete reserve teams | 480 seconds | Waiting reserves do not enter the confirmed roster. |
| Reserve vs Main | One complete reserve team and an Admin-selected published main team | 480 seconds | Main players retain their original main-team membership. |

Each match stores its type. The server chooses the duration from that type; the Admin sees the proposed duration but cannot create a fixture with a mismatched value. A reserve team contains exactly five distinct eligible players. A reserve stays waitlisted until ten eligible reserves can form two teams, or five can form one team for Reserve vs Main. An Admin can register a temporary walk-in profile without email. An existing authenticated member may be linked to one reserve profile; a confirmed player cannot be moved into a reserve team.

## Fixture creation and priority

The Admin chooses the match type, both eligible sides, schedule position, and an eligible head referee. The Admin must explicitly submit each additional fixture. The form labels standard and reserve fixtures separately and warns when the selected position delays a published main match. Inserting a reserve fixture before an unplayed main fixture requires a second, informed approval. This changes the display order only; it never changes a main match's identity, opponents, duration, events, or published team assignments. Main matches in progress or already completed cannot be reordered. An active match prevents another match from starting. A player cannot appear on both sides of one fixture, and officials cannot play for either side.

Confirmed players retain priority. A reserve fixture cannot remove or replace a confirmed player, cancel a main fixture, or shorten a main match. Any change to the timing or order of future main fixtures requires an explicit Admin decision with an audit entry. Main fixture generation remains the four-team round robin and never automatically includes reserve teams.

The sum of full fixture durations must fit within the stored Friday session window. This is a conservative capacity guard; it does not yet model breaks or a separately booked pitch slot.

## Timing, referees, and events

The authoritative timer uses stored start and accumulated elapsed timestamps and counts up from 00:00 to 10:00 or 08:00. Pause and resume survive refresh. At the limit, all clients show FULL TIME and play one final whistle per viewing session when audio is permitted. A referee still completes the result explicitly. Existing head, assistant, and supervisor assignment rules apply to every type. Suggested officials are active group admins not playing on either side; the Admin can choose another eligible official, but a participant is always rejected by the server.

Goals, cards, reversals, rewards, and audit entries refer to the match, side, and authenticated or temporary walk-in player. A temporary walk-in has a stable group/session-scoped ID and name; no fabricated Auth identity is created. Hat-trick rewards follow the group's existing setting. Only authorized officials record or reverse events.

## Statistics inclusion policy

Standard reporting includes **Main vs Main only**. Reserve reporting includes **Reserve vs Reserve and Reserve vs Main**. Combined matchday totals are the sum of both, grouped by the player's stable identity. A Main vs Reserve appearance counts in reserve reporting even for a confirmed main player. Reversed events count nowhere. Walk-in stats remain attached to the temporary ID; linking a future registered account needs a separate audited merge and is not automatic.

The existing community OVR aggregation uses eligible Main vs Main ratings only. Reserve fixtures do not change main-team balancing, historical main totals, or community OVR. Raw reserve match events are retained for future rating policy changes. Player-facing match evaluation remains limited to authenticated teammates who actually played; no guest can submit a rating without an Auth account.

## Acceptance

Verify all original v1.1 member/referee/timer/security tests and: 600/480/480-second durations; both reserve formats; Admin-selected sides, position, and referee; immutable main assignments and fixtures; informed conflict resolution; distinct sides and non-overlap; no incomplete reserve teams; goals/cards/officials/results separated by type; combined stats equal standard plus reserve; and cross-group/non-admin denials. Live database and browser tests must run in an isolated disposable group only after migration review and approval. Do not touch the real حبايب الجمعة roster, attendance, or fixtures.
