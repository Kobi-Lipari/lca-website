// functions/utils/mail/footer.ts
//
// What every optional email carries for the person it goes to: the footer
// under its message and the two one-click headers. listMailParts signs the
// person's two links (./links) and builds both from the list's words in
// domain/mail/footer.ts, so the footer is built in this one place and holds
// no postal address (D41).
//
// - The headers, in this order: List-Unsubscribe with one HTTPS address,
//   the API's own (functions/api/mail/unsubscribe/[token].ts), which takes
//   the one-click POST RFC 8058 describes, and no mailto, since LCA has no
//   mailbox that reads unsubscribe mail; then List-Unsubscribe-Post with
//   'List-Unsubscribe=One-Click'.
// - The footer: the list's reason line, then the link that leaves the list
//   and the email preferences link, each to the page that opens it (drawn
//   in WS16 step 5), in the layout's own footer style (emailListFooter in
//   ../emailLayout).
//
// Every address is the configured site's (resolveSiteUrl in ../site, never
// the request's host). The seam in ./send only checks the headers a
// message carries and never imports this file, so the daily-emails worker
// bundles none of it until the list path (WS16 step 4) sends list mail.

import { listFooterWords, PREFERENCES_LABEL } from '../../../domain/mail/footer'
import { emailListFooter } from '../emailLayout'
import { resolveSiteUrl } from '../site'
import { signLink } from './links'
import { LIST_UNSUBSCRIBE, LIST_UNSUBSCRIBE_POST, ONE_CLICK, type MailHeader } from './send'

/** The bindings the footer needs: the site's address and the link key. */
export interface ListMailEnv {
  SITE_URL?: string
  MAIL_LINK_SECRET?: string
}

/** One person's footer and headers on one list. */
export interface ListMailParts {
  /** Already-safe HTML for renderEmail's listFooter. */
  footerHtml: string
  /** List-Unsubscribe, then List-Unsubscribe-Post, for the seam's OutgoingMail. */
  headers: MailHeader[]
}

/**
 * The footer and the headers of one optional email for one contact on one list. Throws MailLinkKeyMissing when
 * MAIL_LINK_SECRET is not set, so nothing goes without links that open, and an Error for a list whose footer words are
 * not written.
 */
export async function listMailParts(env: ListMailEnv, args: { contactId: string; listId: string }): Promise<ListMailParts> {
  const words = listFooterWords(args.listId)
  if (!words) throw new Error('No footer words are written for this list.')
  const unsubscribeToken = await signLink(env.MAIL_LINK_SECRET, args.contactId, 'unsubscribe', args.listId)
  const preferencesToken = await signLink(env.MAIL_LINK_SECRET, args.contactId, 'preferences')
  const siteUrl = resolveSiteUrl(env)
  const footerHtml = emailListFooter(words.reason, [
    { label: words.unsubscribeLabel, url: `${siteUrl}/email/unsubscribe/${unsubscribeToken}` },
    { label: PREFERENCES_LABEL, url: `${siteUrl}/email/preferences/${preferencesToken}` },
  ])
  return {
    footerHtml,
    headers: [
      { name: LIST_UNSUBSCRIBE, value: `<${siteUrl}/api/mail/unsubscribe/${unsubscribeToken}>` },
      { name: LIST_UNSUBSCRIBE_POST, value: ONE_CLICK },
    ],
  }
}
