import { db } from "./supabase";
import type {
  Booking,
  Football,
  Group,
  Maqraa,
  Match,
  MatchEvent,
  Membership,
  Profile,
  Team,
  TeamPlayer,
} from "./types";

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("No data returned");
  return data;
}
export async function getMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await db()
    .from("group_members")
    .select(
      "group_id,user_id,status,groups(id,name,timezone,capacity,rating_window_hours,green_hat_trick_enabled,green_redemption_enabled,created_by),group_roles(role)",
    )
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).map((row) => {
    const roles = row.group_roles as unknown as
      | { role: string }
      | { role: string }[]
      | null;
    const role = Array.isArray(roles) ? roles[0]?.role : roles?.role;
    return {
      group_id: row.group_id,
      user_id: row.user_id,
      status: row.status,
      group: row.groups as unknown as Group,
      role: (role || "player") as Membership["role"],
    };
  });
}
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return { ...unwrap(data as Profile, error), initial_ovr: null };
}
export async function getPlayerStats(groupId: string, userId: string) {
  const [events, summary] = await Promise.all([
    db()
      .from("match_events")
      .select("event_type")
      .eq("group_id", groupId)
      .eq("player_id", userId)
      .is("reversed_at", null),
    db()
      .from("player_rating_summaries")
      .select("overall_ovr,rating_count")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (events.error) throw events.error;
  if (summary.error) throw summary.error;
  return {
    goals:
      events.data?.filter((event) => event.event_type === "goal").length || 0,
    yellow:
      events.data?.filter((event) => event.event_type === "yellow").length || 0,
    red: events.data?.filter((event) => event.event_type === "red").length || 0,
    green:
      events.data?.filter((event) => event.event_type === "green").length || 0,
    communityOvr: summary.data?.overall_ovr ?? null,
    ratingCount: summary.data?.rating_count || 0,
  };
}
export async function updateProfile(
  userId: string,
  patch: Pick<Profile, "full_name" | "preferred_position" | "self_ovr">,
) {
  const { error } = await db().from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}
export async function createGroup(
  name: string,
  userId: string,
): Promise<Group> {
  const { data, error } = await db().rpc("create_group", { p_name: name });
  if (error) throw error;
  const group = data as Group;
  if (group.created_by !== userId) throw new Error("Unexpected group owner");
  return group;
}
export async function getPlayers(groupId: string): Promise<Profile[]> {
  const [members, summaries] = await Promise.all([
    db()
      .from("group_members")
      .select(
        "initial_ovr,profiles(id,full_name,preferred_position,self_ovr,created_at)",
      )
      .eq("group_id", groupId)
      .eq("status", "active"),
    db()
      .from("player_rating_summaries")
      .select("user_id,overall_ovr")
      .eq("group_id", groupId),
  ]);
  if (members.error) throw members.error;
  if (summaries.error) throw summaries.error;
  const overall = new Map(
    (summaries.data || []).map((row) => [row.user_id, row.overall_ovr]),
  );
  return (members.data || []).map((r) => ({
    ...(r.profiles as unknown as Profile),
    initial_ovr: r.initial_ovr,
    overall_ovr: overall.get((r.profiles as unknown as Profile).id) ?? null,
  }));
}
export async function getMaqraa(groupId: string): Promise<Maqraa[]> {
  const { data, error } = await db()
    .from("maqraa_sessions")
    .select("*")
    .eq("group_id", groupId)
    .order("starts_at", { ascending: false })
    .limit(20);
  return unwrap(data as Maqraa[], error);
}
export async function getFootball(groupId: string): Promise<Football[]> {
  const { data, error } = await db()
    .from("football_sessions")
    .select("*")
    .eq("group_id", groupId)
    .order("starts_at", { ascending: true })
    .limit(30);
  return unwrap(data as Football[], error);
}
export async function getBookings(sessionId: string): Promise<Booking[]> {
  const { data, error } = await db()
    .from("football_attendance")
    .select(
      "*,profiles!football_attendance_user_id_fkey(id,full_name,preferred_position,self_ovr,created_at)",
    )
    .eq("session_id", sessionId)
    .order("created_at");
  if (error) throw error;
  const profiles = data?.length ? await getPlayers(data[0].group_id) : [];
  const assessed = new Map(profiles.map((p) => [p.id, p]));
  return (data || []).map(
    (r) =>
      ({
        ...r,
        profile: assessed.get(r.user_id) || {
          ...r.profiles,
          initial_ovr: null,
        },
      }) as Booking,
  );
}
export async function getMyBooking(
  sessionId: string,
  userId: string,
): Promise<Booking | null> {
  const { data, error } = await db()
    .from("football_attendance")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Booking | null;
}
export async function setBooking(
  sessionId: string,
  state: "confirmed" | "declined",
): Promise<void> {
  const { error } = await db().rpc("set_booking", {
    p_session_id: sessionId,
    p_state: state,
  });
  if (error) throw error;
}
export async function adminSetBooking(
  sessionId: string,
  userId: string,
  state: Booking["status"],
): Promise<void> {
  const { error } = await db().rpc("admin_set_booking", {
    p_session_id: sessionId,
    p_user_id: userId,
    p_state: state,
  });
  if (error) throw error;
}
export async function checkIn(token: string): Promise<void> {
  const { error } = await db().rpc("check_in_maqraa", { p_token: token });
  if (error) throw error;
}
export async function rotateQr(sessionId: string): Promise<string> {
  const { data, error } = await db().rpc("rotate_maqraa_token", {
    p_session_id: sessionId,
  });
  return unwrap(data as string, error);
}
export async function createWeekly(
  groupId: string,
  maqraaStart: string,
  footballStart: string,
  venue: string,
) {
  const { error } = await db().rpc("create_weekly_sessions", {
    p_group_id: groupId,
    p_maqraa_start: maqraaStart,
    p_football_start: footballStart,
    p_venue: venue,
  });
  if (error) throw error;
}
export async function lockRoster(sessionId: string): Promise<void> {
  const { error } = await db().rpc("lock_roster", { p_session_id: sessionId });
  if (error) throw error;
}
export async function getTeams(sessionId: string): Promise<Team[]> {
  const { data, error } = await db()
    .from("teams")
    .select("*")
    .eq("session_id", sessionId)
    .order("name");
  return unwrap(data as Team[], error);
}
export async function getTeamPlayers(sessionId: string): Promise<TeamPlayer[]> {
  const { data, error } = await db()
    .from("team_players")
    .select("*,profiles(id,full_name,preferred_position,self_ovr,created_at)")
    .eq("session_id", sessionId);
  if (error) throw error;
  const profiles = data?.length ? await getPlayers(data[0].group_id) : [];
  const assessed = new Map(profiles.map((p) => [p.id, p]));
  return (data || []).map(
    (r) =>
      ({
        ...r,
        profile: assessed.get(r.user_id) || {
          ...r.profiles,
          initial_ovr: null,
        },
      }) as TeamPlayer,
  );
}
export async function saveTeams(
  sessionId: string,
  assignments: { name: string; color: string; userIds: string[] }[],
): Promise<void> {
  const { error } = await db().rpc("save_teams", {
    p_session_id: sessionId,
    p_assignments: assignments,
  });
  if (error) throw error;
}
export async function publishTeams(sessionId: string): Promise<void> {
  const { error } = await db().rpc("publish_teams", {
    p_session_id: sessionId,
  });
  if (error) throw error;
}
export async function reopenTeams(sessionId: string): Promise<void> {
  const { error } = await db().rpc("reopen_teams", { p_session_id: sessionId });
  if (error) throw error;
}
export async function getMatches(sessionId: string): Promise<Match[]> {
  const { data, error } = await db()
    .from("matches")
    .select(
      "*,home_team:teams!matches_home_team_id_fkey(id,name,color),away_team:teams!matches_away_team_id_fkey(id,name,color)",
    )
    .eq("session_id", sessionId)
    .order("order_no");
  return unwrap(data as Match[], error);
}
export async function getMatch(matchId: string): Promise<Match> {
  const { data, error } = await db()
    .from("matches")
    .select(
      "*,home_team:teams!matches_home_team_id_fkey(id,name,color),away_team:teams!matches_away_team_id_fkey(id,name,color)",
    )
    .eq("id", matchId)
    .single();
  return unwrap(data as Match, error);
}
export async function scheduleMatches(sessionId: string): Promise<void> {
  const { error } = await db().rpc("schedule_matches", {
    p_session_id: sessionId,
  });
  if (error) throw error;
}
export async function getEvents(matchId: string): Promise<MatchEvent[]> {
  const { data, error } = await db()
    .from("match_events")
    .select("*,profiles!match_events_player_id_fkey(id,full_name)")
    .eq("match_id", matchId)
    .order("occurred_at");
  if (error) throw error;
  return (data || []).map((r) => ({ ...r, profile: r.profiles }) as MatchEvent);
}
export async function setMatchState(
  matchId: string,
  state: "live" | "paused" | "completed",
): Promise<void> {
  const { error } = await db().rpc("set_match_state", {
    p_match_id: matchId,
    p_state: state,
  });
  if (error) throw error;
}
export async function addEvent(
  matchId: string,
  teamId: string,
  playerId: string,
  eventType: MatchEvent["event_type"],
): Promise<void> {
  const { error } = await db().rpc("record_match_event", {
    p_match_id: matchId,
    p_team_id: teamId,
    p_player_id: playerId,
    p_type: eventType,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw error;
}
export async function reverseEvent(eventId: string): Promise<void> {
  const { error } = await db().rpc("reverse_match_event", {
    p_event_id: eventId,
  });
  if (error) throw error;
}
export type GroupInvite = {
  code: string;
  enabled: boolean;
  created_at: string;
};

export async function getGroupInvite(
  groupId: string,
): Promise<GroupInvite | null> {
  const { data, error } = await db().rpc("get_group_invite", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return (data as GroupInvite | null) || null;
}

export async function rotateGroupInvite(groupId: string): Promise<GroupInvite> {
  const { data, error } = await db().rpc("rotate_group_invite", {
    p_group_id: groupId,
  });
  return unwrap(data as GroupInvite, error);
}

export async function setGroupInviteEnabled(
  groupId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await db().rpc("set_group_invite_enabled", {
    p_group_id: groupId,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function joinGroupWithInvite(code: string): Promise<string> {
  const { data, error } = await db().rpc("join_group_with_invite", {
    p_code: code,
  });
  return unwrap(data as string, error);
}

export async function reopenRoster(sessionId: string): Promise<void> {
  const { error } = await db().rpc("reopen_roster", {
    p_session_id: sessionId,
  });
  if (error) throw error;
}

export async function ratePlayer(
  matchId: string,
  rateeId: string,
  performance: number,
  teamwork: number,
  effort: number,
): Promise<void> {
  const { error } = await db().rpc("submit_rating", {
    p_match_id: matchId,
    p_ratee_id: rateeId,
    p_performance: performance,
    p_teamwork: teamwork,
    p_effort: effort,
  });
  if (error) throw error;
}
