// test/unit/club-slug.test.ts
//
// domain/clubs/slug.ts, the slug rule (WS09 step 4):
// - slugFor is the rule a new club's id has always been made by, so a club
//   whose name is free gets the id and the slug it would have had;
// - a slug is made once, at the first save, and kept on rename;
// - uniqueSlug never answers a slug another club holds as its id, its slug
//   or an old slug, nor one of the words the club pages keep, and adds the
//   first free short suffix, -2, -3 and so on, within 48 characters;
// - the file imports nothing, and the club create reads the rule from it.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FALLBACK_SLUG, isReservedSlug, RESERVED_SLUGS, SLUG_MAX_LENGTH, slugAtSave, slugFor, uniqueSlug } from '../../domain/clubs/slug'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The id rule as functions/api/admin/clubs.ts wrote it before this step, copied here to hold slugFor to it. */
function slugifyAsBefore(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}
const NAMES = [
  'Example Chess Club', '  Example   Knights  ', 'Example Chess Club!', 'Player One\'s Example Club', 'Example 64 Squares',
  'Club d\'Échecs Example', '---Example---', 'A very long made up name for an example chess club that goes on and on', '!!!', '',
]

describe('slugFor', () => {
  it('is the rule a new club\'s id has always been made by, with "club" for a name with no letter or digit', () => {
    for (const name of NAMES) expect(slugFor(name), name).toBe(slugifyAsBefore(name) || 'club')
    expect(FALLBACK_SLUG).toBe('club')
    expect(SLUG_MAX_LENGTH).toBe(48)
  })

  it('makes a lower-case slug of letters, digits and single hyphens, with no hyphen at either end and at most 48 characters', () => {
    expect(slugFor('Example Chess Club')).toBe('example-chess-club')
    expect(slugFor('  Example   Knights  ')).toBe('example-knights')
    expect(slugFor('Player One\'s Example Club')).toBe('player-one-s-example-club')
    for (const name of NAMES) {
      const slug = slugFor(name)
      expect(slug, name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(slug.length, name).toBeLessThanOrEqual(48)
    }
  })
})

describe('uniqueSlug', () => {
  it('answers the base itself when no club holds it and it is no reserved word', () => {
    expect(uniqueSlug('example-chess-club', [])).toBe('example-chess-club')
    expect(uniqueSlug('example-chess-club', ['example-knights', 'example-chess-club-2'])).toBe('example-chess-club')
  })

  it('adds the first free short suffix when another club holds the base as its id, its slug or an old slug', () => {
    expect(uniqueSlug('example-chess-club', ['example-chess-club'])).toBe('example-chess-club-2')
    expect(uniqueSlug('example-chess-club', ['example-chess-club', 'example-chess-club-2'])).toBe('example-chess-club-3')
    expect(uniqueSlug('example-chess-club', new Set(['example-chess-club', 'example-chess-club-3']))).toBe('example-chess-club-2')
  })

  it('is never a reserved word, nor a reserved word with a suffix that is taken', () => {
    expect([...RESERVED_SLUGS]).toEqual(['suggest', 'reports', 'confirm', 'reply', 'page', 'contact', 'logo'])
    for (const word of RESERVED_SLUGS) {
      expect(isReservedSlug(word), word).toBe(true)
      expect(uniqueSlug(word, []), word).toBe(`${word}-2`)
      expect(uniqueSlug(word, [`${word}-2`]), word).toBe(`${word}-3`)
      expect(uniqueSlug(slugFor(word.toUpperCase()), []), word).toBe(`${word}-2`)
    }
    expect(isReservedSlug('example-chess-club')).toBe(false)
    expect(isReservedSlug('logos')).toBe(false)
  })

  it('keeps a suffixed slug within 48 characters and drops a hyphen the cut leaves', () => {
    const long = slugFor('A very long made up name for an example chess club that goes on and on')
    expect(long).toHaveLength(48)
    const next = uniqueSlug(long, [long])
    expect(next.length).toBeLessThanOrEqual(48)
    expect(next).toBe(`${long.slice(0, 46).replace(/-+$/, '')}-2`)
    expect(next).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    const plain = 'a'.repeat(48)
    expect(uniqueSlug(plain, [plain])).toBe(`${'a'.repeat(46)}-2`)
    const hyphenAtCut = `${'a'.repeat(45)}-bc`
    expect(uniqueSlug(hyphenAtCut, [hyphenAtCut])).toBe(`${'a'.repeat(45)}-2`)
  })

  it('makes every slug unique over a run of clubs with the same name, and the same slug from the same addresses', () => {
    const taken: string[] = ['example-chess-club']
    for (let i = 0; i < 12; i++) taken.push(uniqueSlug(slugFor('Example Chess Club'), taken))
    expect(new Set(taken).size).toBe(taken.length)
    expect(taken.slice(0, 4)).toEqual(['example-chess-club', 'example-chess-club-2', 'example-chess-club-3', 'example-chess-club-4'])
    expect(uniqueSlug('example-chess-club', taken)).toBe(uniqueSlug('example-chess-club', [...taken].reverse()))
  })
})

describe('slugAtSave: made once, kept on rename', () => {
  it('makes the slug from the name at the first save, free of every slug held', () => {
    expect(slugAtSave(null, 'Example Chess Club', [])).toBe('example-chess-club')
    expect(slugAtSave(undefined, 'Example Chess Club', ['example-chess-club'])).toBe('example-chess-club-2')
    expect(slugAtSave('', 'Example Knights', [])).toBe('example-knights')
  })

  it('keeps the slug a club has when its name changes, whatever the new name\'s slug and whoever holds it', () => {
    expect(slugAtSave('example-chess-club', 'Example Knights', [])).toBe('example-chess-club')
    expect(slugAtSave('example-chess-club', 'Example Knights', ['example-knights', 'example-chess-club'])).toBe('example-chess-club')
    expect(slugAtSave('example-chess-club', 'Example Chess Club', ['example-chess-club'])).toBe('example-chess-club')
  })
})

describe('where the rule lives', () => {
  it('imports nothing, so it reaches neither functions/ nor src/', () => {
    const text = read('domain/clubs/slug.ts')
    expect(text).not.toMatch(/^\s*import\b/m)
    expect(text).not.toMatch(/\brequire\(|\bimport\(/)
  })

  it('is what the club create reads, with no slug rule of its own', () => {
    const create = read('functions/api/admin/clubs.ts')
    expect(create).toContain('import { slugFor, uniqueSlug } from \'../../../domain/clubs/slug\'')
    expect(create).toContain('const id = uniqueSlug(slugFor(name), taken)')
    expect(create).not.toMatch(/function slugify|Date\.now\(\)/)
  })
})
