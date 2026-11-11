// functions/utils/mail/lists.ts
//
// Who the LCA newsletter is for, written once, in SQL, so the email
// preferences endpoint (functions/api/mail/preferences/[token].ts) and the
// newsletter's send (WS16 step 4) read the same rule. The lists' ids are in
// domain/mail/lists.ts.
//
// The newsletter's audience is K's rule (decision 28 of the WS16 plan, D38
// and Q40): every address on an account with an active membership, once.
// "You need to be active to get the newsletter": the list is not widened to
// lapsed members or to every account unless K says so. A member row counts
// when its membership_status is 'active', its role is not 'guest' (a
// walk-in placeholder) and its email is a list address as isListAddress in
// domain/mail/address.ts reads one, here written as clauses from that
// file's own names. Each address is trimmed of the spaces JavaScript's
// trim() takes off, as normalizeAddress trims it, and its ASCII letters
// lowercased, which is all SQLite's lower() folds, so a family's one
// address is one address. A capital letter outside ASCII would not match;
// member addresses come from the sign-in service already lowercased. A
// choice never adds an address to the newsletter: an 'in' on it from
// someone outside the audience counts for nothing.

import { EXAMPLE_DOMAINS, RESERVED_TOP_LEVEL_NAMES, SITE_DOMAIN } from '../../../domain/mail/address'

/**
 * The code points JavaScript's trim() takes off each end, which normalizeAddress trims and isSendableAddress's \s
 * refuses inside an address: ECMAScript's white space and line terminators. Tab, line feed, vertical tab, form feed,
 * carriage return, space, no-break space, the Ogham space mark, the en quad to the hair space, the line and paragraph
 * separators, the narrow no-break space, the medium mathematical space, the ideographic space and the byte order
 * mark. Written as numbers so that this file holds none of them.
 */
const SPACE_CODE_POINTS: readonly number[] = [
  9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279,
]

/** Those code points as one SQL string. */
const SPACES = `char(${SPACE_CODE_POINTS.join(', ')})`

/** The longest GLOB pattern D1 takes, in bytes of UTF-8. */
const GLOB_PATTERN_BYTES = 50

/** A code point's length in UTF-8. */
const utf8Bytes = (point: number) => (point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4)

/**
 * The code points in groups, in order, each small enough that '*[', the group and ']*' make a GLOB pattern D1 takes,
 * so an address is looked through for a space in two patterns rather than one D1 would refuse.
 */
const SPACE_GROUPS: readonly (readonly number[])[] = SPACE_CODE_POINTS.reduce<number[][]>((groups, point) => {
  const last = groups[groups.length - 1]
  const bytes = last ? last.reduce((sum, p) => sum + utf8Bytes(p), 4) : Infinity
  if (bytes + utf8Bytes(point) <= GLOB_PATTERN_BYTES) last.push(point)
  else groups.push([point])
  return groups
}, [])

/** A member row's address as the mail tables keep it, trimmed and lowercased, the row aliased m. */
const MEMBER_ADDRESS = `lower(trim(m.email, ${SPACES}))`

/**
 * SQL that is true when the trimmed, lowercased address `address` stands for is a list address: one @ with something
 * in front of it, a dot in the part after it between two names, no space, no top-level name RFC 2606 reserves, and
 * neither the site's own domain nor a documentation name, at the name or under it. Names are matched with GLOB,
 * whose only wildcards, * ? and [, appear in none of them, and a space with one GLOB class for each group of
 * SPACE_GROUPS, since D1 refuses a GLOB pattern longer than 50 bytes and the class of every space is longer.
 */
export function listAddressSql(address: string): string {
  const domain = `substr(${address}, instr(${address}, '@') + 1)`
  const notAtOrUnder = (name: string) => `${domain} <> '${name}' AND ${domain} NOT GLOB '*.${name}'`
  return [
    `instr(${address}, '@') > 1`,
    `instr(${domain}, '@') = 0`,
    ...SPACE_GROUPS.map((group) => `${address} NOT GLOB ('*[' || char(${group.join(', ')}) || ']*')`),
    `${domain} GLOB '*.*'`,
    `${domain} NOT GLOB '.*'`,
    `${domain} NOT GLOB '*.'`,
    `${domain} NOT GLOB '*..*'`,
    ...RESERVED_TOP_LEVEL_NAMES.map((name) => `${domain} NOT GLOB '*.${name}'`),
    notAtOrUnder(SITE_DOMAIN),
    ...EXAMPLE_DOMAINS.map(notAtOrUnder),
  ].join(' AND ')
}

/** The member rows the newsletter goes to, by their own columns: an active membership, no walk-in, a list address. */
const NEWSLETTER_MEMBER = `m.membership_status = 'active' AND m.role <> 'guest' AND m.email IS NOT NULL AND ${listAddressSql(MEMBER_ADDRESS)}`

/**
 * The newsletter's audience as a query of one column, address: every address on an account with an active
 * membership, trimmed and lowercased, once. WS16 step 4's send selects its recipients from it.
 */
export const NEWSLETTER_AUDIENCE_SQL = `SELECT DISTINCT ${MEMBER_ADDRESS} AS address FROM members m WHERE ${NEWSLETTER_MEMBER}`

/**
 * SQL that is true when the address `address` stands for, already trimmed and lowercased as mail_contacts keeps it,
 * is in the newsletter's audience: some account with an active membership has it.
 */
export function inNewsletterAudienceSql(address: string): string {
  return `EXISTS (SELECT 1 FROM members m WHERE ${MEMBER_ADDRESS} = ${address} AND ${NEWSLETTER_MEMBER})`
}

/** Whether one address, as normalizeAddress writes it, is in the newsletter's audience. One query. */
export async function inNewsletterAudience(db: D1Database, address: string): Promise<boolean> {
  const row = await db.prepare(`SELECT ${inNewsletterAudienceSql('?1')} AS yes`).bind(address).first<{ yes: number }>()
  return row?.yes === 1
}
