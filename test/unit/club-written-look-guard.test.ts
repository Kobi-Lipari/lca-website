// test/unit/club-written-look-guard.test.ts
// Where the written page's wrapper mark lives (checkpoint W), beside
// club-written-look-scope.test.tsx: the mark is written by one file only,
// functions/utils/clubs/pageHtml.ts; no file under src/, public/ or the
// shell, and none of the site's built scripts or stylesheets when a build is
// there, carries it, so the styling can never reach a page the app draws and
// the site's bundle is the same with or without it. Every name here is made up.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { WRITTEN_PAGE_MARK, WRITTEN_PAGE_STYLE } from '../../functions/utils/clubs/pageHtml'

const ROOT = resolve(__dirname, '../..')

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full))
    else out.push(full)
  }
  return out
}
const holding = (files: string[]) => files.filter((file) => readFileSync(file).includes(WRITTEN_PAGE_MARK)).map((file) => file.slice(ROOT.length + 1))

describe('the wrapper\'s mark', () => {
  it('is held by the one file that writes it, and by no file the page the app draws is built from', () => {
    const sources = [...filesUnder(join(ROOT, 'functions')), ...filesUnder(join(ROOT, 'domain')), ...filesUnder(join(ROOT, 'src')), ...filesUnder(join(ROOT, 'public'))]
    expect(sources.length).toBeGreaterThan(100)
    expect(holding(sources)).toEqual(['functions/utils/clubs/pageHtml.ts'])
    expect(holding([join(ROOT, 'index.html')])).toEqual([])
  })

  it('is in none of the site\'s own built scripts and stylesheets', () => {
    const built = filesUnder(join(ROOT, 'dist', 'assets'))
    expect(holding(built)).toEqual([])
    expect(holding(filesUnder(join(ROOT, 'dist')).filter((file) => file.endsWith('index.html')))).toEqual([])
  })

  it('is one attribute with no value, and the styling selects it by name on one element only', () => {
    expect(WRITTEN_PAGE_MARK).toMatch(/^data-[a-z]+(-[a-z]+)*$/)
    const selectors = WRITTEN_PAGE_STYLE.split('}').filter(Boolean).map((rule) => rule.split('{')[0])
    expect(new Set(selectors.map((selector) => selector.split(' ')[0]))).toEqual(new Set([`main[${WRITTEN_PAGE_MARK}]`]))
    expect(selectors.every((selector) => (selector.match(/\[/g) ?? []).length === 1)).toBe(true)
  })
})
