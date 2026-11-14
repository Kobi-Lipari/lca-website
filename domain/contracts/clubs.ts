// domain/contracts/clubs.ts
// Contracts for the club endpoints.
//
// Response schemas are strict, like the tournament ones: a field the
// endpoint starts or stops sending fails its contract test until the
// schema says so.
import { z } from 'zod'
import { dollarsSchema, idSchema, isoDateSchema, storedTimestampSchema } from './common'
import { savedSectionSchema, tournamentStatusSchema } from './events'

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

/** GET /api/clubs (getClubs). Public; every club, whoever asks. */
export const clubListResponseSchema = z.strictObject({
  clubs: z.array(clubListItemSchema),
})

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
export type ClubDetailResponse = z.infer<typeof clubDetailResponseSchema>
