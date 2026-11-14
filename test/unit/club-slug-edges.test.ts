// test/unit/club-slug-edges.test.ts
//
// The edges of domain/clubs/slug.ts (WS09 step 4), beyond club-slug.test.ts:
// - a name in another alphabet, with an accent, an emoji or a line break,
//   gives a slug of letters, digits and hyphens alone;
// - the suffix passes -9 into -10 and -100 and the slug stays within 48
//   characters;
// - the cut at 48 characters leaves no hyphen at the end, as the rule's own
//   words say;
// - a long run of made up names, drawn from a fixed seed, never gives a slug
//   that is reserved, taken, longer than 48 characters or written with a
//   doubled hyphen, and a slug made again from its own text is itself.
import { describe, expect, it } from 'vitest'
import { isReservedSlug, RESERVED_SLUGS, slugAtSave, slugFor, uniqueSlug } from '../../domain/clubs/slug'

const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

describe('slugFor outside plain ASCII', () => {
  it('drops what is not a letter or digit of a-z and 0-9, and falls back to "club" when nothing is left', () => {
    expect(slugFor('Example Échecs Club')).toBe('example-checs-club')
    expect(slugFor('Example\nChess\tClub')).toBe('example-chess-club')
    expect(slugFor('Example Chess Club \u{1F451}')).toBe('example-chess-club')
    expect(slugFor('\u{1F451}\u{265E}')).toBe('club')
    expect(slugFor('   ')).toBe('club')
    expect(slugFor('EXAMPLE CHESS CLUB')).toBe('example-chess-club')
    expect(slugFor('Example 64')).toBe('example-64')
  })

  it('has no hyphen at either end when the cut at 48 characters lands on a hyphen, as the rule says it has none', () => {
    const name = `${'a'.repeat(47)} bcd`
    expect(slugFor(name)).toMatch(SHAPE)
    expect(slugFor(`${'a'.repeat(30)} ${'b'.repeat(16)} cd`)).toMatch(SHAPE)
  })

  it('answers the same slug for a slug as for the name it came from', () => {
    for (const name of ['Example Chess Club', 'Player One\'s Example Club', 'Example 64 Squares', '\u{1F451}']) {
      expect(slugFor(slugFor(name))).toBe(slugFor(name))
    }
  })
})

describe('uniqueSlug past the first suffixes', () => {
  it('goes from -9 to -10 and on to -100 within 48 characters', () => {
    const base = 'example-chess-club'
    const taken = [base]
    for (let n = 2; n <= 9; n++) taken.push(`${base}-${n}`)
    expect(uniqueSlug(base, taken)).toBe(`${base}-10`)
    for (let n = 10; n <= 99; n++) taken.push(`${base}-${n}`)
    expect(uniqueSlug(base, taken)).toBe(`${base}-100`)
    const long = `${'a'.repeat(47)}`
    const held = [long]
    for (let n = 2; n <= 10; n++) held.push(`${'a'.repeat(48 - `-${n}`.length)}-${n}`)
    const next = uniqueSlug(long, held)
    expect(next).toBe(`${'a'.repeat(45)}-11`)
    expect(next).toHaveLength(48)
  })

  it('is never fooled by a held slug that looks like a suffix of another base', () => {
    expect(uniqueSlug('example', ['example', 'example-2-2', 'example-3'])).toBe('example-2')
    expect(uniqueSlug('example-2', ['example-2', 'example-2-2'])).toBe('example-2-3')
  })

  it('treats a reserved word as taken even when it is the base cut to 48 characters', () => {
    const base = `${'b'.repeat(40)}-logo`
    expect(uniqueSlug(base, [])).toBe(base)
    for (const word of RESERVED_SLUGS) expect(uniqueSlug(slugFor(`${word}!`), [])).not.toBe(word)
  })
})

/** A small repeatable generator, so the run below is the same on every machine. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

describe('a long run of made up names', () => {
  it('never gives a reserved, taken, overlong or ill-formed slug, and keeps one a club already has', () => {
    const next = seeded(20261113)
    const pieces = [...RESERVED_SLUGS, 'Example', 'Chess', 'Club', 'Knights', 'Rooks', '64', 'Player One', '!!', '  ', 'Échecs', '\u{1F451}', 'x'.repeat(30), 'City', 'of', 'the']
    const taken = new Set<string>(['example-chess-club', 'club', 'logo-2'])
    for (let i = 0; i < 600; i++) {
      const parts = Array.from({ length: 1 + Math.floor(next() * 5) }, () => pieces[Math.floor(next() * pieces.length)])
      const name = parts.join(next() < 0.5 ? ' ' : '-')
      const slug = uniqueSlug(slugFor(name), taken)
      expect(slug, name).toMatch(/^[a-z0-9][a-z0-9-]*$/)
      expect(slug, name).not.toMatch(/--/)
      expect(slug.length, name).toBeLessThanOrEqual(48)
      expect(isReservedSlug(slug), name).toBe(false)
      expect(taken.has(slug), name).toBe(false)
      expect(slugAtSave(slug, `${name} renamed`, taken), name).toBe(slug)
      taken.add(slug)
    }
    expect(taken.size).toBeGreaterThan(300)
  })
})
