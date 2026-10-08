// domain/contracts/events.ts
// Contracts for the tournament endpoints.
//
// Response schemas are strict: a field the endpoint starts sending, or stops
// sending, fails its contract test until the schema says so. That is the
// point of the contract, so when a migration adds a column to tournaments
// (the list endpoint returns t.*), add it here in the same change.
import { z } from 'zod'
import { dollarsSchema, flagSchema, idSchema, isoDateSchema, storedTimestampSchema } from './common'

export const tournamentStatusSchema = z.enum(['upcoming', 'active', 'completed'])

/** Whether online entry is taken: the CHECK on tournaments.registration_status. */
export const registrationStatusSchema = z.enum(['draft', 'open', 'closed'])

/** US Chess pairing rules (the default) or FIDE colours and placement. */
export const pairingSystemSchema = z.enum(['uscf', 'fide'])

/** Who the pairing engine tries to keep apart. */
export const keepApartSchema = z.enum(['family', 'family_club', 'none'])

/** A prize: an amount in dollars, a label ("Trophy"), or both. */
export const prizeSlotSchema = z.strictObject({
  amount: dollarsSchema.optional(),
  label: z.string().optional(),
})

/** A class prize within a section, such as "Top U1000". */
export const prizeClassSchema = z.strictObject({
  label: z.string(),
  ratingMax: z.number().nullable().optional(),
  ratingMin: z.number().nullable().optional(),
  unratedOnly: z.boolean().optional(),
  unratedOk: z.boolean().optional(),
  gradeMin: z.number().nullable().optional(),
  gradeMax: z.number().nullable().optional(),
  prizes: z.array(prizeSlotSchema),
})

export const sectionPrizesSchema = z.strictObject({
  place: z.array(prizeSlotSchema).optional(),
  classes: z.array(prizeClassSchema).optional(),
})

/**
 * One section as stored in tournaments.sections. The entry rules are
 * domain/events/sectionRules.ts: absent means taken from the name, and
 * rulesSet marks rules a director has edited.
 */
export const tournamentSectionSchema = z.strictObject({
  name: z.string(),
  entryFee: dollarsSchema,
  prizeFund: z.string().optional(),
  ratingMax: z.number().nullable().optional(),
  ratingMin: z.number().nullable().optional(),
  unratedOk: z.boolean().optional(),
  gradeMin: z.number().nullable().optional(),
  gradeMax: z.number().nullable().optional(),
  rulesSet: z.boolean().optional(),
  prizes: sectionPrizesSchema.optional(),
})

/** Very old events stored a section as its bare name. */
export const listedSectionSchema = z.union([z.string(), tournamentSectionSchema])

/** A JSON value kept as text in its column and passed through unparsed. */
const storedJsonTextSchema = z.string()

/**
 * Wall-clock text from the setup form (a deadline or an opening time). The
 * form writes "2026-10-24" or "2026-10-24T19:00"; older rows vary, so only
 * the type is promised.
 */
const wallClockTextSchema = z.string()

/**
 * One row of GET /api/tournaments: every column of tournaments, with
 * sections parsed into an array, plus the club's name and colour from the
 * join. custom_details, round_schedule and report_settings stay raw JSON
 * text on this endpoint.
 */
export const tournamentListItemSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  location: z.string(),
  venue: z.string().nullable(),
  date: isoDateSchema,
  end_date: isoDateSchema.nullable(),
  entry_fee: dollarsSchema,
  sections: z.array(listedSectionSchema),
  rounds: z.number().int().min(0),
  max_players: z.number().int().min(0).nullable(),
  status: tournamentStatusSchema,
  description: z.string().nullable(),
  registration_deadline: wallClockTextSchema.nullable(),
  club_id: idSchema.nullable(),
  created_by: idSchema.nullable(),
  created_at: storedTimestampSchema,
  registration_status: registrationStatusSchema,
  registration_opens_at: wallClockTextSchema.nullable(),
  reminder_1_days_before: z.number().int().nullable(),
  reminder_1_enabled: flagSchema.nullable(),
  reminder_2_days_before: z.number().int().nullable(),
  reminder_2_enabled: flagSchema.nullable(),
  is_rated: flagSchema,
  is_visible: flagSchema,
  round_schedule: storedJsonTextSchema.nullable(),
  registration_closes_at: wallClockTextSchema.nullable(),
  custom_details: storedJsonTextSchema.nullable(),
  time_control: z.string().nullable(),
  registration_url: z.string().nullable(),
  eligibility: z.string().nullable(),
  organizer: z.string().nullable(),
  pairing_system: pairingSystemSchema,
  early_deadline: wallClockTextSchema.nullable(),
  early_discount: dollarsSchema,
  late_after: wallClockTextSchema.nullable(),
  late_fee: dollarsSchema,
  member_discount: dollarsSchema,
  accelerated: flagSchema,
  keep_apart: keepApartSchema,
  report_settings: storedJsonTextSchema.nullable(),
  is_state_championship: flagSchema,
  club_name: z.string().nullable(),
  club_color: z.string().nullable(),
})

/** GET /api/tournaments. Public; signed-in managers also see their drafts. */
export const tournamentsListResponseSchema = z.strictObject({
  tournaments: z.array(tournamentListItemSchema),
})

export type TournamentStatus = z.infer<typeof tournamentStatusSchema>
export type TournamentSection = z.infer<typeof tournamentSectionSchema>
export type TournamentListItem = z.infer<typeof tournamentListItemSchema>
export type TournamentsListResponse = z.infer<typeof tournamentsListResponseSchema>
