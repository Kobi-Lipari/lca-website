// domain/mail/lists.ts
//
// The values the mail tables of migration 0060 hold, named once. The
// migration writes no CHECK for any of them (drizzle-kit does not write
// CHECK constraints, and changing one would mean rebuilding a table), so
// the code that writes a value takes it from here, and
// test/unit/mail-address.test.ts holds each list as it is.

/** The LCA newsletter's list, a row migration 0060 writes. */
export const NEWSLETTER_LIST_ID = 'lca-newsletter'

/** LCA tournament email's list, a row migration 0060 writes; Group email's member groups go out on it from WS16 step 11. */
export const TOURNAMENTS_LIST_ID = 'lca-tournaments'

/** What a list is (mail_lists.kind): LCA's newsletter, LCA's tournament email, or a club's own list (part two). */
export const LIST_KINDS = ['newsletter', 'tournaments', 'club'] as const
export type ListKind = (typeof LIST_KINDS)[number]

/** A person's choice on one list (mail_list_choices.choice). */
export const CHOICES = ['in', 'out'] as const
export type Choice = (typeof CHOICES)[number]

/**
 * Where a choice came from (mail_list_choices.source): an unsubscribe link, the preferences page, a spam report, an LCA
 * admin, or a sign-up.
 */
export const CHOICE_SOURCES = ['link', 'preferences', 'complaint', 'admin', 'signup'] as const
export type ChoiceSource = (typeof CHOICE_SOURCES)[number]

/** Why an address is on the do-not-send list (mail_do_not_send.reason): a permanent bounce, or an LCA admin by hand. */
export const DO_NOT_SEND_REASONS = ['bounce', 'admin'] as const
export type DoNotSendReason = (typeof DO_NOT_SEND_REASONS)[number]

/**
 * What kind of mail a message is, which decides what can stop it. 'event' is event and account mail, Group email's
 * Specific people among it, for a note about the person's own membership, entry or request: no choice ever stops it.
 * 'optional' is list mail, which always names its list. 'test' is a test send, which goes only to an address an LCA
 * list may send to.
 */
export type MailKind = 'event' | 'optional' | 'test'
