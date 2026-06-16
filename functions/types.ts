export interface Env {
  DB: D1Database
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export interface MemberRow {
  id: string
  email: string
  full_name: string
  uscf_id: string | null
  membership_status: string
  membership_expiry: string | null
  role: string
  club_id: string | null
  created_at: string
}

export interface ClubRow {
  id: string
  name: string
  city: string
  location: string | null
  description: string | null
  meeting_schedule: string | null
  contact_email: string | null
  created_at: string
}

export interface TournamentRow {
  id: string
  name: string
  location: string
  venue: string | null
  date: string
  end_date: string | null
  entry_fee: number
  sections: string
  rounds: number
  max_players: number | null
  status: string
  description: string | null
  registration_deadline: string | null
  club_id: string | null
  created_by: string | null
  created_at: string
}

export interface RegistrationRow {
  id: string
  tournament_id: string
  member_id: string
  section: string
  payment_status: string
  registered_at: string
}