// functions/types.ts
export interface Env {
  DB: D1Database
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  STRIPE_MEMBERSHIP_URL?: string
  STRIPE_MEMBERSHIP_REGULAR_URL?: string
  STRIPE_MEMBERSHIP_SCHOLASTIC_URL?: string
  STRIPE_MEMBERSHIP_CLUB_URL?: string
  STRIPE_TOURNAMENT_PAYMENT_URL?: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  RESEND_API_KEY: string
  FROM_EMAIL: string
  CONTACT_EMAIL: string
  SUPPORT_EMAIL: string
  REPLY_TO_EMAIL?: string
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
  registration_status: string
  registration_opens_at: string | null
  reminder_1_days_before: number
  reminder_1_enabled: number
  reminder_2_days_before: number
  reminder_2_enabled: number
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

export interface TournamentDirectorRow {
  tournament_id: string
  member_id: string
  assigned_at: string
}

export interface TournamentGameRow {
  id: string
  tournament_id: string
  round: number
  board: number
  section: string
  white_member_id: string | null
  black_member_id: string | null
  result: string
  created_at: string
}
