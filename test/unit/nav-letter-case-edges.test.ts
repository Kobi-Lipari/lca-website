// test/unit/nav-letter-case-edges.test.ts
//
// The navigation model's rule on letter case at its edges (WS02 step 8):
// the router matches a route whatever its letters' case, and since this
// step src/lib/nav.ts reads a path the same way, so the current section,
// the current tab and the rows marked current answer for an address in
// capitals as for the same address in small letters:
//
// - every address each section owns, written in capitals, in title case and
//   in mixed case, alone, with a slash after it and with a page under it,
//   gives the section and the tab the address in small letters gives;
// - the sign-in page and the person's dashboard give the account tab in any
//   letter case;
// - a word that only starts with a section's address is under no section,
//   in any letter case;
// - the rule needs every address of the model in small letters, since only
//   the path is put in small letters: each section's addresses and every
//   address of the site's own pages an entry opens are.
import { describe, expect, it } from 'vitest'
import { NAV_IDS, SECTIONS, SECTION_ROUTES, currentTab, navEntry, pathIsUnder, sectionFor } from '@/lib/nav'
import type { Features } from '@/lib/features'
import { FEATURES } from '@/lib/features'

/** An address written four ways: as the model writes it, in capitals, in title case and in mixed case. */
function spellings(address: string): string[] {
  const title = address.replace(/(^|[/-])([a-z])/g, (_m, before: string, letter: string) => `${before}${letter.toUpperCase()}`)
  const mixed = [...address].map((ch, i) => (i % 2 ? ch.toUpperCase() : ch)).join('')
  return [address, address.toUpperCase(), title, mixed]
}

/** What follows an address: nothing, a slash, or a page under it. */
const AFTER = ['', '/', '/Fx-Page-1']

describe('the current section and the current tab in any letter case', () => {
  for (const section of SECTIONS) {
    for (const address of SECTION_ROUTES[section]) {
      it(`${address} in each spelling, alone, with a slash and with a page under it, is under ${section}, its tab the one the small letters give`, () => {
        for (const written of spellings(address)) {
          for (const after of AFTER) {
            const path = `${written}${after}`
            expect(sectionFor(path), path).toBe(section)
            expect(currentTab(path), path).toBe(currentTab(`${address}${after}`))
            expect(pathIsUnder(path, address), path).toBe(true)
          }
        }
      })
    }
  }

  it.each(['/login', '/dashboard'])('%s in each spelling gives the account tab and no section', (address) => {
    for (const written of spellings(address)) {
      for (const after of AFTER) {
        expect(sectionFor(`${written}${after}`), `${written}${after}`).toBeNull()
        expect(currentTab(`${written}${after}`), `${written}${after}`).toBe('account')
      }
    }
  })

  it('puts a word that only starts with a section\'s address under no section, in any letter case', () => {
    for (const section of SECTIONS) {
      for (const address of SECTION_ROUTES[section]) {
        for (const written of spellings(`${address}x`)) {
          expect(pathIsUnder(written, address), written).toBe(false)
          expect(sectionFor(written) === section, written).toBe(false)
        }
      }
    }
    for (const path of ['/', '/SUPPORT', '/Search', '/Register', '/LoginX', '/DashboardX']) expect(currentTab(path), path).toBeNull()
  })
})

describe('the model\'s addresses, which the rule reads in small letters', () => {
  /** Every switch on, so each entry's later address is read as well as today's. */
  const EVERY_SWITCH = Object.fromEntries(Object.keys(FEATURES).map((name) => [name, true])) as unknown as Features

  it('writes every address each section owns in small letters', () => {
    for (const section of SECTIONS) {
      for (const address of SECTION_ROUTES[section]) expect(address, section).toBe(address.toLowerCase())
    }
  })

  it('writes the path of every page of the site\'s own an entry opens in small letters, today\'s and the one it moves to', () => {
    let read = 0
    for (const features of [FEATURES, EVERY_SWITCH]) {
      for (const id of NAV_IDS) {
        const { href, leavesSite } = navEntry(id, features)
        if (href === null || leavesSite) continue
        const path = href.split(/[?#]/)[0]
        expect(path, id).toBe(path.toLowerCase())
        read++
      }
    }
    expect(read).toBeGreaterThan(40)
  })
})
