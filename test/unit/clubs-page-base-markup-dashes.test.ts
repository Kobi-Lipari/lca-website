// test/unit/clubs-page-base-markup-dashes.test.ts
//
// The stored copy of today's Clubs page (test/unit/fixtures/
// clubs-page-base-markup.json) holds the page's one en dash, in "Sorted A
// to Z" as today's page writes it, as its JSON escape, not as the
// character, so no long dash is written in the tree's own files (checkpoint
// Y's review). The parsed string is the page's, so the comparison in
// test/unit/clubs-page-base-markup.test.tsx is unchanged. The dashes are
// built from their codes here, so this file holds none either.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const EN_DASH = String.fromCharCode(0x2013)
const EM_DASH = String.fromCharCode(0x2014)

describe('the stored copy of today\'s Clubs page', () => {
  it('carries neither an en dash nor an em dash in its raw text, and the page\'s own dash once its escape is read', () => {
    const raw = readFileSync(join(__dirname, 'fixtures/clubs-page-base-markup.json'), 'utf8')
    expect(raw.includes(EN_DASH)).toBe(false)
    expect(raw.includes(EM_DASH)).toBe(false)
    expect(raw).toContain('\\u2013')
    const parsed = JSON.parse(raw) as { todaysPage: string }
    expect(parsed.todaysPage).toContain(`Sorted A${EN_DASH}Z`)
  })
})
