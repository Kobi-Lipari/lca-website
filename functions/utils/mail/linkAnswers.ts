// functions/utils/mail/linkAnswers.ts
//
// What the two endpoints a member's link opens share,
// functions/api/mail/unsubscribe/[token].ts and
// functions/api/mail/preferences/[token].ts: both are public, need no
// sign-in and read no cookie, and the person and the list come from the
// token alone. Every answer they give carries Cache-Control: no-store, and
// a link that does not open is answered in one way only, 404 with "This
// link isn't working.", whatever the reason: a token that is not one, a
// signature that does not verify, a missing key, a contact or a list that
// is not there, or links that are not live yet (listLinksLive in ./rules).
// A token, an address or a contact id is never written to a log line or
// to an answer's words.

import type { Env } from '../../types'
import { handleOptions, jsonResponse } from '../response'
import { readLink, type LinkPurpose } from './links'
import { listLinksLive } from './rules'

/** The words of every answer to a link that does not open. */
export const LINK_NOT_WORKING = "This link isn't working."

/** The header every answer of the two endpoints carries, so no copy of a person's choices is kept on the way. */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const

/** The answer as it is, with no-store set on it. */
export function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/** A JSON answer with no-store. */
export function linkAnswer(data: unknown, status = 200): Response {
  return jsonResponse(data, status, NO_STORE)
}

/** The one answer to a link that does not open. */
export function linkNotWorking(): Response {
  return linkAnswer({ error: LINK_NOT_WORKING }, 404)
}

/** The answer to a browser's check before a call from the page, with no-store like every other. */
export function linkOptions(): Response {
  return noStore(handleOptions())
}

/** The person a link names, as mail_contacts holds them. */
export interface LinkContact {
  id: string
  address: string
  optional_off_at: string | null
  complained_at: string | null
}

/** The token from the route, or '' when the route gave none or gave more than one segment. */
export function tokenOf(params: Record<string, string | string[]>): string {
  return typeof params.token === 'string' ? params.token : ''
}

/**
 * The contact a link opens, and for an unsubscribe link its list's id, or null for a link that does not open. The
 * token is read first, with no query, so a token that is not one costs no read of the database; then whether links are
 * live, then the contact.
 */
export async function openLink(env: Env, token: string, purpose: LinkPurpose): Promise<{ contact: LinkContact; listId?: string } | null> {
  const holder = await readLink({ current: env.MAIL_LINK_SECRET, previous: env.MAIL_LINK_SECRET_PREVIOUS }, token, purpose)
  if (!holder) return null
  if (!(await listLinksLive(env.DB))) return null
  const contact = await env.DB.prepare('SELECT id, address, optional_off_at, complained_at FROM mail_contacts WHERE id = ?')
    .bind(holder.contactId)
    .first<LinkContact>()
  return contact ? { contact, listId: holder.listId } : null
}
