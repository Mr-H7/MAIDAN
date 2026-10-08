export type AttendanceState =
  | "pre_registered"
  | "confirmed"
  | "declined"
  | "pending"
  | "waitlisted";
export type Profile = {
  id: string;
  full_name: string;
  preferred_position: string | null;
  initial_ovr: number | null;
  overall_ovr?: number | null;
  self_ovr: number | null;
  created_at: string;
};
export type Group = {
  id: string;
  name: string;
  timezone: string;
  capacity: number;
  rating_window_hours: number;
  green_hat_trick_enabled: boolean;
  green_redemption_enabled: boolean;
  created_by: string;
};
export type Membership = {
  group_id: string;
  user_id: string;
  status: string;
  group: Group;
  role: "super_admin" | "group_admin" | "player";
};
export type Maqraa = {
  id: string;
  group_id: string;
  title: string;
  starts_at: string;
  status: "scheduled" | "active" | "closed";
  football_session_id: string | null;
  qr_expires_at: string | null;
};
export type Football = {
  id: string;
  group_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: "open" | "locked" | "completed";
  venue: string | null;
};
export type Booking = {
  id: string;
  group_id: string;
  session_id: string;
  user_id: string;
  status: AttendanceState;
  created_at: string;
  profile?: Profile;
};
export type Team = {
  id: string;
  group_id: string;
  session_id: string;
  name: string;
  color: string;
  status: "draft" | "published";
};
export type TeamPlayer = {
  id: string;
  group_id: string;
  team_id: string;
  session_id: string;
  user_id: string;
  profile?: Profile;
};
export type Match = {
  id: string;
  group_id: string;
  session_id: string;
  home_team_id: string;
  away_team_id: string;
  order_no: number;
  status: "scheduled" | "live" | "paused" | "completed";
  duration_seconds: number;
  started_at: string | null;
  elapsed_seconds: number;
  home_team?: Team;
  away_team?: Team;
};
export type MatchEvent = {
  id: string;
  group_id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  event_type: "goal" | "yellow" | "red" | "green";
  occurred_at: string;
  reversed_at: string | null;
  profile?: Profile;
};
export type Rating = {
  id: string;
  match_id: string;
  ratee_id: string;
  rater_id: string;
  performance: number;
  teamwork: number;
  effort: number;
};
