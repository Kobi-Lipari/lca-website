// functions/api/mail/unsubscribe/[token].ts
//
// GET and POST /api/mail/unsubscribe/:token: the address the
// List-Unsubscribe header of every optional email names, and the endpoint
// the unsubscribe page's one button calls (WS16 step 5). Public, signed,
// with no sign-in and no cookie: the person and the list come from the
// token alone (functions/utils/mail/links.ts). Its contracts are in
// domain/contracts/mail.ts.
//
// - POST is the one-click unsubscribe of RFC 8058, which a mail program
//   sends with a multipart or urlencoded body carrying
//   List-Unsubscribe=One-Click, and the page sends with an empty JSON one.
//   It takes any body without reading it, writes the person's 'out' on that
//   one list in one statement and answers 200, never a redirect; a second
//   POST changes nothing and answers the same.
// - GET changes nothing, so a mail scanner that opens the link unsubscribes
//   no one. A GET that asks for JSON (the page's own) answers the list's
//   name; any other, which is what a mail program sends when it opens the
//   header's address in a browser (RFC 8058 section 3.2 has the GET and the
//   POST share it), answers 303 to the unsubscribe page, so the person lands
//   on the page with the button.
//
// Every answer is 404 "This link isn't working." unless the links are live
// (MAIL_LISTS_ON, or a list email on record) and the token verifies, for
// this purpose, for a contact and a list that exist. Every answer carries
// Cache-Control: no-store.
import type { Env } from '../../../types'
import { linkAnswer, linkNotWorking, linkOptions, openLink, tokenOf } from '../../../utils/mail/linkAnswers'
import { signLink } from '../../../utils/mail/links'
import { resolveSiteUrl } from '../../../utils/site'
import type { UnsubscribeLinkResponse, UnsubscribeResponse } from '../../../../domain/contracts/mail'
import type { Choice, ChoiceSource } from '../../../../domain/mail/lists'

/** The values the choice is written with, typed by domain/mail/lists.ts, since no CHECK holds them in the table. */
const OUT: Choice = 'out'
const FROM_LINK: ChoiceSource = 'link'

/** The list a verified link leaves, with its name, or null when no such list exists. */
async function listNamed(db: D1Database, listId: string): Promise<{ id: string; name: string } | null> {
  return db.prepare('SELECT id, name FROM mail_lists WHERE id = ?').bind(listId).first<{ id: string; name: string }>()
}

/** True when the request asks for JSON, as the unsubscribe page's own check does. */
function wantsJson(request: Request): boolean {
  return /application\/json/i.test(request.headers.get('Accept') ?? '')
}

export const onRequestOptions: PagesFunction<Env> = async () => linkOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const token = tokenOf(context.params)
  const opened = await openLink(context.env, token, 'unsubscribe')
  const list = opened?.listId ? await listNamed(context.env.DB, opened.listId) : null
  if (!opened || !list) return linkNotWorking()
  if (wantsJson(context.request)) {
    const body: UnsubscribeLinkResponse = { list: list.name }
    return linkAnswer(body)
  }
  // The configured site, never the request's host, so the person lands on the canonical page.
  const page = `${resolveSiteUrl(context.env)}/email/unsubscribe/${encodeURIComponent(token)}`
  return new Response(null, { status: 303, headers: { Location: page, 'Cache-Control': 'no-store' } })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const opened = await openLink(context.env, tokenOf(context.params), 'unsubscribe')
  const list = opened?.listId ? await listNamed(context.env.DB, opened.listId) : null
  if (!opened || !list) return linkNotWorking()
  // One statement: the person's 'out' on this list, and nothing if it is already out, so a second press changes nothing.
  await context.env.DB.prepare(
    `INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (contact_id, list_id) DO UPDATE SET choice = ?3, source = ?4, updated_at = datetime('now')
     WHERE choice <> ?3`,
  )
    .bind(opened.contact.id, list.id, OUT, FROM_LINK)
    .run()
  const body: UnsubscribeResponse = {
    unsubscribed: true,
    list: list.name,
    preferencesToken: await signLink(context.env.MAIL_LINK_SECRET, opened.contact.id, 'preferences'),
  }
  return linkAnswer(body)
}
