// functions/utils/mail/links.ts
//
// The signed links an optional email carries: one that leaves the list the
// email came on, and one that opens the person's email preferences. A link
// needs no sign-in and never expires, so its signature is what keeps a
// stranger out. A token is written `${contactId}.${scope}.${mac}`: the
// contact's id (32 hex characters, mail_contacts.id), the scope (the list's
// id for an unsubscribe link, 'p' for a preferences link) and the first 22
// characters of the base64url HMAC-SHA256 of
// `lca-mail-link:1:${purpose}:${contactId}:${scope}` under MAIL_LINK_SECRET,
// a key of its own. 22 characters carry 132 bits, which no one can guess,
// and a newsletter token is 70 characters long. The purpose is part of what
// is signed, so neither kind of link opens the other's endpoint, and the
// token holds no date, so no link stops working with time. While the key is
// being changed, MAIL_LINK_SECRET_PREVIOUS keeps the links signed under the
// old key working; nothing is ever signed under it.
//
// Pure Web Crypto with no import at all, so a bundle that signs links takes
// nothing of Stripe's helper in ../stripe and no package.

/** What a link is for. */
export type LinkPurpose = 'unsubscribe' | 'preferences'

/** The keys a link is read with: the one links are signed with now, and, while the key is being changed, the one before. */
export interface LinkKeys {
  current?: string
  previous?: string
}

/** What a link that verifies says: whose it is and, for an unsubscribe link, which list it leaves. */
export interface LinkHolder {
  contactId: string
  listId?: string
}

/**
 * MAIL_LINK_SECRET is not set on this deployment, as on the Preview environment and in the browser tests: no link can
 * be signed, and the engine (WS16 step 4) treats it as a key fault and sends nothing.
 */
export class MailLinkKeyMissing extends Error {
  constructor() {
    super('The mail link key is missing on this deployment.')
    this.name = 'MailLinkKeyMissing'
  }
}

/** The scope of every preferences link. */
const PREFERENCES_SCOPE = 'p'
/** How many characters of the signature a token keeps: 22 of base64url carry 132 bits. */
const MAC_LENGTH = 22
/** The version of the signed text, so a later form of link could be told apart from this one. */
const LINK_VERSION = 1
/** A contact's id as mail_contacts holds it: 32 lowercase hex characters. */
const CONTACT_ID = /^[0-9a-f]{32}$/
/** A list's id: lowercase letters and digits, words joined by single hyphens, so no '.' or ':' can reach the token. */
const LIST_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** The signature's part of a token. */
const MAC = new RegExp(`^[A-Za-z0-9_-]{${MAC_LENGTH}}$`)
/** Longer than any token signLink writes (a list's id is at most 64 characters), so a very long one is turned away unread. */
const MAX_TOKEN_LENGTH = 32 + 1 + 64 + 1 + MAC_LENGTH

const encoder = new TextEncoder()

async function hmac(secret: string, text: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(text)))
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The signature a token carries for this purpose, contact and scope, under one key. */
async function macOf(secret: string, purpose: LinkPurpose, contactId: string, scope: string): Promise<string> {
  return base64Url(await hmac(secret, `lca-mail-link:${LINK_VERSION}:${purpose}:${contactId}:${scope}`)).slice(0, MAC_LENGTH)
}

/** Two signatures compared in the same time whatever they hold, so the time an answer takes gives nothing away. */
function sameMac(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let differ = 0
  for (let i = 0; i < a.length; i++) differ |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return differ === 0
}

/** True for a list id a token can carry. */
function isListScope(scope: string): boolean {
  return scope !== PREFERENCES_SCOPE && scope.length <= 64 && LIST_ID.test(scope)
}

/**
 * Signs a link for one contact: an unsubscribe link for the list given, or a preferences link, which names no list.
 * Throws MailLinkKeyMissing when the key is not set, and an Error for an id no token could carry.
 */
export async function signLink(secret: string | undefined, contactId: string, purpose: LinkPurpose, listId?: string): Promise<string> {
  if (!secret) throw new MailLinkKeyMissing()
  if (!CONTACT_ID.test(contactId)) throw new Error("A link names its contact by the contact's 32-character id.")
  if (purpose === 'preferences' && listId !== undefined) throw new Error('A preferences link names no list.')
  if (purpose === 'unsubscribe' && (listId === undefined || !isListScope(listId))) throw new Error("An unsubscribe link names its list by the list's id.")
  const scope = purpose === 'unsubscribe' ? (listId as string) : PREFERENCES_SCOPE
  return `${contactId}.${scope}.${await macOf(secret, purpose, contactId, scope)}`
}

/**
 * Reads a token for one purpose: whose it is, and for an unsubscribe link its list, when its signature verifies under
 * the current key or, when one is given, the previous key; null for anything else, and for every token while the
 * current key is missing. It reads no clock and no database.
 */
export async function readLink(keys: LinkKeys, token: string, purpose: LinkPurpose): Promise<LinkHolder | null> {
  const current = keys.current || undefined
  const previous = keys.previous || undefined
  if (current === undefined || typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [contactId, scope, mac] = parts
  if (!CONTACT_ID.test(contactId) || !MAC.test(mac)) return null
  if (purpose === 'preferences' ? scope !== PREFERENCES_SCOPE : !isListScope(scope)) return null
  const underCurrent = sameMac(mac, await macOf(current, purpose, contactId, scope))
  const underPrevious = previous !== undefined && sameMac(mac, await macOf(previous, purpose, contactId, scope))
  if (!underCurrent && !underPrevious) return null
  return purpose === 'unsubscribe' ? { contactId, listId: scope } : { contactId }
}

/**
 * The first 16 hex characters of the HMAC-SHA256 of 'lca-mail-link-check' under the key. A list campaign stores it
 * when it is made (WS16 step 4), so a deployment whose copy of the key differs (the worker's is typed apart from the
 * site's) knows before it sends a link that would not open. It tells nothing usable about a 32-byte random key.
 * Throws MailLinkKeyMissing when the key is not set.
 */
export async function linkKeyCheck(secret: string | undefined): Promise<string> {
  if (!secret) throw new MailLinkKeyMissing()
  const bytes = await hmac(secret, 'lca-mail-link-check')
  return [...bytes.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
