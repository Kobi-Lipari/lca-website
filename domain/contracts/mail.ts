// domain/contracts/mail.ts
// The contracts of the two public endpoints a link in optional email opens
// (WS16 step 3), both signed, needing no sign-in, the person and the list
// coming from the token alone:
// - GET /api/mail/unsubscribe/:token, the list's name for the page that
//   asks for JSON (a plain GET answers 303 to the page and has no body),
//   and POST, the one-click unsubscribe, which takes any body;
// - GET and PATCH /api/mail/preferences/:token, the person's lists, each
//   on or off, and their own "Stop all optional email from LCA".
//
// Response schemas are strict, like the other contracts. The request is
// loose, as every request schema is, so a key a page sends beside the two
// named here passes through and is ignored.
import { z } from 'zod'

/** POST /api/mail/unsubscribe/:token: done, the list's name, and a fresh preferences token the page links on with. */
export const unsubscribeResponseSchema = z.strictObject({
  unsubscribed: z.literal(true),
  list: z.string(),
  preferencesToken: z.string(),
})

/** GET /api/mail/unsubscribe/:token asked for JSON: the list's name, which the page shows before the button. */
export const unsubscribeLinkResponseSchema = z.strictObject({
  list: z.string(),
})

/**
 * GET and PATCH /api/mail/preferences/:token: the address, masked ("k...@example.org"); each list the person is on,
 * by its id and its name, on or off; and whether they stopped all optional email from LCA.
 */
export const emailChoicesResponseSchema = z.strictObject({
  address: z.string(),
  lists: z.array(z.strictObject({ id: z.string(), name: z.string(), on: z.boolean() })),
  optionalOff: z.boolean(),
})

/** PATCH /api/mail/preferences/:token's body: lists turned on or off, by id, and the stop-all choice; each optional. */
export const emailChoicesRequestSchema = z.looseObject({
  lists: z.record(z.string(), z.boolean()).optional(),
  optionalOff: z.boolean().optional(),
})

export type UnsubscribeResponse = z.infer<typeof unsubscribeResponseSchema>
export type UnsubscribeLinkResponse = z.infer<typeof unsubscribeLinkResponseSchema>
export type EmailChoicesResponse = z.infer<typeof emailChoicesResponseSchema>
export type EmailChoicesRequest = z.infer<typeof emailChoicesRequestSchema>
