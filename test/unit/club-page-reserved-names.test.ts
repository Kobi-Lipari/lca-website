// test/unit/club-page-reserved-names.test.ts
// A club whose slug equalled a fixed name where the address part sits could
// never be reached (WS09 step 20). Every fixed name under functions/api/clubs/
// and functions/clubs/ that sits beside, or under, the [id] part is read from
// the folders as they are, and each must be in the slug rule's one list, so a
// new folder added without its name there fails here. The page's own
// endpoint sits at /page under the address part, so "page" is among them.
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isReservedSlug, RESERVED_SLUGS, slugFor, uniqueSlug } from '../../domain/clubs/slug'

const ROOT = resolve(__dirname, '../..')

/** The fixed names in a folder: files without .ts and folders, never a [bracketed] part. */
function fixedNames(dir: string): string[] {
  return readdirSync(join(ROOT, dir))
    .filter((name) => !name.startsWith('['))
    .map((name) => (statSync(join(ROOT, dir, name)).isDirectory() ? name : name.replace(/\.(ts|tsx)$/, '')))
}

describe('the names a club slug may not take', () => {
  it('holds every fixed name beside the address part in the folders, and every name under it', () => {
    const names = [
      ...fixedNames('functions/api/clubs'),
      ...fixedNames('functions/api/clubs/[id]'),
      ...fixedNames('functions/clubs'),
    ]
    expect(names).toEqual(expect.arrayContaining(['confirm', 'logo', 'page']))
    for (const name of names) expect(RESERVED_SLUGS, name).toContain(name)
  })

  it('holds the fixed names the site\'s own club addresses use, under /clubs', () => {
    for (const name of ['suggest', 'reports', 'confirm', 'reply', 'page', 'contact', 'logo']) expect(isReservedSlug(name), name).toBe(true)
  })

  it('never hands out one of them as a slug, however the club is named or whatever is taken', () => {
    for (const name of ['confirm', 'Logo', ' Page ', 'PAGE!', 'confirm confirm']) {
      const slug = uniqueSlug(slugFor(name), [])
      expect(isReservedSlug(slug), name).toBe(false)
    }
  })
})
