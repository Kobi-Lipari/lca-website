// domain/contracts/newsletter.ts
// The contracts of the newsletter's own page (WS16 part two, page step 3):
// its four methods, behind requireListMailer, each answering 404
// { error: 'Not found' } while MAIL_PAGE_ON is unset:
// - GET /api/admin/mail/newsletter/issue, the LCA newsletter's open letter,
//   with who wrote to it last and when;
// - PUT /api/admin/mail/newsletter/issue, a save of that letter, cleaned
//   and held to the version the page read, and the 409 that refuses an old
//   version, or a letter sent or set aside meanwhile, with who and when;
// - POST /api/admin/mail/newsletter/issue/start, a new letter from a blank
//   one, one of LCA's starters, a past letter or a newsletter sent from the
//   plain tab, setting the open letter aside when it holds words;
// - GET /api/admin/mail/newsletter/issues, the last letters and sends,
//   without their words.
// The newsletter tab's own contracts are in ./mail.ts, and these are not
// among them, since the page and the tab are switched apart.
//
// Response schemas are strict, like the other contracts. The requests are
// loose, as every request schema is, so a key a page sends beside the ones
// named here passes through and is ignored; a new letter's source that
// names both a past letter and a send is refused rather than read as one.
import { z } from 'zod'
import { STARTER_IDS } from '../mail/letter'
import { idSchema, storedTimestampSchema } from './common'

/** The most characters a letter's month, subject and inbox preview line keep once trimmed. The subject's is the newsletter tab's. */
export const MONTH_LABEL_MAX = 40
export const SUBJECT_MAX = 200
export const PREHEADER_MAX = 150

/**
 * The most characters an id a request names may hold. A letter's id is 32 hex characters, and a send's is "campaign-"
 * and the time in base 36, 17 characters, as every send has been made; so an id of megabytes never reaches the database.
 */
export const REQUEST_ID_MAX = 64

/**
 * An id a request names, the letter a save read or the past letter or send a start copies from: idSchema held to
 * REQUEST_ID_MAX. Both checks abort, so an empty id and an id over the bound are answered in the field's own words,
 * as a number is.
 */
const requestIdSchema = idSchema.min(1, { abort: true }).max(REQUEST_ID_MAX, { abort: true })

/**
 * Whether a text holds a line break or any other control character: every one below a space, delete, those from
 * U+0080 to U+009F, and the line and paragraph separators; or one of the nine characters that force the direction or
 * the order in which what follows is drawn, U+202A to U+202E and U+2066 to U+2069, which can make a subject read
 * reversed in an inbox. The subject becomes an email's header and the layout writes all three fields, so none of them
 * may hold one. Kept on purpose: the zero width joiner and non-joiner and the variation selector U+FE0F, which emoji of
 * several parts need; the left-to-right, right-to-left and Arabic letter marks, which right-to-left text needs and
 * which force nothing; the zero width space; and the soft hyphen.
 */
function holdsControl(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) return true
    if ((code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) return true
  }
  return false
}

/** A letter's plain field: words, trimmed, held to its length and to one line; empty while the letter is written. */
const plainField = (name: string, max: number) =>
  z
    .string({ error: `Write the ${name} as words.` })
    .trim()
    .max(max, `Keep the ${name} to ${max} characters.`)
    .refine((text) => !holdsControl(text), `Write the ${name} on one line, with no line break, tab or other hidden character.`)

const monthLabelSchema = plainField('month', MONTH_LABEL_MAX)
const subjectSchema = plainField('subject', SUBJECT_MAX)
const preheaderSchema = plainField('inbox preview line', PREHEADER_MAX)

/** A version as the server counts it: 1 when a letter is made, one more at each write. */
const versionSchema = z.number().int().positive()

/** The words for a save's version that is not a whole number from 0, the 0 a page sends with no letter read. */
const VERSION_WORDS = 'Give the version of the letter you read.'

/** One letter as the server keeps it: its words are the cleaner's own, and its times are the database's. */
export const newsletterLetterSchema = z.strictObject({
  id: idSchema,
  version: versionSchema,
  monthLabel: z.string(),
  subject: z.string(),
  preheader: z.string(),
  bodyHtml: z.string(),
  createdAt: storedTimestampSchema,
  updatedAt: storedTimestampSchema,
})

/**
 * GET /api/admin/mail/newsletter/issue, and POST .../issue/start's 201: the open letter, or null when there is none;
 * its state in a word, 'draft' for an open letter and 'none' without one; and the name of the person who wrote to it
 * last and when, the name read from their account at each read, null once that account is gone.
 */
export const newsletterIssueResponseSchema = z.strictObject({
  issue: newsletterLetterSchema.nullable(),
  state: z.enum(['none', 'draft']),
  lastSavedBy: z.string().nullable(),
  lastSavedAt: storedTimestampSchema.nullable(),
})

/**
 * PUT /api/admin/mail/newsletter/issue's body: the letter the page read, by its id and version, or id null for the
 * first save when the page read no letter; the three plain fields; and the letter as the page holds it, which the
 * server cleans before it stores anything.
 */
export const newsletterIssueSaveRequestSchema = z.looseObject({
  id: z.union([requestIdSchema, z.null()], { error: 'Name the letter you read, or none for a new one.' }),
  version: z.number({ error: VERSION_WORDS }).int(VERSION_WORDS).min(0, VERSION_WORDS),
  monthLabel: monthLabelSchema,
  subject: subjectSchema,
  preheader: preheaderSchema,
  bodyHtml: z.string({ error: 'Add the letter as HTML.' }),
})

/**
 * PUT /api/admin/mail/newsletter/issue's 200: the letter's id and its new version, when it was saved, and the stored
 * letter when the cleaner changed what the page sent, so the page can show what is kept; null when it is what was sent.
 */
export const newsletterIssueSavedResponseSchema = z.strictObject({
  id: idSchema,
  version: versionSchema,
  savedAt: storedTimestampSchema,
  bodyHtml: z.string().nullable(),
})

/**
 * PUT /api/admin/mail/newsletter/issue's 409, a save that wrote nothing, and POST .../issue/start's, a start that wrote
 * nothing: why, 'changed' when someone wrote to the letter after the page read it (two first saves at once among them),
 * 'sent' or 'set_aside' when it was sent or a new letter took its place meanwhile; who did it, by name, null once their
 * account is gone; and when. The words the page sent stay on the page; nothing of them is in the answer.
 */
export const newsletterIssueRefusedSchema = z.strictObject({
  error: z.string(),
  reason: z.enum(['changed', 'sent', 'set_aside']),
  changedBy: z.string().nullable(),
  changedAt: storedTimestampSchema,
})

const CHOOSE_WORDS = 'Choose a blank letter, a starter, a past letter or a past newsletter.'

/** Where a new letter's words come from: a blank letter or one of LCA's starters by its id, a past letter of the list, or a send on the list. */
const startFromSchema = z
  .union([z.enum(STARTER_IDS), z.looseObject({ issueId: requestIdSchema }), z.looseObject({ campaignId: requestIdSchema })], { error: CHOOSE_WORDS })
  .refine((from) => typeof from === 'string' || !('issueId' in from && 'campaignId' in from), CHOOSE_WORDS)

/** POST /api/admin/mail/newsletter/issue/start's body: where the words come from, and the month the new letter is for. */
export const newsletterIssueStartRequestSchema = z.looseObject({
  from: startFromSchema,
  monthLabel: monthLabelSchema,
})

/**
 * One of the last newsletters, without its words: a letter sent or set aside, by its id and its send's, or a send on
 * the list that has no letter, by its send's alone. Its month ('' for a send with no letter), its subject, its state in
 * a word (a send's own status, or 'set_aside'), when (the send, or the setting aside), who by, as the open letter
 * names a person, and how many it went to, as the newsletter tab counts a send; null for a letter never sent.
 */
export const lastNewsletterSchema = z.strictObject({
  issueId: idSchema.nullable(),
  campaignId: idSchema.nullable(),
  monthLabel: z.string(),
  subject: z.string(),
  state: z.enum(['sending', 'completed', 'failed', 'set_aside']),
  at: storedTimestampSchema,
  by: z.string().nullable(),
  totalRecipients: z.number().int().nonnegative().nullable(),
})

/** GET /api/admin/mail/newsletter/issues: the last 20 at most, newest first. */
export const newsletterIssuesResponseSchema = z.strictObject({
  issues: z.array(lastNewsletterSchema).max(20),
})

export type NewsletterLetter = z.infer<typeof newsletterLetterSchema>
export type NewsletterIssueResponse = z.infer<typeof newsletterIssueResponseSchema>
export type NewsletterIssueSaveRequest = z.infer<typeof newsletterIssueSaveRequestSchema>
export type NewsletterIssueSavedResponse = z.infer<typeof newsletterIssueSavedResponseSchema>
export type NewsletterIssueRefused = z.infer<typeof newsletterIssueRefusedSchema>
export type NewsletterIssueStartRequest = z.infer<typeof newsletterIssueStartRequestSchema>
export type LastNewsletter = z.infer<typeof lastNewsletterSchema>
export type NewsletterIssuesResponse = z.infer<typeof newsletterIssuesResponseSchema>
