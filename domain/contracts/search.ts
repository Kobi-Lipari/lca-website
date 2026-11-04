// domain/contracts/search.ts
// The contract of GET /api/search (WS02 step 9): the query it reads and the
// answer it gives, brief 1.4's SearchResponse field for field.
//
// The answer holds the search as normalised and up to five groups in the
// brief's order, each with one to five rows and twenty rows in all. It is the
// same signed in and out, and holds no member, no registration, no email and
// no player's name. The query is read as the text typed, as every query
// string is; the endpoint applies its bounds itself, 2 to 64 letters or
// numbers once normalised, since this schema sees the text before that.
//
// Response schemas are strict, like the other contracts: a field the
// endpoint starts or stops sending fails its contract test until the schema
// says so.
import { z } from 'zod'

/** GET /api/search's query string: the search, as typed. */
export const searchQuerySchema = z.looseObject({
  q: z.string(),
})

/** A row's tag: its state in words, and the tone its badge is drawn in. */
export const searchTagSchema = z.strictObject({
  label: z.string().min(1),
  tone: z.enum(['open', 'soon', 'closed', 'partner', 'lca', 'final']),
})

/**
 * One row of a group: its id, unique in the answer; the words it shows; and
 * where it goes. `external` marks an address that leaves the site, as a
 * partner event's organizer's page does.
 */
export const searchItemSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  meta: z.string().optional(),
  href: z.string().min(1),
  tag: searchTagSchema.optional(),
  external: z.boolean().optional(),
})

/** One group of rows, named for the panel's heading. */
export const searchGroupSchema = z.strictObject({
  type: z.enum(['tournaments', 'clubs', 'news', 'results', 'champions']),
  label: z.string().min(1),
  items: z.array(searchItemSchema).min(1).max(5),
})

/** GET /api/search: the search as normalised, and the groups that hold a match, in the brief's order. */
export const searchResponseSchema = z.strictObject({
  q: z.string(),
  groups: z.array(searchGroupSchema).max(5),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>
export type SearchTag = z.infer<typeof searchTagSchema>
export type SearchItem = z.infer<typeof searchItemSchema>
export type SearchGroup = z.infer<typeof searchGroupSchema>
export type SearchResponse = z.infer<typeof searchResponseSchema>
