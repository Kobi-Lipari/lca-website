// domain/contracts/clubPage.ts
//
// The contract of GET /api/clubs/[id]/page (getClubPage), the read behind
// the new club page (WS09 step 20). Strict, like every response here: a key
// the endpoint starts or stops sending fails its contract test until this
// file says so.
//
// The answer is built from named columns alone and carries no email address
// of any kind, no officer, no roster, no member's id, no count of members,
// no keeper's id or name, no told_by or confirmed_by, no stored stamp and
// none of the approval wait's columns. Who keeps the club is not answered at
// all (K's decision 12); the told line comes as words built on the server.
import { z } from 'zod'
import { idSchema, isoDateSchema } from './common'
import { registrationStatusSchema, tournamentStatusSchema } from './events'
import { CONTACT_GOES_TO } from '../clubs/contactMessage'
import { SUGGESTION_GOES_TO } from '../clubs/suggestion'

/** The sections a club page names, in its nav's order (domain/clubs/sections.ts). */
export const clubPageSectionSchema = z.enum(['about', 'when_and_where', 'events', 'news', 'photos', 'contact'])

/** A colour as the page draws it: a # and six hex digits. */
const pageColourSchema = z.string().regex(/^#[0-9a-f]{6}$/)

/** One of the club's listed events, by the keys a visitor's event answers already carry. */
export const clubPageEventSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  date: isoDateSchema,
  end_date: isoDateSchema.nullable(),
  status: tournamentStatusSchema,
  registration_status: registrationStatusSchema,
  max_players: z.number().int().min(0).nullable(),
  /** Entries neither withdrawn nor on the waitlist, as GET /api/clearinghouse counts them. */
  registered_count: z.number().int().min(0),
})

/** GET /api/clubs/[id]/page (getClubPage). */
export const clubPageResponseSchema = z.strictObject({
  club: z.strictObject({
    id: idSchema,
    /** The address part the page should show: the club's current slug, or its id while it has none. */
    slug: idSchema,
    name: z.string(),
    city: z.string(),
    region: z.string().nullable(),
    /** The club's own colour, or navy when it has none or still has the default gold. */
    color: pageColourSchema,
    /** The logo's path on this site, or null. */
    logo: z.string().nullable(),
  }),
  sections: z.array(clubPageSectionSchema),
  about: z.strictObject({
    text: z.string().nullable(),
    cost: z.string().nullable(),
    welcome: z.string().nullable(),
    facebook: z.string().nullable(),
    website: z.string().nullable(),
    other: z.string().nullable(),
    weekend_play: z.boolean(),
    scholastic_friendly: z.boolean(),
  }),
  statement: z.strictObject({
    text: z.string().nullable(),
    /** "Last checked November 2026", the month of the later of the last save and the last Still accurate; empty for no line. */
    told: z.string(),
  }),
  places: z.array(z.strictObject({
    name: z.string(),
    street: z.string().nullable(),
    /** The club's note for first-timers. */
    note: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  })).max(2),
  /**
   * The contact name the club chose to show; its email is never answered. goes_to says where a message from the
   * page's Contact form goes (WS09 step 26), as one word of a closed list: the club's own address, the region's
   * representative, or LCA. It never names a person, an address, how many people, or whether an address works.
   */
  contact: z.strictObject({ name: z.string().nullable(), goes_to: z.enum(CONTACT_GOES_TO) }),
  /**
   * Where a suggestion from Suggest an update goes (WS09 step 28): the club's rep, the region's representative or LCA,
   * as one word, never who and never an address.
   */
  suggestion: z.strictObject({ goes_to: z.enum(SUGGESTION_GOES_TO) }),
  events: z.array(clubPageEventSchema),
  news: z.array(z.strictObject({
    id: idSchema,
    title: z.string(),
    excerpt: z.string(),
    news_date: z.string(),
  })),
  nearest: z.array(z.strictObject({
    name: z.string(),
    city: z.string(),
    slug: idSchema,
    statement: z.string().nullable(),
    /** "about 12 mi", or "less than 1 mi". */
    distance: z.string(),
  })).max(3),
})

export type ClubPageEvent = z.infer<typeof clubPageEventSchema>
export type ClubPageResponse = z.infer<typeof clubPageResponseSchema>
