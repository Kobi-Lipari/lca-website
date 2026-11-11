// domain/mail/address.ts
//
// What an email address must be before mail goes to it. Pure, with no
// import, so the site, the server and the daily-emails worker can all read
// it.
//
// Two rules, one inside the other. A sendable address has one @, a dot in
// the part after it and no space, and is not under a top-level name that
// RFC 2606 section 2 reserves: walk-in placeholders are written under the
// first of them, as `${guestId}@walkin.lca.invalid`
// (functions/api/admin/tournaments/[id]/walk-ins.ts). A list address is a
// sendable address that is not at the site's own domain or under it, where
// no mailbox exists (the address map's rule 3), and not at one of the names
// RFC 2606 section 3 reserves for documentation or under it, where
// migration 0002 seeds sixteen sample members at example.com. List mail and
// test sends go only to list addresses, so a first newsletter cannot
// bounce on a sample member; event mail keeps today's reach, example.org
// included, which the integration suites send to.

/** The site's own domain. No mailbox exists at it or under it, so no address there is ever on an LCA list. */
const SITE_DOMAIN = 'louisianachess.org'

/** The top-level names RFC 2606 section 2 reserves. No mail sent under them reaches anyone. */
const RESERVED_TOP_LEVEL_NAMES = ['invalid', 'test', 'example', 'localhost']

/** The names RFC 2606 section 3 reserves for documentation. */
const EXAMPLE_DOMAINS = ['example.com', 'example.net', 'example.org']

/** An address as the mail tables keep it: trimmed and lowercased, so a family's one address is one row whatever was typed. */
export function normalizeAddress(raw: string): string {
  return raw.trim().toLowerCase()
}

/** The part after the one @, or null when the address has no @ or more than one. */
function domainOf(address: string): string | null {
  const parts = address.split('@')
  return parts.length === 2 && parts[0] !== '' ? parts[1] : null
}

/** True when the domain is the name itself or a name under it. */
function atOrUnder(domain: string, name: string): boolean {
  return domain === name || domain.endsWith(`.${name}`)
}

/**
 * True for an address mail can reach: one @ with something in front of it, a dot in the part after it between two
 * names, no space anywhere, and no reserved top-level name at the end. Read on the address as normalizeAddress
 * writes it.
 */
export function isSendableAddress(address: string): boolean {
  const value = normalizeAddress(address)
  if (/\s/.test(value)) return false
  const domain = domainOf(value)
  if (domain === null) return false
  const names = domain.split('.')
  if (names.length < 2 || names.some((name) => name === '')) return false
  return !RESERVED_TOP_LEVEL_NAMES.includes(names[names.length - 1])
}

/**
 * True for an address an LCA list may send to: a sendable address that is neither at the site's own domain nor under
 * it, and neither at a documentation name nor under one.
 */
export function isListAddress(address: string): boolean {
  if (!isSendableAddress(address)) return false
  const domain = domainOf(normalizeAddress(address)) as string
  if (atOrUnder(domain, SITE_DOMAIN)) return false
  return !EXAMPLE_DOMAINS.some((name) => atOrUnder(domain, name))
}

/**
 * An address as a page shows it to someone who should not read it whole: its first character, three dots, the @ and
 * the domain, as "k...@example.org". Something with no @ in it keeps only its first character.
 */
export function maskAddress(address: string): string {
  const value = normalizeAddress(address)
  const at = value.lastIndexOf('@')
  if (at <= 0) return `${value.slice(0, 1)}...`
  return `${value[0]}...${value.slice(at)}`
}
