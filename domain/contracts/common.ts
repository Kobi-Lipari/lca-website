// domain/contracts/common.ts
// Building blocks the per-area contracts share: ids, dates, money, the
// 0-or-1 flags SQLite stores booleans as, and the error bodies every
// endpoint answers with.
//
// zod is allowed only inside domain/contracts. The rest of domain/ is
// imported by the browser at runtime and must not bring zod into the site
// bundle; the site takes types from here with `import type` only.
import { z } from 'zod'

/** A row id. Ids are text in every table (UUIDs, or prefixed ids in older rows). */
export const idSchema = z.string().min(1)

/** A calendar day as stored in the database: "2026-10-24". */
export const isoDateSchema = z.iso.date()

/**
 * A timestamp written by SQLite's datetime('now'): "2026-10-08 14:05:00",
 * in UTC. Read it with formatDate(..., { stored: 'utc' }).
 */
export const storedTimestampSchema = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)

/** Money in whole dollars and cents as a decimal (25, 12.5), never Stripe's integer cents. */
export const dollarsSchema = z.number().min(0)

/** A boolean column: SQLite stores 1 for yes and 0 for no. */
export const flagSchema = z.union([z.literal(0), z.literal(1)])

/** Every error an endpoint returns: errorResponse(message, status) in functions/utils/response.ts. */
export const errorBodySchema = z.strictObject({ error: z.string() })

/**
 * The 400 parseBody returns when a request body does not match its
 * contract: the usual { error } plus one plain message per field, keyed by
 * the field's path ("sections.0.entryFee"). "body" stands for the whole body.
 */
export const fieldErrorBodySchema = z.strictObject({
  error: z.string(),
  fields: z.record(z.string(), z.string()),
})

export type ErrorBody = z.infer<typeof errorBodySchema>
export type FieldErrorBody = z.infer<typeof fieldErrorBodySchema>
