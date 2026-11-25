// test/unit/president-seat-files.test.ts
//
// The files that say who may send email to members, as files:
// - functions/utils/admin/presidentSeat.ts and domain/mail/senders.ts import
//   nothing, so whatever imports them takes in no other code;
// - functions/utils/auth.ts names neither functions/utils/events/creation.ts
//   nor domain/events, and creation.ts never names auth.ts, so the mail
//   guards and the creation rules stay apart;
// - creation.ts hands on the one president's read from presidentSeat.ts;
// - roles.ts (the pages) and auth.ts (the server) read the one
//   PRESIDENT_NEEDS_SECOND_FACTOR and the one
//   MEDIA_MANAGER_NEEDS_SECOND_FACTOR, set in domain/mail/senders.ts and
//   nowhere else, so the owner's answer on the second factor is one line for
//   each; both are unset (the owner's decision 82: only an LCA admin is asked);
// - LIST_MAILERS_ONLY is set once, in domain/mail/senders.ts, and auth.ts
//   hands it on;
// - the pages read the President seat from the session's seats by its slug,
//   exactly 'president', and let its holder, and the media manager, call
//   without a second factor while their constant is unset and only with one
//   while it is set (turned through getters on the mocked module).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as pages from '@/areas/admin/roles'
import * as senders from '../../domain/mail/senders'
import * as seat from '../../functions/utils/admin/presidentSeat'
import * as creation from '../../functions/utils/events/creation'

/** null reads the real constant; true or false turns it for one case. */
const turned = vi.hoisted(() => ({ president: null as boolean | null, mediaManager: null as boolean | null }))
vi.mock('@domain/mail/senders', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../domain/mail/senders')>()
  return {
    ...real,
    get PRESIDENT_NEEDS_SECOND_FACTOR() {
      return turned.president ?? real.PRESIDENT_NEEDS_SECOND_FACTOR
    },
    get MEDIA_MANAGER_NEEDS_SECOND_FACTOR() {
      return turned.mediaManager ?? real.MEDIA_MANAGER_NEEDS_SECOND_FACTOR
    },
  }
})

beforeEach(() => {
  turned.president = null
  turned.mediaManager = null
})

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Every module specifier a file names: static imports, re-exports, import() and require(). */
function specifiers(source: string): string[] {
  const found: string[] = []
  const patterns = [
    /\b(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) for (const m of source.matchAll(re)) found.push(m[1])
  return found
}

/** Every .ts and .tsx file under a folder of the repo. */
function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules') continue
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...filesUnder(path))
    else if (/\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

describe('the files of who may send', () => {
  it.each(['functions/utils/admin/presidentSeat.ts', 'domain/mail/senders.ts'])('%s imports nothing', (path) => {
    expect(specifiers(read(path))).toEqual([])
  })

  it('auth.ts names neither the creation rules nor domain/events', () => {
    for (const spec of specifiers(read('functions/utils/auth.ts'))) {
      expect(spec, spec).not.toMatch(/events\/creation/)
      expect(spec, spec).not.toMatch(/domain\/events/)
    }
  })

  it('creation.ts never names auth.ts', () => {
    for (const spec of specifiers(read('functions/utils/events/creation.ts'))) expect(spec, spec).not.toMatch(/(?:^|\/)auth$/)
  })

  it('creation.ts hands on the one president\'s read, with its two parameters', () => {
    expect(creation.holdsPresidentSeat).toBe(seat.holdsPresidentSeat)
    expect(seat.holdsPresidentSeat.length).toBe(2)
  })

  it('auth.ts reads the president\'s seat from presidentSeat.ts and the switch and the words from domain/mail/senders.ts', () => {
    const specs = specifiers(read('functions/utils/auth.ts'))
    expect(specs).toContain('./admin/presidentSeat')
    expect(specs).toContain('../../domain/mail/senders')
  })

  it('roles.ts reads both constants from domain/mail/senders.ts', () => {
    const source = read('src/areas/admin/roles.ts')
    expect(specifiers(source)).toContain('@domain/mail/senders')
    expect(source).toMatch(/\bPRESIDENT_NEEDS_SECOND_FACTOR\b/)
    expect(source).toMatch(/\bMEDIA_MANAGER_NEEDS_SECOND_FACTOR\b/)
  })

  it('auth.ts reads both constants', () => {
    const source = read('functions/utils/auth.ts')
    expect(source).toMatch(/\bPRESIDENT_NEEDS_SECOND_FACTOR\b/)
    expect(source).toMatch(/\bMEDIA_MANAGER_NEEDS_SECOND_FACTOR\b/)
  })

  it('both constants and LIST_MAILERS_ONLY are set in domain/mail/senders.ts and nowhere else', () => {
    const files = [...filesUnder('functions'), ...filesUnder('src'), ...filesUnder('domain')]
    for (const name of ['PRESIDENT_NEEDS_SECOND_FACTOR', 'MEDIA_MANAGER_NEEDS_SECOND_FACTOR', 'LIST_MAILERS_ONLY']) {
      const setting = files.filter((path) => new RegExp(`\\bconst ${name}\\b`).test(read(path)))
      expect(setting, name).toEqual(['domain/mail/senders.ts'])
    }
  })

  it('holds both constants as booleans, unset so neither the president nor the media manager is asked, and the words for anyone else', () => {
    expect(senders.PRESIDENT_NEEDS_SECOND_FACTOR).toBe(false)
    expect(senders.MEDIA_MANAGER_NEEDS_SECOND_FACTOR).toBe(false)
    expect(senders.LIST_MAILERS_ONLY).toBe('Group email is limited to LCA admins, the president and the media manager.')
  })

  it('sets each constant in one line of its own, so turning it back on is one line', () => {
    const source = read('domain/mail/senders.ts')
    expect(source).toMatch(/^export const PRESIDENT_NEEDS_SECOND_FACTOR = false$/m)
    expect(source).toMatch(/^export const MEDIA_MANAGER_NEEDS_SECOND_FACTOR = false$/m)
  })

  it('auth.ts hands LIST_MAILERS_ONLY on, for the tests and handlers that import it from there', () => {
    expect(read('functions/utils/auth.ts')).toMatch(/export \{[^}]*\bLIST_MAILERS_ONLY\b[^}]*\}/)
  })
})

describe('the pages\' reading of the President seat', () => {
  it('holds the seat only for a seat whose slug is exactly president', () => {
    expect(pages.holdsPresidentSeat([{ slug: 'president' }])).toBe(true)
    expect(pages.holdsPresidentSeat([{ slug: 'media-manager' }, { slug: 'president' }])).toBe(true)
    expect(pages.holdsPresidentSeat([{ slug: 'media-manager' }])).toBe(false)
    expect(pages.holdsPresidentSeat([{ slug: 'president-2' }, { slug: 'President' }])).toBe(false)
    expect(pages.holdsPresidentSeat([])).toBe(false)
  })

  it('lets the president call with or without a second factor while the constant is unset, as it ships', () => {
    expect(pages.presidentMayCall('aal2')).toBe(true)
    expect(pages.presidentMayCall('aal1')).toBe(true)
    expect(pages.presidentMayCall(null)).toBe(true)
  })

  it('lets the president call only with a second factor while the constant is set', () => {
    turned.president = true
    expect(pages.presidentMayCall('aal2')).toBe(true)
    expect(pages.presidentMayCall('aal1')).toBe(false)
    expect(pages.presidentMayCall(null)).toBe(false)
  })
})

describe('the pages\' reading of the media manager\'s second factor', () => {
  it('lets the media manager call with or without a second factor while the constant is unset, as it ships', () => {
    expect(pages.mediaManagerMayCall(true)).toBe(true)
    expect(pages.mediaManagerMayCall(false)).toBe(true)
  })

  it('lets the media manager call only with a second factor while the constant is set', () => {
    turned.mediaManager = true
    expect(pages.mediaManagerMayCall(true)).toBe(true)
    expect(pages.mediaManagerMayCall(false)).toBe(false)
  })

  it('reads each constant apart: one set leaves the other\'s holder as it ships', () => {
    turned.president = true
    expect(pages.mediaManagerMayCall(false)).toBe(true)
    turned.president = null
    turned.mediaManager = true
    expect(pages.presidentMayCall('aal1')).toBe(true)
  })
})
