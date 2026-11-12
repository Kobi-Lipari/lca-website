// domain/contracts/mail.ts
// The contracts of the two public endpoints a link in optional email opens
// (WS16 step 3), both signed, needing no sign-in, the person and the list
// coming from the token alone:
// - GET /api/mail/unsubscribe/:token, the list's name for the page that
//   asks for JSON (a plain GET answers 303 to the page and has no body),
//   and POST, the one-click unsubscribe, which takes any body;
// - GET and PATCH /api/mail/preferences/:token, the person's lists, each
//   on or off, and their own "Stop all optional email from LCA".
// And of the LCA newsletter's four admin methods (WS16 step 4), behind
// requireListMailer:
// - GET and POST /api/admin/mail/newsletter, the list with its counts and
//   recent sends, and the send;
// - POST /api/admin/mail/newsletter/test, a test send to one address;
// - POST /api/admin/mail/newsletter/stop, the stop.
//
// Response schemas are strict, like the other contracts. The requests are
// loose, as every request schema is, so a key a page sends beside the ones
// named here passes through and is ignored.
import { z } from 'zod'
import { storedTimestampSchema } from './common'

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

/** A count of addresses. */
const countSchema = z.number().int().nonnegative()

/** One newsletter send in the newsletter's own history, newest first. */
const newsletterSendSchema = z.strictObject({
  id: z.string(),
  subject: z.string(),
  totalRecipients: countSchema,
  sentCount: countSchema,
  failedCount: countSchema,
  /** Taken out at the send, by the do-not-send gate or a choice made after the send began; never sent. */
  skippedCount: countSchema,
  /** migration 0021's CHECK: a stopped send is closed as completed, or failed when nothing went. */
  status: z.enum(['sending', 'completed', 'failed']),
  createdAt: storedTimestampSchema,
  completedAt: storedTimestampSchema.nullable(),
})

/**
 * GET /api/admin/mail/newsletter: the list, its From line ("Louisiana Chess Association <newsletter@...>"), the
 * service that sends now ('resend' until the cutover, while the newsletter waits for Amazon SES), and the summary: every
 * address in the audience, those who turned it off, stopped all optional mail or no longer receive mail (which may
 * overlap), those who will get the next send, the last 10 sends, and why the newsletter that is sending waits (WS16
 * step 5): the words on its next untried row, or null when none is sending or that row holds none.
 */
export const newsletterSummaryResponseSchema = z.strictObject({
  list: z.strictObject({ id: z.string(), name: z.string() }),
  from: z.string(),
  sendsThrough: z.string(),
  summary: z.strictObject({
    addresses: countSchema,
    turnedOff: countSchema,
    stoppedAll: countSchema,
    doNotSend: countSchema,
    willGet: countSchema,
    recent: z.array(newsletterSendSchema),
    waits: z.string().nullable(),
  }),
})

/** A newsletter's subject, 1 to 200 characters once trimmed, and its message as HTML, 1 to 100,000 characters with some writing in it. */
const subjectSchema = z.string({ error: 'Add a subject.' }).trim().min(1, 'Add a subject.').max(200, 'Keep the subject to 200 characters.')
const bodyHtmlSchema = z
  .string({ error: 'Add the message.' })
  .min(1, 'Add the message.')
  .max(100_000, 'Keep the message to 100,000 characters.')
  .refine((html) => html.trim() !== '', 'Add the message.')

/** POST /api/admin/mail/newsletter's body: the subject and the message. */
export const newsletterRequestSchema = z.looseObject({
  subject: subjectSchema,
  bodyHtml: bodyHtmlSchema,
})

/** POST /api/admin/mail/newsletter's 201: the send made, as Group email's POST answers one. */
export const newsletterResponseSchema = z.strictObject({
  campaignId: z.string(),
  totalRecipients: countSchema,
  status: z.literal('sending'),
})

/**
 * POST /api/admin/mail/newsletter/test's body: the one address the test goes to, the newsletter as written, and, since
 * WS16 step 7, service: 'ses' for a test through Amazon SES whatever service sends now, which an LCA admin alone may ask
 * for; the endpoint reads the role from the session, never from the body.
 */
export const newsletterTestRequestSchema = z.looseObject({
  to: z
    .string({ error: 'Add the address the test goes to.' })
    .trim()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Add the address the test goes to.'),
  subject: subjectSchema,
  bodyHtml: bodyHtmlSchema,
  service: z.literal('ses', { error: 'Ask for Amazon SES, or leave the service out.' }).optional(),
})

/** POST /api/admin/mail/newsletter/test's answer: the test went to the mail service. */
export const newsletterTestResponseSchema = z.strictObject({ sent: z.literal(true) })

/** POST /api/admin/mail/newsletter/stop's answer: how many addresses the stop kept the newsletter from. */
export const newsletterStopResponseSchema = z.strictObject({ stopped: countSchema })

export type UnsubscribeResponse = z.infer<typeof unsubscribeResponseSchema>
export type UnsubscribeLinkResponse = z.infer<typeof unsubscribeLinkResponseSchema>
export type EmailChoicesResponse = z.infer<typeof emailChoicesResponseSchema>
export type EmailChoicesRequest = z.infer<typeof emailChoicesRequestSchema>
export type NewsletterSummaryResponse = z.infer<typeof newsletterSummaryResponseSchema>
export type NewsletterRequest = z.infer<typeof newsletterRequestSchema>
export type NewsletterResponse = z.infer<typeof newsletterResponseSchema>
export type NewsletterTestRequest = z.infer<typeof newsletterTestRequestSchema>
export type NewsletterTestResponse = z.infer<typeof newsletterTestResponseSchema>
export type NewsletterStopResponse = z.infer<typeof newsletterStopResponseSchema>
