// domain/contracts/clubs.ts
// Contracts for the club endpoints.
//
// Response schemas are strict, like the tournament ones: a field the
// endpoint starts or stops sending fails its contract test until the
// schema says so.
import { z } from 'zod'
import { dollarsSchema, flagSchema, idSchema, isoDateSchema, storedTimestampSchema } from './common'
import { registrationStatusSchema, savedSectionSchema, tournamentStatusSchema } from './events'
import { openSuggestionSchema } from './clubReports'
import { clubRequestRowSchema } from './clubRequests'
import { repRequestRowSchema } from './clubRepRequests'

/**
 * The club's public row: today's 13 columns of clubs, in the table's own
 * order, the named list GET /api/clubs/[id] selects and
 * PUBLIC_CLUB_COLUMNS in functions/utils/clubs/publicAnswer.ts keeps. A
 * column added to the table is public only once it is named in both.
 */
export const clubRowSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  city: z.string(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  meeting_schedule: z.string().nullable(),
  contact_email: z.string().nullable(),
  created_at: storedTimestampSchema,
  color: z.string().nullable(),
  image_url: z.string().nullable(),
  region: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
})

/**
 * One club in GET /api/clubs (getClubs), A to Z by name: the nine columns
 * the clubs page and its map read, and no contact email.
 */
export const clubListItemSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  city: z.string(),
  meeting_schedule: z.string().nullable(),
  color: z.string().nullable(),
  image_url: z.string().nullable(),
  region: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
})

/** GET /api/clubs (getClubs) with CLUB_PAGES_ON unset, as it ships. Public; every club, whoever asks. */
export const clubListResponseSchema = z.strictObject({
  clubs: z.array(clubListItemSchema),
})

/**
 * One club in GET /api/clubs while CLUB_PAGES_ON is set (WS09 step 32), what
 * the new directory reads: the nine columns above, unchanged and in their
 * order, then the address part of the club's page (its slug, or its id while
 * it has none), how the club meets in its own words or null, the club's
 * description for a club with no statement (null for one with a statement),
 * the club's point (its first place's, or today's pin while it has no place,
 * or null) and the two ticks of Who is welcome. No keeper, no seat, no
 * person's name and no address of any kind (K's decision 12).
 */
export const clubDirectoryItemSchema = z.strictObject({
  ...clubListItemSchema.shape,
  slug: z.string(),
  statement: z.string().nullable(),
  description: z.string().nullable(),
  point: z.strictObject({ latitude: z.number(), longitude: z.number() }).nullable(),
  weekend_play: z.boolean(),
  scholastic_friendly: z.boolean(),
})

/** GET /api/clubs while CLUB_PAGES_ON is set: the same clubs, A to Z by name, each with the directory's keys. */
export const clubDirectoryResponseSchema = z.strictObject({
  clubs: z.array(clubDirectoryItemSchema),
})

/** GET /api/clubs in either of its two shapes: today's, or the directory's while CLUB_PAGES_ON is set. */
export const clubsAnswerSchema = z.union([clubListResponseSchema, clubDirectoryResponseSchema])

/**
 * One of the club's visible events on its page, newest first: the columns
 * the page lists, with the live sections from tournament_sections in the
 * shape every tournament endpoint gives them.
 */
export const clubTournamentSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  date: isoDateSchema,
  end_date: isoDateSchema.nullable(),
  status: tournamentStatusSchema,
  entry_fee: dollarsSchema,
  sections: z.array(savedSectionSchema),
  rounds: z.number().int().min(0),
})

/**
 * GET /api/clubs/[id] (getClub). Public; hidden drafts are left out. Each
 * officer is answered by role and name alone, never with an email, whoever
 * asks. The club's contact_email is left out once CLUB_EMAIL_HIDDEN is set
 * (functions/utils/clubs/publicAnswer.ts), so it is optional here alone.
 */
export const clubDetailResponseSchema = z.strictObject({
  club: clubRowSchema.partial({ contact_email: true }),
  officers: z.array(z.strictObject({
    id: idSchema,
    role: z.string(),
    full_name: z.string(),
  })),
  tournaments: z.array(clubTournamentSchema),
  news: z.array(z.strictObject({
    id: idSchema,
    title: z.string(),
    excerpt: z.string(),
    news_date: z.string(),
  })),
})

export type ClubListResponse = z.infer<typeof clubListResponseSchema>
export type ClubDirectoryItem = z.infer<typeof clubDirectoryItemSchema>
export type ClubDirectoryResponse = z.infer<typeof clubDirectoryResponseSchema>
export type ClubDetailResponse = z.infer<typeof clubDetailResponseSchema>

// ── The admin club endpoints: GET and PATCH /api/admin/clubs/[id] and PUT
// /api/admin/clubs/[id]/places. The club's keepers (an LCA admin, the club's
// rep and the representative for its region) save the listing here. The new
// fields, the places and the slug change are open only while CLUB_KEEPERS_ON
// is set (functions/utils/clubs/pages.ts); with it unset the GET and the
// PATCH answer exactly what they answered before.

/** The longest text of each new listing field, in characters. */
export const CLUB_TEXT_LIMITS = {
  aboutText: 2000,
  howWeMeetText: 500,
  costText: 300,
  welcomeText: 1000,
  contactNamePublic: 100,
  facebookUrl: 500,
  websiteUrl: 500,
  otherUrl: 500,
} as const

/**
 * The longest text of each of today's fields, in characters, on the keepers'
 * save alone (CLUB_KEEPERS_ON set); with it unset today's body is read as it
 * always was. Each holds at least what the mirror writes there: the
 * description About's 2,000, the meeting schedule the statement's 500 and the
 * location place 1's name, a comma and a space, and its street (322); the
 * color leaves room for the odd value today's save ignores rather than
 * refuses. The admin club page's inputs set no length of their own, so a value
 * already stored over its limit is taken back unchanged
 * (updateClubRequestSchemaFor) and only a new value is held to it.
 */
export const CLUB_TODAY_LIMITS = {
  name: 120,
  city: 120,
  location: 330,
  description: 4000,
  meetingSchedule: 500,
  contactEmail: 254,
  color: 32,
  imageUrl: 500,
  region: 120,
} as const

/** The longest text of each part of a place, in characters. */
export const CLUB_PLACE_LIMITS = { name: 120, street: 200, note: 300 } as const

/** The most places a club lists. */
export const CLUB_PLACES_MAX = 2

/**
 * The longest slug, the length a club's id has always been cut to:
 * SLUG_MAX_LENGTH in domain/clubs/slug.ts, which this folder may not import;
 * test/integration/contracts/admin-clubs.test.ts holds the two equal.
 */
export const CLUB_SLUG_MAX = 48

/** A slug as domain/clubs/slug.ts makes one: lower case letters and digits in runs joined by single hyphens. */
export const CLUB_SLUG_FORM = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * The words a link field is refused with. They say what to do rather than
 * what is wrong, and an address copied whole from a browser's address bar
 * passes isWebAddress, so they hold whichever reason refused the link: a
 * missing http:// or https://, a space, a name before the site, a quote mark,
 * a hidden character, a backslash, a third slash or a port that cannot be.
 */
export const WEB_ADDRESS_WORDS = 'Paste the whole web address copied from the browser\'s address bar, starting with https:// or http://'

/**
 * The written form of a link: http:// or https://, then no space, control
 * character or backslash, and not a third slash. A URL parser also reads
 * "http:example.org", "https:/example.org" and a backslash or a tab inside an
 * address, and the text is stored as typed, so the form is asked first.
 */
const WEB_ADDRESS_FORM = /^https?:\/\/[^\s\\/\p{Cc}][^\s\\\p{Cc}]*$/iu

/**
 * What no link a visitor can trust holds as typed: a quote mark, an angle
 * bracket or a backtick, which a browser writes as %22, %3C, %3E or %60 in an
 * address it copies, and the invisible format marks, such as the one that
 * turns the text after it around, which make a link read as another.
 */
const NOT_IN_A_LINK = /["<>`\p{Cf}]/u

/** True for an address written as http:// or https:// with a host after it. */
export function isWebAddress(text: string): boolean {
  if (!WEB_ADDRESS_FORM.test(text) || NOT_IN_A_LINK.test(text)) return false
  try {
    const url = new URL(text)
    // A name or a password before an @ makes "https://facebook.com@example.net" lead to example.net.
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

/** A place's point, set by hand: a latitude and a longitude within the world's bounds. */
export const clubPlacePointSchema = z.looseObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * A club's places, at most two, in their order, which replace the ones it
 * has. Each has a name, and may have a street, a note and a point set by hand
 * (a click on the map or pasted numbers); nothing is looked up at any
 * provider. Written once here and read by both saves that take places: the
 * PUT's body (clubPlacesRequestSchema) and the PATCH's optional `places`
 * (updateClubRequestSchema).
 */
export const clubPlacesListSchema = z.array(z.looseObject({
  name: z.string().trim().min(1, 'A place needs a name').max(CLUB_PLACE_LIMITS.name),
  street: z.string().max(CLUB_PLACE_LIMITS.street).nullable().optional(),
  note: z.string().max(CLUB_PLACE_LIMITS.note).nullable().optional(),
  point: clubPlacePointSchema.nullable().optional(),
})).max(CLUB_PLACES_MAX, `A club lists at most ${CLUB_PLACES_MAX} places`)

const keeperText = (max: number) => z.string().max(max).nullable().optional()
const keeperLink = (max: number) =>
  z.string().max(max).refine((text) => text.trim() === '' || isWebAddress(text.trim()), WEB_ADDRESS_WORDS).nullable().optional()

/**
 * Today's body of PATCH /api/admin/clubs/[id], as src/areas/clubs/api.ts's
 * adminUpdateClub sends it from the admin club page: the details form (name,
 * city, location, description, meetingSchedule, contactEmail, color,
 * region) and the map pin alone ({ mapLocation }). Lenient as the handler
 * has always been: no length, no email form and no bounds here, since the
 * handler answers those in its own words, and null on every field the form
 * can clear.
 */
const todaysClubSaveShape = {
  name: z.string().optional(),
  city: z.string().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  meetingSchedule: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  /** The club's pin on today's Clubs map; null removes it. */
  mapLocation: z.looseObject({ lat: z.number(), lng: z.number() }).nullable().optional(),
}

/** Today's body alone: what the PATCH reads while CLUB_KEEPERS_ON is unset. */
export const todaysClubSaveRequestSchema = z.looseObject(todaysClubSaveShape)

/**
 * PATCH /api/admin/clubs/[id]: today's body, and with CLUB_KEEPERS_ON set
 * the listing's new fields. Each text has its greatest length, today's
 * (CLUB_TODAY_LIMITS) and the new ones (CLUB_TEXT_LIMITS); each of the three links is empty or a web address that
 * starts with http:// or https://; an empty text or null clears a field.
 * `slug` is the club's address after /clubs/, an LCA admin's alone to
 * change, at most 48 characters in a slug's form. `places`, when sent, is
 * the club's places as the PUT takes them (clubPlacesListSchema), saved in
 * the same batch as the listing, so one press of the editor is one save.
 * `toldUpdatedAt` is the club's last save (told_updated_at) as the form that
 * sends the body read it, null only for a club with no stamp, since
 * migration 0067 stamps every club; when it is sent and the club has been
 * saved since, the save is refused 409 and nothing is written. With the constant unset a body that carries any of
 * the new keys is refused 403; `toldUpdatedAt` is not read then.
 */
export const updateClubRequestSchema = z.looseObject({
  ...todaysClubSaveShape,
  name: z.string().max(CLUB_TODAY_LIMITS.name).optional(),
  city: z.string().max(CLUB_TODAY_LIMITS.city).optional(),
  location: keeperText(CLUB_TODAY_LIMITS.location),
  description: keeperText(CLUB_TODAY_LIMITS.description),
  meetingSchedule: keeperText(CLUB_TODAY_LIMITS.meetingSchedule),
  contactEmail: keeperText(CLUB_TODAY_LIMITS.contactEmail),
  color: keeperText(CLUB_TODAY_LIMITS.color),
  imageUrl: keeperText(CLUB_TODAY_LIMITS.imageUrl),
  region: keeperText(CLUB_TODAY_LIMITS.region),
  aboutText: keeperText(CLUB_TEXT_LIMITS.aboutText),
  howWeMeetText: keeperText(CLUB_TEXT_LIMITS.howWeMeetText),
  costText: keeperText(CLUB_TEXT_LIMITS.costText),
  welcomeText: keeperText(CLUB_TEXT_LIMITS.welcomeText),
  weekendPlay: z.boolean().optional(),
  scholasticFriendly: z.boolean().optional(),
  contactNamePublic: keeperText(CLUB_TEXT_LIMITS.contactNamePublic),
  facebookUrl: keeperLink(CLUB_TEXT_LIMITS.facebookUrl),
  websiteUrl: keeperLink(CLUB_TEXT_LIMITS.websiteUrl),
  otherUrl: keeperLink(CLUB_TEXT_LIMITS.otherUrl),
  slug: z.string().max(CLUB_SLUG_MAX).regex(CLUB_SLUG_FORM, 'An address is lower case letters and digits, joined by single hyphens').optional(),
  places: clubPlacesListSchema.optional(),
  toldUpdatedAt: z.string().max(40).nullable().optional(),
})

/** Today's text fields that may already be stored longer than their limit, by the save's own key. */
export type ClubTodayStored = Partial<Record<keyof typeof CLUB_TODAY_LIMITS, unknown>>

/**
 * The PATCH's schema for one club, while CLUB_KEEPERS_ON is set:
 * updateClubRequestSchema, except that a field of today's whose stored value
 * is already longer than its limit (saved while the constant was unset, when
 * today's save kept no length) takes that same value back. The admin club
 * page sends the whole record on every save, so without this one long field
 * would keep the club's details form from saving at all; a new value is
 * still held to the limit, in the same words.
 */
export function updateClubRequestSchemaFor(stored: ClubTodayStored) {
  const kept: Record<string, z.ZodType> = {}
  for (const [key, max] of Object.entries(CLUB_TODAY_LIMITS) as [keyof typeof CLUB_TODAY_LIMITS, number][]) {
    const value = stored[key]
    if (typeof value !== 'string' || value.length <= max) continue
    const text = z.string().superRefine((typed, ctx) => {
      if (typed.length > max && typed !== value) ctx.addIssue({ code: 'too_big', maximum: max, origin: 'string', inclusive: true, input: typed })
    })
    kept[key] = key === 'name' || key === 'city' ? text.optional() : text.nullable().optional()
  }
  return Object.keys(kept).length === 0 ? updateClubRequestSchema : updateClubRequestSchema.extend(kept)
}

/**
 * PUT /api/admin/clubs/[id]/places: the club's places (clubPlacesListSchema),
 * which replace the ones it has. Open only while CLUB_KEEPERS_ON is set. The
 * club editor sends its places with the listing in the PATCH instead.
 */
export const clubPlacesRequestSchema = z.looseObject({
  places: clubPlacesListSchema,
})

/** One of the club's places, as the admin endpoints answer it, first place first. */
export const clubPlaceSchema = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  street: z.string().nullable(),
  note: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
})

/**
 * The fifteen columns migration 0066 added to clubs, each optional: the
 * admin answers carry all of them while CLUB_KEEPERS_ON is set and none
 * while it is unset. told_by and confirmed_by are member ids, never an
 * email.
 */
const keeperColumnsShape = {
  slug: z.string().nullable().optional(),
  about_text: z.string().nullable().optional(),
  how_we_meet_text: z.string().nullable().optional(),
  cost_text: z.string().nullable().optional(),
  welcome_text: z.string().nullable().optional(),
  weekend_play: flagSchema.optional(),
  scholastic_friendly: flagSchema.optional(),
  contact_name_public: z.string().nullable().optional(),
  facebook_url: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
  other_url: z.string().nullable().optional(),
  told_updated_at: storedTimestampSchema.nullable().optional(),
  told_by: idSchema.nullable().optional(),
  last_confirmed_at: storedTimestampSchema.nullable().optional(),
  confirmed_by: idSchema.nullable().optional(),
}

/** The club in the admin answers: today's 13 columns, and the fifteen new ones while CLUB_KEEPERS_ON is set. */
export const adminClubRowSchema = z.strictObject({ ...clubRowSchema.shape, ...keeperColumnsShape })

/**
 * What a person may do with a club's events (functions/utils/clubs/eventRights.ts),
 * which GET /api/admin/clubs/[id] answers as `eventRights` only while
 * REGION_EVENTS_ON is set: `add`, whether the create admits them for the
 * club, 'for_approval' where the event they create waits for an LCA admin's
 * approval and runs at $0; `manage`, whether they run the club's events;
 * `decide`, whether they approve the club's waiting events or ask for
 * changes (an LCA admin); and `askPayout`, whether a payout request can go
 * through (CREATION_ROLES_ON).
 */
export const clubEventRightsSchema = z.strictObject({
  add: z.enum(['no', 'yes', 'for_approval']),
  manage: z.boolean(),
  decide: z.boolean(),
  askPayout: z.boolean(),
})

/**
 * GET /api/admin/clubs/[id] (adminGetClub), for an LCA admin, an observer,
 * the club's rep and the representative for its region. The officers carry
 * their email and the roster its members for all but a person admitted by
 * the region alone, who gets the officers without an email and an empty
 * roster (functions/utils/clubs/memberView.ts), and `rosterKeptBack: true`,
 * which no one else is answered, so the page can tell a roster kept back
 * from an empty one. `places` is answered only while CLUB_KEEPERS_ON is set.
 */
export const adminClubResponseSchema = z.strictObject({
  club: adminClubRowSchema,
  officers: z.array(z.strictObject({
    id: idSchema,
    member_id: idSchema,
    role: z.string(),
    full_name: z.string(),
    email: z.string().optional(),
  })),
  roster: z.array(z.strictObject({
    id: idSchema,
    full_name: z.string(),
    email: z.string(),
    uscf_id: z.string().nullable(),
    uscf_rating: z.number().nullable(),
    membership_status: z.string(),
  })),
  rosterKeptBack: z.literal(true).optional(),
  tournaments: z.array(z.strictObject({
    id: idSchema,
    name: z.string(),
    date: isoDateSchema,
    end_date: isoDateSchema.nullable(),
    status: tournamentStatusSchema,
    is_visible: flagSchema,
    registration_status: registrationStatusSchema,
    /** The three columns of the approval wait, answered only while REGION_EVENTS_ON is set (WS09 step 19); a blank time reads as null. */
    needs_lca_approval: flagSchema.optional(),
    approval_requested_at: storedTimestampSchema.nullable().optional(),
    approved_at: storedTimestampSchema.nullable().optional(),
  })),
  places: z.array(clubPlaceSchema).optional(),
  /** What the person may do with the club's events, answered only while REGION_EVENTS_ON is set (WS09 step 19). */
  eventRights: clubEventRightsSchema.optional(),
  /**
   * The club's open suggestions (WS09 step 28), answered only while CLUB_KEEPERS_ON is set, only to a keeper of the
   * club (canManageClub), and only when at least one is open; never an address.
   */
  openSuggestions: z.array(openSuggestionSchema).optional(),
  /**
   * The club's open requests of Ask to be its named rep (WS09 step 31), answered only while CLUB_KEEPERS_ON is set,
   * only to a keeper who may decide them (an LCA admin, or a holder of the club's regional seat who is not the club's
   * own rep), and only when at least one is open.
   */
  repRequests: z.array(repRequestRowSchema).optional(),
})

/**
 * PATCH /api/admin/clubs/[id] (adminUpdateClub, and the club editor's
 * saveClubListing): the club as saved, and its places as saved when the
 * body carried `places`.
 */
export const updateClubResponseSchema = z.strictObject({ club: adminClubRowSchema, places: z.array(clubPlaceSchema).optional() })

/** PUT /api/admin/clubs/[id]/places: the club's places as saved. */
export const clubPlacesResponseSchema = z.strictObject({ places: z.array(clubPlaceSchema) })

/**
 * POST /api/admin/clubs/[id]/confirm, Still accurate: no field of its own.
 * The client sends `{}`; a key beside it passes through and is ignored, as
 * in every request schema, and changes nothing.
 */
export const clubConfirmRequestSchema = z.looseObject({})

/**
 * POST /api/admin/clubs/[id]/confirm: the club's new last check, stored in
 * UTC, and its words for the card ("Checked Nov 2026").
 */
export const clubConfirmResponseSchema = z.strictObject({
  id: idSchema,
  lastConfirmedAt: storedTimestampSchema,
  lastCheckWords: z.string(),
})

/**
 * One club's card in My region: the listing's name, town, region, colour,
 * logo address and statement (how the club meets, in its own words), the
 * last check (null for a club never checked) with its words and whether it
 * needs a check, the count of the club's events the person is shown, and
 * its open items: its open suggestions (WS09 step 28), the one kind there is.
 * No email of any kind, no roster and no member.
 */
export const regionClubSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  city: z.string(),
  region: z.string().nullable(),
  color: z.string().nullable(),
  logoUrl: z.string().nullable(),
  statement: z.string().nullable(),
  lastConfirmedAt: storedTimestampSchema.nullable(),
  lastCheckWords: z.string(),
  needsCheck: z.boolean(),
  events: z.number().int().nonnegative(),
  /** The club's open suggestions (WS09 step 28), the one kind of open item; never an address. */
  openItems: z.array(openSuggestionSchema),
  /** How many of the club's events wait in LCA review (marked, sent and not approved), answered only while REGION_EVENTS_ON is set (WS09 step 19). */
  inReview: z.number().int().nonnegative().optional(),
})

/** A region My region covers, and who else keeps it: the name and seat title of each other holder of an active seat over it. */
export const regionKeepersSchema = z.strictObject({
  region: z.string(),
  keepers: z.array(z.strictObject({ name: z.string(), seat: z.string() })),
})

/**
 * GET /api/workspace/region, My region's answer, for a holder of an active
 * regional seat and for an LCA admin: the cards in their order, This month
 * (the next check's day, its date with the weekday and its time, and how
 * many of the clubs were checked in the last 90 days and how many not), and
 * the regions with who else keeps them.
 */
export const workspaceRegionResponseSchema = z.strictObject({
  clubs: z.array(regionClubSchema),
  thisMonth: z.strictObject({
    nextCheck: z.strictObject({ day: isoDateSchema, date: z.string(), time: z.string() }),
    checked: z.number().int().nonnegative(),
    notChecked: z.number().int().nonnegative(),
    /** How many events of all the clubs wait in LCA review, answered only while REGION_EVENTS_ON is set (WS09 step 19). */
    inReview: z.number().int().nonnegative().optional(),
  }),
  regions: z.array(regionKeepersSchema),
  /**
   * The open rows of Suggest a club and Start a club (WS09 step 30) the person keeps: for a holder of a seat, those of
   * the regions the seat covers; for an LCA admin, every one, those with no region among them. Absent when there is
   * none, so the answer with none is as before.
   */
  clubRequests: z.array(clubRequestRowSchema).optional(),
  /**
   * The open requests of Ask to be its named rep (WS09 step 31) the person may decide: for a holder of a seat, those of
   * the clubs in the regions the seat covers; for an LCA admin, every one; never the person's own. Absent when there is
   * none, so the answer with none is as before.
   */
  repRequests: z.array(repRequestRowSchema).optional(),
})

/**
 * GET /api/clubs/confirm/[token], the page a Still accurate link in the
 * monthly check opens: the club the good link names, by its listing's name
 * and town, and how it meets in the listing's own public words (`statement`,
 * as one line, null when the listing has none), the same words the email
 * shows, so the person sees what they vouch for. Nothing else: no id, no
 * person and no address.
 */
export const clubLinkResponseSchema = z.strictObject({
  name: z.string(),
  city: z.string(),
  statement: z.string().nullable(),
})

/**
 * POST /api/clubs/confirm/[token], Still accurate by the link: no field of
 * its own. The page sends `{}`; a key beside it passes through and is
 * ignored, and changes nothing.
 */
export const clubLinkConfirmRequestSchema = z.looseObject({})

/**
 * POST /api/clubs/confirm/[token]: the club marked, by name and town, and
 * the month it is marked as checked for, in words ("November 2026").
 */
export const clubLinkConfirmResponseSchema = z.strictObject({
  name: z.string(),
  city: z.string(),
  month: z.string(),
})

/** The second action of POST /api/admin/clubs/monthly-check (WS09 step 29): the suggestions with no answer in 14 days. */
export const REPORT_CLOCK_ACTION = 'run_report_clock'

/**
 * POST /api/admin/clubs/monthly-check, the LCA admin's button: `send`
 * false asks only how many people the check goes to, for the button's one
 * question, and sends nothing; `send` true sends it to every one of them.
 *
 * With `action` set to run_report_clock (WS09 step 29) the same two ask
 * about the suggestions no one has answered in 14 days instead: `send`
 * false asks how many there are, and `send` true passes them on. With no
 * `action` the body is the monthly check's, as it always was, so every
 * request the endpoint took before parses as before.
 */
export const monthlyCheckRequestSchema = z.looseObject({
  send: z.boolean(),
  action: z.literal(REPORT_CLOCK_ACTION, 'Leave the action out for the monthly check, or name run_report_clock.').optional(),
})

/**
 * POST /api/admin/clubs/monthly-check: the month in words, how many people
 * the check goes to, and, once sent, how many emails went, how many did not
 * and how many people one press could not reach. Numbers only: no person.
 */
export const monthlyCheckResponseSchema = z.strictObject({
  month: z.string(),
  people: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  notSent: z.number().int().nonnegative(),
  notReached: z.number().int().nonnegative(),
})

/**
 * POST /api/admin/clubs/monthly-check with `action` run_report_clock (WS09
 * step 29): how many suggestions have had no answer in 14 days and not been
 * passed on, and, once sent, how many were passed on, how many emails went
 * and how many did not, and how many suggestions wait for the next run.
 * Numbers only: no person, no address and none of the visitor's words.
 */
export const reportClockResponseSchema = z.strictObject({
  due: z.number().int().nonnegative(),
  passedOn: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  notSent: z.number().int().nonnegative(),
  notReached: z.number().int().nonnegative(),
})

/** Every answer of POST /api/admin/clubs/monthly-check: the monthly check's, or the second action's. */
export const monthlyCheckAnswerSchema = z.union([monthlyCheckResponseSchema, reportClockResponseSchema])

export type ReportClockResponse = z.infer<typeof reportClockResponseSchema>
export type ClubLinkResponse = z.infer<typeof clubLinkResponseSchema>
export type ClubLinkConfirmResponse = z.infer<typeof clubLinkConfirmResponseSchema>
export type MonthlyCheckResponse = z.infer<typeof monthlyCheckResponseSchema>
export type UpdateClubRequest = z.infer<typeof updateClubRequestSchema>
export type ClubPlacesRequest = z.infer<typeof clubPlacesRequestSchema>
export type AdminClubResponse = z.infer<typeof adminClubResponseSchema>
export type ClubPlace = z.infer<typeof clubPlaceSchema>
export type ClubConfirmResponse = z.infer<typeof clubConfirmResponseSchema>
export type WorkspaceRegionResponse = z.infer<typeof workspaceRegionResponseSchema>
export type RegionClub = z.infer<typeof regionClubSchema>
export type ClubEventRights = z.infer<typeof clubEventRightsSchema>
