// domain/contracts/clubs.ts
// Contracts for the club endpoints.
//
// Response schemas are strict, like the tournament ones: a field the
// endpoint starts or stops sending fails its contract test until the
// schema says so.
import { z } from 'zod'
import { dollarsSchema, idSchema, isoDateSchema, storedTimestampSchema } from './common'
import { savedSectionSchema, tournamentStatusSchema } from './events'

/** Every column of clubs, as SELECT * returns it. */
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

/** GET /api/clubs/[id] (getClub). Public; hidden drafts are left out. */
export const clubDetailResponseSchema = z.strictObject({
  club: clubRowSchema,
  officers: z.array(z.strictObject({
    id: idSchema,
    role: z.string(),
    full_name: z.string(),
    email: z.string(),
  })),
  tournaments: z.array(clubTournamentSchema),
  news: z.array(z.strictObject({
    id: idSchema,
    title: z.string(),
    excerpt: z.string(),
    news_date: z.string(),
  })),
})

export type ClubDetailResponse = z.infer<typeof clubDetailResponseSchema>
