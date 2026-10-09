// domain/contracts/events.ts
// Contracts for the tournament endpoints.
//
// Response schemas are strict: a field the endpoint starts sending, or stops
// sending, fails its contract test until the schema says so. That is the
// point of the contract, so when a migration adds a column to tournaments
// (the list endpoint returns t.*), add it here in the same change.
import { z } from 'zod'
import { dollarsSchema, flagSchema, idSchema, isoDateSchema, storedTimestampSchema } from './common'
import { registrationPaymentStatusSchema, registrationRowSchema } from './registration'

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

/**
 * A section as every endpoint that returns a tournament answers it
 * (sectionResponse in functions/utils/events/sectionsRepo.ts): a row of
 * tournament_sections, in order, under today's field names plus its id,
 * its cap and its prices. Every field a page read from the JSON element
 * keeps its name and type: prizeFund, unratedOk and prizes are left out
 * when the row has none, as the element left them out, and a section
 * stored as a bare name is now an object like any other.
 *
 * entryFee and fees.regular are the price an entry pays at the regular
 * rate (the section's own, else the tournament's entry fee); fees.early
 * and fees.late are the early and late prices, the section's own or worked
 * out from the tournament (tierFees in domain/events/sections.ts), null
 * when the event has no such price. They are prices to show, not prices
 * to send back: a request whose fees carry `regular` is taken as this
 * answer echoed and its fees are ignored (sectionSchema below).
 *
 * Any other key is one the JSON element carried that no column holds
 * (extra_json), passed back as it was stored so that a page which sends
 * its sections back as it loaded them keeps it. Only the keys above are
 * promised; the ones above are strict.
 */
export const savedSectionSchema = z.object({
  id: idSchema,
  name: z.string(),
  entryFee: dollarsSchema,
  prizeFund: z.string().optional(),
  ratingMax: z.number().nullable(),
  ratingMin: z.number().nullable(),
  unratedOk: z.boolean().optional(),
  gradeMin: z.number().nullable(),
  gradeMax: z.number().nullable(),
  rulesSet: z.boolean(),
  prizes: sectionPrizesSchema.optional(),
  cap: z.number().int().positive().nullable(),
  fees: z.strictObject({
    regular: dollarsSchema,
    early: dollarsSchema.nullable(),
    late: dollarsSchema.nullable(),
  }),
}).catchall(z.unknown())

/** A JSON value kept as text in its column and passed through unparsed. */
const storedJsonTextSchema = z.string()

/**
 * A JSON list column read into an array (custom_details where an endpoint
 * parses it): the objects as the setup stored them. The setup's request
 * contract takes any objects here, so only that is promised. Text that is
 * not a JSON list reads as [].
 */
const storedJsonListSchema = z.array(z.record(z.string(), z.unknown()))

/**
 * One round of a schedule in an answer (scheduleRoundResponse in
 * functions/utils/events/schedulesRepo.ts), from tournament_schedule_rounds.
 * date and time are the text the setup wrote, as it wrote it ("2026-10-24",
 * "19:00"); a blank or a time not set yet is ''. Times are never
 * reformatted on the server.
 */
export const scheduleRoundSchema = z.strictObject({
  round: z.number().int().min(1),
  date: z.string(),
  time: z.string(),
})

/**
 * A schedule in an answer: a live row of tournament_schedules with its
 * rounds, by round. Every event has exactly one primary (the main
 * schedule). Another schedule plays its own rounds 1 to mergeRound - 1 and
 * merges into the primary at mergeRound (domain/events/schedules.ts).
 * timeControl null means the tournament's own.
 */
export const scheduleSchema = z.strictObject({
  id: idSchema,
  label: z.string(),
  timeControl: z.string().nullable(),
  isPrimary: z.boolean(),
  mergeRound: z.number().int().min(2).nullable(),
  rounds: z.array(scheduleRoundSchema),
})

/**
 * 80 is SCHEDULE_LABEL_MAX in domain/events/schedules.ts;
 * test/unit/schedules-domain.test.ts holds the two equal.
 */
const scheduleLabelSchema = z.string()
  .min(1, 'Give the schedule a name.')
  .max(80, 'Schedule names can be at most 80 characters.')
  .refine((label) => label.trim() !== '', 'Give the schedule a name.')

/**
 * A schedule in an edit request (ScheduleInput in domain/events/schedules.ts):
 * the whole list of live schedules, as an answer gave them or as the setup
 * builds them. An id names the row being edited; a primary without one is
 * the event's existing primary, and any other schedule without one is new.
 * label and timeControl left out keep the row's. The merge round and the
 * rounds each schedule must list are checked against the event's round
 * count by validateSchedules, which answers 400 in words. Loose, like every
 * request schema.
 */
export const scheduleInputSchema = z.looseObject({
  id: idSchema.optional(),
  label: scheduleLabelSchema.optional(),
  timeControl: z.string().nullable().optional(),
  isPrimary: z.boolean(),
  mergeRound: z.number().int().nullable().optional(),
  rounds: z.array(z.looseObject({
    round: z.number().int().min(1),
    date: z.string().nullable().optional(),
    time: z.string().nullable().optional(),
  })),
})

/**
 * Wall-clock text from the setup form (a deadline or an opening time). The
 * form writes "2026-10-24" or "2026-10-24T19:00"; older rows vary, so only
 * the type is promised.
 */
const wallClockTextSchema = z.string()

/**
 * One row of GET /api/tournaments: every column of tournaments, with the
 * live sections from tournament_sections, round_schedule as the primary
 * schedule's rounds and the live schedules from tournament_schedules
 * (toTournamentResponse in functions/utils/events/sectionsRepo.ts), plus
 * the club's name and colour from the join. custom_details and
 * report_settings stay raw JSON text on this endpoint.
 */
export const tournamentListItemSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  location: z.string(),
  venue: z.string().nullable(),
  date: isoDateSchema,
  end_date: isoDateSchema.nullable(),
  entry_fee: dollarsSchema,
  sections: z.array(savedSectionSchema),
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
  round_schedule: z.array(scheduleRoundSchema),
  schedules: z.array(scheduleSchema),
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
 *
 * fees may carry `regular`: that is a section as an answer gave it
 * (savedSectionSchema), which the manage page sends back when it saves its
 * sections and the setup wizard copies from another event. Those prices
 * were worked out for showing, so fees with `regular` are ignored and the
 * row keeps its own early and late prices (buildSaveSections). To set a
 * section's own early or late price, send fees without `regular`.
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
    regular: dollarsSchema.optional(),
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
 * A tournament as the admin create and edit endpoints and the registration
 * settings save return it: every column of tournaments, with its live
 * sections from the table, ids included, round_schedule as the primary
 * schedule's rounds and the live schedules (toTournamentResponse).
 * custom_details and report_settings stay raw JSON text.
 */
export const adminTournamentSchema = tournamentListItemSchema
  .omit({ club_name: true, club_color: true })

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
 *
 * The round times come in one of two forms, never both (400). roundSchedule
 * is what the setup form sends today: the main schedule's rounds, any
 * objects, read as the legacy JSON is read (normalizeRoundSchedule in
 * domain/events/schedules.ts); null clears them. schedules is the whole
 * list of live schedules, a second one with its merge round included; no
 * screen sends it yet (the setup redesign, WS08, will).
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
  schedules: z.array(scheduleInputSchema).optional(),
  registrationClosesAt: z.string().nullable().optional(),
  customDetails: z.array(customDetailInputSchema).optional(),
  timeControl: z.string().nullable().optional(),
  clubId: z.string().nullable().optional(),
})

/** GET /api/tournaments. Public; signed-in managers also see their drafts. */
export const tournamentsListResponseSchema = z.strictObject({
  tournaments: z.array(tournamentListItemSchema),
})

/** The CHECK on tournament_games.result (0019). */
export const gameResultSchema = z.enum(['1-0', '0-1', '1/2-1/2', '1-0 F', '0-1 F', '0-0 F', 'bye', 'bye-half', 'pending'])

/** Every column of tournament_games, as g.* returns it. */
const gameRowShape = {
  id: idSchema,
  tournament_id: idSchema,
  round: z.number().int(),
  board: z.number().int(),
  section: z.string(),
  white_member_id: idSchema.nullable(),
  black_member_id: idSchema.nullable(),
  result: gameResultSchema,
  created_at: storedTimestampSchema,
}

/**
 * One player's line in the standings (computeStandings in
 * functions/utils/tournament-manage.ts), per section, in final order.
 */
export const standingSchema = z.strictObject({
  member_id: idSchema,
  full_name: z.string(),
  section: z.string(),
  rating: z.number().nullable(),
  score: z.number().min(0),
  wins: z.number().int().min(0),
  draws: z.number().int().min(0),
  losses: z.number().int().min(0),
  place: z.number().int().min(1),
  /** "3", or "3-5" for a shared place. */
  placeLabel: z.string(),
  tiebreaks: z.strictObject({
    modifiedMedian: z.number(),
    solkoff: z.number(),
    cumulative: z.number(),
    oppCumulative: z.number(),
    blacks: z.number(),
  }),
})

/** One player's prize (PrizeAward in functions/utils/prizes.ts). */
export const prizeAwardSchema = z.strictObject({
  member_id: idSchema,
  section: z.string(),
  /** "1st–2nd place (tie)", "Top U1400", ... */
  prize: z.string(),
  cash: dollarsSchema,
  /** Non-cash items won, such as "Trophy". */
  items: z.array(z.string()),
})

/**
 * The tournament as GET /api/tournaments/[id] answers it: every column,
 * the live sections from the table (archived ones are not offered for
 * entry), round_schedule and the schedules from the schedule tables,
 * custom_details read into an array, and how many players wait for a spot.
 */
export const tournamentDetailSchema = adminTournamentSchema
  .omit({ custom_details: true })
  .extend({
    custom_details: storedJsonListSchema,
    waitlist_count: z.number().int().min(0),
  })

/**
 * GET /api/tournaments/[id] (getTournament). Public for a visible event;
 * a hidden one answers 404 unless the viewer can manage it or observes.
 * The roster leaves out payment status and the waitlist. Prizes are
 * published once the event is completed, and [] before.
 */
export const tournamentDetailResponseSchema = z.strictObject({
  tournament: tournamentDetailSchema,
  roster: z.array(z.strictObject({
    member_id: idSchema,
    section: z.string(),
    withdrawn_at: z.string().nullable(),
    rating_at_entry: z.number().int().nullable(),
    full_name: z.string(),
    uscf_id: z.string().nullable(),
    uscf_rating: z.number().int().nullable(),
  })),
  pairings: z.array(z.strictObject({
    ...gameRowShape,
    white_name: z.string().nullable(),
    white_rating: z.number().int().nullable(),
    black_name: z.string().nullable(),
    black_rating: z.number().int().nullable(),
  })),
  standings: z.array(standingSchema),
  prizes: z.array(prizeAwardSchema),
  /**
   * The signed-in viewer's own entry, every column, with bye_rounds read
   * into a list (left as the stored text if it is not JSON); null when
   * signed out or not entered.
   */
  myRegistration: registrationRowSchema
    .extend({ bye_rounds: z.union([z.array(z.number()), z.string()]).nullable() })
    .nullable(),
})

/**
 * GET /api/admin/tournaments/[id]/manage (getTournamentManage): what the
 * manage page loads. The tournament as the detail answers it, without the
 * waitlist count; the whole roster, waitlist and payment status included;
 * every game; the standings and the prizes as they stand now.
 */
export const tournamentManageResponseSchema = z.strictObject({
  tournament: adminTournamentSchema.omit({ custom_details: true }).extend({ custom_details: storedJsonListSchema }),
  roster: z.array(z.strictObject({
    registration_id: idSchema,
    member_id: idSchema,
    section: z.string(),
    payment_status: registrationPaymentStatusSchema,
    /** Read into a list; [] when none or not JSON. */
    bye_rounds: z.array(z.number()),
    withdrawn_at: z.string().nullable(),
    checked_in_at: z.string().nullable(),
    rating_at_entry: z.number().int().nullable(),
    waitlisted_at: storedTimestampSchema.nullable(),
    grade: z.string().nullable(),
    uscf_expiration: z.string().nullable(),
    full_name: z.string(),
    uscf_id: z.string().nullable(),
    uscf_rating: z.number().int().nullable(),
  })),
  games: z.array(z.strictObject({
    ...gameRowShape,
    white_name: z.string().nullable(),
    black_name: z.string().nullable(),
  })),
  standings: z.array(standingSchema),
  prizes: z.array(prizeAwardSchema),
  directors: z.array(z.strictObject({
    member_id: idSchema,
    full_name: z.string(),
    email: z.string(),
  })),
})

/**
 * PATCH /api/admin/tournaments/[id]/registration
 * (updateTournamentRegistration): whether entries are taken, when they
 * open, and the two reminder emails. A key left out keeps its column.
 */
export const registrationSettingsRequestSchema = z.looseObject({
  registration_status: registrationStatusSchema.optional(),
  registration_opens_at: z.string().nullable().optional(),
  reminder_1_days_before: z.number().int().min(0).optional(),
  reminder_1_enabled: z.boolean().optional(),
  reminder_2_days_before: z.number().int().min(0).optional(),
  reminder_2_enabled: z.boolean().optional(),
})

/** US Chess crosstable codes: W, L, D played; X forfeit win, F forfeit loss; B full bye, H half bye; U unplayed. */
const ratingCodeSchema = z.enum(['W', 'L', 'D', 'X', 'F', 'B', 'H', 'U'])

/**
 * GET /api/admin/tournaments/[id]/rating-report (getRatingReport): the
 * US Chess rating report of a rated event. One section per section name,
 * archived sections included (history), listing only the players who
 * played a game; sections with no such player are left out.
 */
export const ratingReportResponseSchema = z.strictObject({
  tournament: z.strictObject({
    name: z.string(),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    location: z.string(),
    rounds: z.number().int().min(0),
    timeControl: z.string().nullable(),
  }),
  upload: z.strictObject({
    /** report_settings read back; null when none was saved or it is not JSON. */
    settings: z.unknown(),
    suggested: z.strictObject({
      chiefTdId: z.string(),
      chiefTdName: z.string(),
      assistantTdId: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
    }),
  }),
  sections: z.array(z.strictObject({
    name: z.string(),
    players: z.array(z.strictObject({
      pairingNum: z.number().int().min(1),
      name: z.string(),
      uscfId: z.string().nullable(),
      preRating: z.number().nullable(),
      score: z.number().min(0),
      rounds: z.array(z.strictObject({
        round: z.number().int().min(1),
        code: ratingCodeSchema,
        opponentPairingNum: z.number().int().min(1).nullable(),
        color: z.enum(['W', 'B']).nullable(),
      })),
    })),
  })),
  validationErrors: z.array(z.string()),
})

/**
 * An LCA event in GET /api/clearinghouse: the columns the feed selects
 * under the clearinghouse's names, the live sections from the table and
 * how many have entered.
 */
const feedLcaEventSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  start_date: isoDateSchema,
  end_date: isoDateSchema,
  organizer: z.string(),
  city: z.string(),
  state: z.literal('LA'),
  venue: z.string().nullable(),
  rating_system: z.string().nullable(),
  eligibility: z.null(),
  contact: z.null(),
  link: z.null(),
  is_lca: z.literal(1),
  source: z.literal('lca'),
  registration_status: registrationStatusSchema,
  entry_fee: dollarsSchema,
  sections: z.array(savedSectionSchema),
  rounds: z.number().int().min(0),
  status: tournamentStatusSchema,
  is_rated: flagSchema,
  time_control: z.string().nullable(),
  max_players: z.number().int().min(0).nullable(),
  registered_count: z.number().int().min(0),
  club_id: idSchema.nullable(),
  club_color: z.string().nullable(),
  club_name: z.string().nullable(),
})

/**
 * A partner event in GET /api/clearinghouse, from the Gulf South
 * clearinghouse. Partner events register on the organizer's site, so they
 * carry no sections, fee or count.
 */
const feedPartnerEventSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  organizer: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  venue: z.string().nullable(),
  rating_system: z.string().nullable(),
  eligibility: z.string().nullable(),
  contact: z.string().nullable(),
  link: z.string().nullable(),
  is_lca: z.literal(0),
  source: z.literal('clearinghouse'),
  synced_at: z.string().nullable(),
  registration_status: z.null(),
  entry_fee: z.null(),
  sections: z.tuple([]),
  rounds: z.null(),
  status: z.null(),
  is_rated: z.null(),
  club_id: z.null(),
  club_color: z.null(),
  club_name: z.null(),
})

/**
 * GET /api/clearinghouse (getClearinghouse): visible LCA events merged with
 * partner events, by start date. `state` and `upcoming` filter both.
 */
export const clearinghouseResponseSchema = z.strictObject({
  tournaments: z.array(z.discriminatedUnion('source', [feedLcaEventSchema, feedPartnerEventSchema])),
})
export const clearinghouseQuerySchema = z.looseObject({
  state: z.string().optional(),
  upcoming: z.string().optional(),
})

export type TournamentStatus = z.infer<typeof tournamentStatusSchema>
export type TournamentSection = z.infer<typeof tournamentSectionSchema>
export type TournamentListItem = z.infer<typeof tournamentListItemSchema>
export type TournamentsListResponse = z.infer<typeof tournamentsListResponseSchema>
export type SectionRequest = z.infer<typeof sectionSchema>
export type SectionListItemRequest = z.infer<typeof sectionListItemSchema>
export type SavedSection = z.infer<typeof savedSectionSchema>
export type ScheduleRound = z.infer<typeof scheduleRoundSchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type ScheduleRequest = z.infer<typeof scheduleInputSchema>
export type AdminTournament = z.infer<typeof adminTournamentSchema>
export type AdminTournamentResponse = z.infer<typeof adminTournamentResponseSchema>
export type CreateTournamentRequest = z.infer<typeof createTournamentRequestSchema>
export type UpdateTournamentRequest = z.infer<typeof updateTournamentRequestSchema>
export type TournamentDetailResponse = z.infer<typeof tournamentDetailResponseSchema>
export type TournamentManageResponse = z.infer<typeof tournamentManageResponseSchema>
export type RegistrationSettingsRequest = z.infer<typeof registrationSettingsRequestSchema>
export type RatingReportResponse = z.infer<typeof ratingReportResponseSchema>
export type ClearinghouseResponse = z.infer<typeof clearinghouseResponseSchema>
