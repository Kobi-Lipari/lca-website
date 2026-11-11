// domain/mail/footer.ts
//
// The words under every optional email, in one place: the line that says
// why the person gets the list, the label of the link that leaves it, the
// label of the email preferences link, and the line that says what keeps
// coming after a person stops all optional mail. Pure, with no import but
// the lists' ids, so the server's footer (functions/utils/mail/footer.ts)
// and Group email's preview (WS16 step 5) say the same words.
//
// The footer holds no postal address: no email the site sends carries one,
// as K decided on Tuesday, November 10, 2026 (D41), and there is no setting,
// slot or reminder for one. Since the footer is built here alone, a line
// could be added later in one small change.

import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID } from './lists'

/** The words of one LCA list's footer: why the person gets it, and the label of the link that leaves it. */
export interface ListFooterWords {
  reason: string
  unsubscribeLabel: string
}

/** Each LCA list's own words, chosen by the list's id. LCA tournament email's are used from WS16 step 11. */
export const LIST_FOOTER_WORDS: Readonly<Record<typeof NEWSLETTER_LIST_ID | typeof TOURNAMENTS_LIST_ID, ListFooterWords>> = {
  [NEWSLETTER_LIST_ID]: {
    reason: "You're getting the LCA newsletter because this address is on an LCA member's account.",
    unsubscribeLabel: 'Unsubscribe from the LCA newsletter',
  },
  [TOURNAMENTS_LIST_ID]: {
    reason: "You're getting LCA tournament email because this address is on an LCA member's account.",
    unsubscribeLabel: 'Unsubscribe from LCA tournament email',
  },
}

/** The label of the link to the email preferences page, the same under every list. */
export const PREFERENCES_LABEL = 'Email preferences'

/**
 * What keeps coming after a person stops all optional mail: event and account mail, Group email's notes about a
 * person's own membership among it. The unsubscribe and preferences pages show it under their choice.
 */
export const EVENT_MAIL_STILL_COMES = "You'll still get email about your membership, registrations, payments and support requests."

/** The footer's words for a list, or undefined for a list that has none written yet, such as a club's (part two). */
export function listFooterWords(listId: string): ListFooterWords | undefined {
  return listId === NEWSLETTER_LIST_ID || listId === TOURNAMENTS_LIST_ID ? LIST_FOOTER_WORDS[listId] : undefined
}
