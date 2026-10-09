// domain/contracts/registration.ts
// Contracts for a player's own entries: entering one player, entering a
// family in one checkout, and changing an entry afterwards; and for the
// entries a director makes from the manage page: a walk-in at the door and
// a spot offered to a player on the waitlist.
//
// Request schemas are loose (unknown keys pass through) and name the bodies
// createRegistration, createBatchRegistration, updateRegistration,
// adminAddWalkIn and offerWaitlistSpot in src/lib/api.ts send. Response schemas are strict: when a migration adds a
// column to registrations (the single entry and the edit answer with every
// column), add it here in the same change.
import { z } from 'zod'
import { dollarsSchema, idSchema, storedTimestampSchema } from './common'

/** The CHECK on registrations.payment_status. */
export const registrationPaymentStatusSchema = z.enum(['pending', 'paid', 'refunded'])

/**
 * Every column of registrations, as SELECT * returns it. bye_rounds is the
 * stored JSON text here; the edit answer parses it (registrationEditSchema).
 * withdrawn_at and checked_in_at are written by the handlers as ISO
 * timestamps, registered_at and waitlisted_at by SQLite's datetime('now').
 */
export const registrationRowSchema = z.strictObject({
  id: idSchema,
  tournament_id: idSchema,
  member_id: idSchema,
  section: z.string(),
  payment_status: registrationPaymentStatusSchema,
  registered_at: storedTimestampSchema,
  bye_rounds: z.string().nullable(),
  withdrawn_at: z.string().nullable(),
  checked_in_at: z.string().nullable(),
  rating_at_entry: z.number().int().nullable(),
  /** The grade range the player confirmed, "min-max" with K = 0; never a grade. */
  grade: z.string().nullable(),
  waitlisted_at: storedTimestampSchema.nullable(),
  section_id: idSchema.nullable(),
  schedule_id: idSchema.nullable(),
})

/** Rounds a player asks to sit out, numbered from 1. The handlers check them against the event. */
const byeRoundsSchema = z.array(z.number())

/** "min-max" with K = 0, e.g. "0-8" for "8th grade or below". The player ticks a box; no grade is asked. */
const gradeRangeSchema = z.string().nullable()

/** POST /api/registrations (createRegistration). */
export const createRegistrationRequestSchema = z.looseObject({
  tournamentId: z.string({ error: 'Choose a tournament.' }).min(1, 'Choose a tournament.'),
  section: z.string({ error: 'Choose a section.' }).min(1, 'Choose a section.'),
  byeRounds: byeRoundsSchema.optional(),
  gradeRange: gradeRangeSchema.optional(),
  /** Join the waitlist when the event is full. */
  waitlist: z.boolean().optional(),
})

/** The entry's payment row: completed at no charge, or pending until Stripe reports payment. */
const entryPaymentSchema = z.strictObject({
  id: idSchema,
  amount: dollarsSchema,
  status: z.enum(['completed', 'pending']),
})

/** An entry taken: free (no paymentUrl) or waiting for payment at paymentUrl. */
export const registrationEnteredSchema = z.strictObject({
  registration: registrationRowSchema,
  payment: entryPaymentSchema,
  paymentUrl: z.string().nullable(),
  /** Heads-ups that do not block the entry, such as a US Chess membership that runs out first. */
  warnings: z.array(z.string()),
  message: z.string(),
})

/** A place on the waitlist of a full event. Nothing is charged until the director offers a spot. */
export const registrationWaitlistedSchema = z.strictObject({
  registration: z.strictObject({ id: idSchema, waitlisted: z.literal(true) }),
  paymentUrl: z.null(),
  message: z.string(),
})

export const createRegistrationResponseSchema = z.union([registrationEnteredSchema, registrationWaitlistedSchema])

/** The 400 when the event is full and the player did not ask for the waitlist. */
export const registrationFullBodySchema = z.strictObject({
  error: z.string(),
  full: z.literal(true),
})

/** One player in a family entry. Without memberId it is the signed-in member. */
const batchEntryRequestSchema = z.looseObject({
  memberId: z.string().optional(),
  section: z.string().optional(),
  byeRounds: byeRoundsSchema.optional(),
  gradeRange: gradeRangeSchema.optional(),
})

/**
 * POST /api/registrations/batch (createBatchRegistration). The handler
 * answers an empty list, and more than nine players, in its own words.
 */
export const batchRegistrationRequestSchema = z.looseObject({
  tournamentId: z.string({ error: 'Choose a tournament.' }).min(1, 'Choose a tournament.'),
  entries: z.array(batchEntryRequestSchema, { error: 'Choose at least one player.' }),
})

export const batchRegistrationResponseSchema = z.strictObject({
  registrations: z.array(z.strictObject({
    id: idSchema,
    memberId: idSchema,
    section: z.string(),
    amount: dollarsSchema,
    paymentStatus: z.enum(['pending', 'paid']),
  })),
  /** The sum of the paid entries, charged in one checkout. */
  total: dollarsSchema,
  paymentUrl: z.string().nullable(),
  message: z.string(),
})

/**
 * PATCH /api/registrations/[id] (updateRegistration). The handler answers
 * a body with none of these keys, and a byeRounds list that is not whole
 * round numbers, in its own words.
 */
export const updateRegistrationRequestSchema = z.looseObject({
  byeRounds: byeRoundsSchema.optional(),
  section: z.string().optional(),
  paymentStatus: registrationPaymentStatusSchema.optional(),
  withdrawn: z.boolean().optional(),
  checkedIn: z.boolean().optional(),
})

/** An entry as the edit answers it: every column, with bye_rounds parsed. */
export const registrationEditSchema = registrationRowSchema.extend({
  bye_rounds: z.array(z.number()),
})

export const updateRegistrationResponseSchema = z.strictObject({
  registration: registrationEditSchema,
  /** Set when a section change altered the fee but the payment had already been made. */
  feeNote: z.string().nullable(),
})

/**
 * POST /api/admin/tournaments/[id]/walk-ins (adminAddWalkIn). The section
 * is a live section's name, matched exactly as typed. A rated event also
 * needs uscfId; the handler says so in its own words.
 */
export const walkInRequestSchema = z.looseObject({
  fullName: z.string({ error: "Enter the player's name." }).trim().min(1, "Enter the player's name."),
  uscfId: z.string({ error: 'Enter a US Chess ID, or leave it blank.' }).nullable().optional(),
  uscfRating: z.number({ error: 'Enter the rating as a number, or leave it blank.' }).nullable().optional(),
  section: z.string({ error: 'Choose a section.' }).min(1, 'Choose a section.'),
  /** Paid at the door (the default) or still owed. */
  markPaid: z.boolean({ error: 'Say whether the entry fee was paid.' }).optional(),
})

/** The walk-in's entry, every column, and the guest record made for the player. */
export const walkInResponseSchema = z.strictObject({
  registration: registrationRowSchema,
  guestId: idSchema,
})

/** POST /api/admin/tournaments/[id]/waitlist (offerWaitlistSpot). */
export const waitlistOfferRequestSchema = z.looseObject({
  registrationId: z.string({ error: 'Choose a player on the waitlist.' }).min(1, 'Choose a player on the waitlist.'),
})

/** The spot is offered; amount is what the player owes, 0 when the entry is free and confirmed at once. */
export const waitlistOfferResponseSchema = z.strictObject({
  success: z.literal(true),
  amount: dollarsSchema,
})

export type RegistrationRow = z.infer<typeof registrationRowSchema>
export type CreateRegistrationRequest = z.infer<typeof createRegistrationRequestSchema>
export type CreateRegistrationResponse = z.infer<typeof createRegistrationResponseSchema>
export type BatchRegistrationRequest = z.infer<typeof batchRegistrationRequestSchema>
export type BatchRegistrationResponse = z.infer<typeof batchRegistrationResponseSchema>
export type UpdateRegistrationRequest = z.infer<typeof updateRegistrationRequestSchema>
export type UpdateRegistrationResponse = z.infer<typeof updateRegistrationResponseSchema>
export type WalkInRequest = z.infer<typeof walkInRequestSchema>
export type WalkInResponse = z.infer<typeof walkInResponseSchema>
export type WaitlistOfferRequest = z.infer<typeof waitlistOfferRequestSchema>
export type WaitlistOfferResponse = z.infer<typeof waitlistOfferResponseSchema>
