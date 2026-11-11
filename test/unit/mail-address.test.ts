// test/unit/mail-address.test.ts
//
// The address rules of domain/mail/address.ts and the values of
// domain/mail/lists.ts (WS16 step 2), on their own: what the do-not-send
// gate refuses before it reads anything. A sendable address has one @, a
// dot in the part after it and no space, and no top-level name RFC 2606
// section 2 reserves (.invalid, .test, .example, .localhost); a list
// address is also neither at the site's own domain nor under it, nor at a
// documentation name of RFC 2606 section 3 (example.com, example.net,
// example.org) nor under one. The cases name the site's domain only as the
// rule does, in DOMAIN below, and the one address of the site the code
// already holds, DEFAULT_FROM.
import { describe, expect, it } from 'vitest'
import { DEFAULT_FROM } from '../../domain/mail/addresses'
import { isListAddress, isSendableAddress, maskAddress, normalizeAddress } from '../../domain/mail/address'
import * as lists from '../../domain/mail/lists'

/** The site's own domain, as the list rule names it. */
const DOMAIN = 'louisianachess.org'

describe('normalizeAddress', () => {
  it('trims and lowercases, and leaves the rest as it is', () => {
    expect(normalizeAddress('  Pat.Member@Example.ORG \n')).toBe('pat.member@example.org')
    expect(normalizeAddress('pat+chess@example.org')).toBe('pat+chess@example.org')
    expect(normalizeAddress('')).toBe('')
  })
})

describe('isSendableAddress and isListAddress', () => {
  it('takes an ordinary address for both, however it is written', () => {
    for (const address of ['pat.member@gmail.com', 'kim@mail.lsu.edu', '  Kim.Parent@Yahoo.com ', 'player@test.lca', 'r0@campaign.test.lca']) {
      expect(isSendableAddress(address), address).toBe(true)
      expect(isListAddress(address), address).toBe(true)
    }
  })

  it('refuses a walk-in placeholder for both, as walk-ins.ts writes it', () => {
    const guestId = 'guest-7f3a'
    for (const address of [`${guestId}@walkin.lca.invalid`, `${guestId.toUpperCase()}@WALKIN.LCA.INVALID`]) {
      expect(isSendableAddress(address), address).toBe(false)
      expect(isListAddress(address), address).toBe(false)
    }
  })

  it('refuses an address under each reserved top-level name for both, at the name and under it', () => {
    for (const name of ['invalid', 'test', 'example', 'localhost']) {
      for (const address of [`a@lca.${name}`, `a@one.two.${name}`, `A@LCA.${name.toUpperCase()}`]) {
        expect(isSendableAddress(address), address).toBe(false)
        expect(isListAddress(address), address).toBe(false)
      }
    }
    // A name that only starts or ends like a reserved one is not reserved.
    for (const address of ['a@testing.org', 'a@invalidate.com', 'a@lca.tests']) expect(isSendableAddress(address), address).toBe(true)
  })

  it('refuses what is not an address for both: a space, no @ or two, nothing before the @, no dot after it, an empty name', () => {
    for (const address of [
      'pat member@example.org', 'pat@exam ple.org', 'pat@example.org\tx', 'pat.example.org', 'pat@@example.org', 'a@b@example.org',
      '@example.org', 'pat@localhost', 'pat@example', 'pat@.org', 'pat@example..org', 'pat@example.org.', '',
    ]) {
      expect(isSendableAddress(address), JSON.stringify(address)).toBe(false)
      expect(isListAddress(address), JSON.stringify(address)).toBe(false)
    }
  })

  it('takes an address at a documentation name, or under one, as sendable but never as a list address', () => {
    for (const address of ['pat.member@example.org', 'james.whitfield@example.com', 'a@example.net', 'a@mail.example.org', 'A@Sub.Example.COM']) {
      expect(isSendableAddress(address), address).toBe(true)
      expect(isListAddress(address), address).toBe(false)
    }
    // A name that only ends in the same letters is not a documentation name.
    expect(isListAddress('a@myexample.org')).toBe(true)
  })

  it('takes an address at the site\'s own domain, or under it, as sendable but never as a list address', () => {
    expect(DEFAULT_FROM.endsWith(`@${DOMAIN}`)).toBe(true)
    for (const address of [DEFAULT_FROM, `reader@${DOMAIN}`, `reader@lists.${DOMAIN}`, `Reader@Lists.${DOMAIN.toUpperCase()}`]) {
      expect(isSendableAddress(address), address).toBe(true)
      expect(isListAddress(address), address).toBe(false)
    }
    // A domain that only ends in the same letters is someone else's.
    expect(isListAddress(`reader@not${DOMAIN}`)).toBe(true)
  })
})

describe('maskAddress', () => {
  it('shows the first character, three dots, the @ and the domain', () => {
    expect(maskAddress('kim.parent@example.org')).toBe('k...@example.org')
    expect(maskAddress(' Kim.Parent@Example.org ')).toBe('k...@example.org')
    expect(maskAddress('k@example.org')).toBe('k...@example.org')
    expect(maskAddress('pat@mail.lsu.edu')).toBe('p...@mail.lsu.edu')
  })

  it('keeps only the first character of something with no @ before its domain', () => {
    expect(maskAddress('kim')).toBe('k...')
    expect(maskAddress('@example.org')).toBe('@...')
    expect(maskAddress('')).toBe('...')
  })
})

describe('domain/mail/lists.ts', () => {
  it('names the two lists migration 0060 writes', () => {
    expect(lists.NEWSLETTER_LIST_ID).toBe('lca-newsletter')
    expect(lists.TOURNAMENTS_LIST_ID).toBe('lca-tournaments')
  })

  it('holds every value the mail tables take, since no CHECK holds them in the database', () => {
    expect(lists.LIST_KINDS).toEqual(['newsletter', 'tournaments', 'club'])
    expect(lists.CHOICES).toEqual(['in', 'out'])
    expect(lists.CHOICE_SOURCES).toEqual(['link', 'preferences', 'complaint', 'admin', 'signup'])
    expect(lists.DO_NOT_SEND_REASONS).toEqual(['bounce', 'admin'])
  })

  it('exports those values and nothing else at run time', () => {
    expect(Object.keys(lists).sort()).toEqual(['CHOICES', 'CHOICE_SOURCES', 'DO_NOT_SEND_REASONS', 'LIST_KINDS', 'NEWSLETTER_LIST_ID', 'TOURNAMENTS_LIST_ID'])
  })
})
