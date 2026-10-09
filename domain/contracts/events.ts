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

/** A prize slot as the setup sends it. Loose, like every request schema. */
const prizeSlotInputSchema = z.looseObject({
  amount: z.number().optional(),
  label: z.string().optional(),
})

/** A section's prize list as the setup sends it (PrizesEditor). */
const sectionPrizesInputSchema = z.looseObject({
  place: z.array(prizeSlotInputSchema).optional(),
  classes: z.array(z.looseObject({
    label: z.string(),
    ratingMax: z.number().nullable().optional(),
    ratingMin: z.number().nullable().optional(),
    unratedOnly: z.boolean().optional(),
    unratedOk: z.boolean().optional(),
    gradeMin: z.number().nullable().optional(),
    gradeMax: z.number().nullable().optional(),
    prizes: z.array(prizeSlotInputSchema),
  })).optional(),
})

/**
 * 80 is SECTION_NAME_MAX in domain/events/sections.ts (contracts import only
 * zod and their own files); test/unit/sections-domain.test.ts holds the two
 * equal.
 */
const sectionNameSchema = z.string()
  .min(1, 'Give the section a name.')
  .max(80, 'Section names can be at most 80 characters.')
  .refine((name) => name.trim() !== '', 'Give the section a name.')

/**
 * A known key of a section in a request. A value of the type its column
 * takes must be valid for the column. A value of any other type is accepted
 * as it is and kept in extra_json (columnsFromLegacy in sectionsRepo, like
 * the 0053 sync trigger), because events saved before these contracts can
 * hold one and the setup sends the stored list back as it found it.
 */
const legacyKey = (typed: z.ZodType, columnTakes: (v: unknown) => boolean) =>
  z.union([typed, z.unknown().refine((v) => !columnTakes(v))]).optional()

const isNumber = (v: unknown) => typeof v === 'number'
const isText = (v: unknown) => typeof v === 'string'
const isFlag = (v: unknown) => typeof v === 'boolean'
const isObject = (v: unknown) => typeof v === 'object' && v !== null

/**
 * One section in a create or edit request (SectionInput in
 * domain/events/sections.ts). The keys today's setup form sends, plus an
 * optional id (the row being edited; without one the section is matched by
 * name), a cap and the early and late prices, which go to the table only.
 * The keys the form sends follow legacyKey above; id, cap and fees are new
 * and strict. Loose: other keys are kept in the legacy JSON, as before.
 */
export const sectionSchema = z.looseObject({
  name: sectionNameSchema,
  entryFee: legacyKey(dollarsSchema.nullable(), isNumber),
  prizeFund: legacyKey(z.string().nullable(), isText),
  ratingMax: legacyKey(z.number().nullable(), isNumber),
  ratingMin: legacyKey(z.number().nullable(), isNumber),
  unratedOk: legacyKey(z.boolean().nullable(), isFlag),
  gradeMin: legacyKey(z.number().nullable(), isNumber),
  gradeMax: legacyKey(z.number().nullable(), isNumber),
  rulesSet: legacyKey(z.boolean().nullable(), isFlag),
  prizes: legacyKey(sectionPrizesInputSchema.nullable(), isObject),
  id: idSchema.optional(),
  cap: z.number().int().positive().nullable().optional(),
  fees: z.strictObject({
    early: dollarsSchema.nullable().optional(),
    late: dollarsSchema.nullable().optional(),
  }).optional(),
})

/**
 * One element of the sections list in a create or edit request: a section,
 * or a bare name, as very old events stored it (listedSectionSchema). The
 * setup sends the stored list back with what it adds, so a list can mix the
 * two (SectionListItem in domain/events/sections.ts).
 */
export const sectionListItemSchema = z.union([sectionNameSchema, sectionSchema])

/**
 * A section as the admin endpoints return it: a live row of
 * tournament_sections, in order, under today's field names plus its id, its
 * cap and its prices. entryFee and fees.regular are the price an entry pays
 * at the regular rate (the section's own, else the tournament's entry fee);
 * fees.early and fees.late are the early and late prices, the section's own
 * or worked out from the tournament (tierFees in domain/events/sections.ts),
 * null when the event has no such price.
 */
export const savedSectionSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  entryFee: dollarsSchema,
  prizeFund: z.string().nullable(),
  ratingMax: z.number().nullable(),
  ratingMin: z.number().nullable(),
  unratedOk: z.boolean().nullable(),
  gradeMin: z.number().nullable(),
  gradeMax: z.number().nullable(),
  rulesSet: z.boolean(),
  prizes: sectionPrizesSchema.nullable(),
  cap: z.number().int().positive().nullable(),
  fees: z.strictObject({
    regular: dollarsSchema,
    early: dollarsSchema.nullable(),
    late: dollarsSchema.nullable(),
  }),
})

/**
 * A tournament as the admin create and edit endpoints return it: every
 * column of tournaments, with its live sections from the table, ids
 * included. custom_details, round_schedule and report_settings stay raw
 * JSON text.
 */
export const adminTournamentSchema = tournamentListItemSchema
  .omit({ club_name: true, club_color: true, sections: true })
  .extend({ sections: z.array(savedSectionSchema) })

export const adminTournamentResponseSchema = z.strictObject({
  tournament: adminTournamentSchema,
})

const customDetailInputSchema = z.looseObject({ title: z.string(), body: z.string() })

/**
 * POST /api/admin/tournaments (adminCreateTournament in src/lib/api.ts).
 * Every field is optional here: the handler answers a missing name,
 * location, date or entry fee, and an unknown status, with its own words.
 */
export const createTournamentRequestSchema = z.looseObject({
  id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  entryFee: z.number().nullable().optional(),
  sections: z.array(sectionListItemSchema).nullable().optional(),
  rounds: z.number().int().nullable().optional(),
  maxPlayers: z.number().int().nullable().optional(),
  status: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  registrationDeadline: z.string().nullable().optional(),
  clubId: z.string().nullable().optional(),
  isRated: z.boolean().optional(),
  timeControl: z.string().nullable().optional(),
  registrationClosesAt: z.string().nullable().optional(),
  customDetails: z.array(customDetailInputSchema).optional(),
})

/**
 * PATCH /api/admin/tournaments/[id] (adminUpdateTournament). A key left out
 * keeps the column; null clears it where the column allows. sections: null
 * also keeps the sections, as before.
 */
export const updateTournamentRequestSchema = z.looseObject({
  name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  entryFee: z.number().nullable().optional(),
  sections: z.array(sectionListItemSchema).nullable().optional(),
  rounds: z.number().int().nullable().optional(),
  maxPlayers: z.number().int().nullable().optional(),
  status: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  registrationDeadline: z.string().nullable().optional(),
  isRated: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  pairingSystem: z.string().optional(),
  accelerated: z.boolean().optional(),
  keepApart: z.string().optional(),
  isStateChampionship: z.boolean().optional(),
  reportSettings: z.record(z.string(), z.unknown()).nullable().optional(),
  earlyDeadline: z.string().nullable().optional(),
  earlyDiscount: z.number().nullable().optional(),
  lateAfter: z.string().nullable().optional(),
  lateFee: z.number().nullable().optional(),
  memberDiscount: z.number().nullable().optional(),
  roundSchedule: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  registrationClosesAt: z.string().nullable().optional(),
  customDetails: z.array(customDetailInputSchema).optional(),
  timeControl: z.string().nullable().optional(),
  clubId: z.string().nullable().optional(),
})

/** GET /api/tournaments. Public; signed-in managers also see their drafts. */
export const tournamentsListResponseSchema = z.strictObject({
  tournaments: z.array(tournamentListItemSchema),
})

export type TournamentStatus = z.infer<typeof tournamentStatusSchema>
export type TournamentSection = z.infer<typeof tournamentSectionSchema>
export type TournamentListItem = z.infer<typeof tournamentListItemSchema>
export type TournamentsListResponse = z.infer<typeof tournamentsListResponseSchema>
export type SectionRequest = z.infer<typeof sectionSchema>
export type SectionListItemRequest = z.infer<typeof sectionListItemSchema>
export type SavedSection = z.infer<typeof savedSectionSchema>
export type AdminTournament = z.infer<typeof adminTournamentSchema>
export type AdminTournamentResponse = z.infer<typeof adminTournamentResponseSchema>
export type CreateTournamentRequest = z.infer<typeof createTournamentRequestSchema>
export type UpdateTournamentRequest = z.infer<typeof updateTournamentRequestSchema>
