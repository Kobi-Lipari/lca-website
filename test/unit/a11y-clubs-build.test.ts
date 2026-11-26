// The clubs build of the browser tests (WS09 step 24), checked without a
// browser: test/a11y/global-setup.ts keeps the two builds every reader of
// A11Y_VARIANTS means, gives the third its own entry (the a11y-on build's
// switches and newClubs, on a port, an inspector port and a database of its
// own), and makes the folder its server runs from by copying functions/
// with the one CLUB_PAGES_ON line set. The setup refuses to go on when that
// line is not there exactly once, when the copy differs from functions/ by
// anything but that line, or when the functions import from a folder the
// copy does not link; once the tree itself holds the line set, the copy is
// the tree's unchanged and may differ from it in nothing (WS09 checkpoint
// Z's review). These cases make each of those copies by hand, in a
// folder of their own under the system's temporary folder, and never touch
// functions/ itself.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  A11Y_ALL_VARIANTS, A11Y_CLUBS_LINKS, A11Y_CLUBS_SERVER, A11Y_CLUBS_VARIANT, A11Y_PERSIST, A11Y_VARIANTS, CLUB_PAGES_FILE, CLUB_PAGES_LINE,
  clubPagesLineSet, copyDifferences, reachedOutside, setClubPagesLine,
} from '../a11y/global-setup'

const ROOT = resolve(__dirname, '../..')
const FUNCTIONS = join(ROOT, 'functions')
const made: string[] = []

/** A copy of functions/ in a folder of its own, as the setup makes it, with the one line set. */
function copyOfFunctions(): string {
  const folder = mkdtempSync(join(tmpdir(), 'a11y-clubs-'))
  made.push(folder)
  cpSync(FUNCTIONS, join(folder, 'functions'), { recursive: true })
  const file = join(folder, 'functions', CLUB_PAGES_FILE)
  writeFileSync(file, setClubPagesLine(readFileSync(file, 'utf8')))
  return folder
}

afterEach(() => {
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true })
})

describe('the three builds', () => {
  it('A11Y_VARIANTS is still the two builds, and the clubs build is a third entry beside them', () => {
    expect(A11Y_VARIANTS.map((v) => v.name)).toEqual(['a11y-on', 'a11y-off'])
    expect(A11Y_ALL_VARIANTS.map((v) => v.name)).toEqual(['a11y-on', 'a11y-off', 'a11y-clubs'])
  })

  it('the clubs build is the a11y-on build\'s switches and newClubs, nothing else', () => {
    const on = A11Y_VARIANTS.find((v) => v.name === 'a11y-on')!
    expect(A11Y_CLUBS_VARIANT.flags).toBe(`${on.flags},newClubs`)
    expect(A11Y_CLUBS_VARIANT.flags.split(',')).toHaveLength(8)
  })

  it('has its own folder, port, inspector port and database, inside the setup\'s folder, and runs from its copy of functions/', () => {
    const { dist, port, inspectorPort, persist, serveFrom } = A11Y_CLUBS_VARIANT
    expect([dist, port, inspectorPort, persist]).toEqual(['dist-a11y-clubs', 8803, 9233, `${A11Y_PERSIST}/clubs`])
    for (const v of A11Y_VARIANTS) {
      expect([v.dist, v.port, v.inspectorPort, v.persist]).not.toContain(dist)
      expect(v.port).not.toBe(port)
      expect(v.inspectorPort).not.toBe(inspectorPort)
      expect(v.persist).not.toBe(persist)
    }
    expect(serveFrom).toBe(A11Y_CLUBS_SERVER)
    expect(A11Y_CLUBS_SERVER.startsWith(`${A11Y_PERSIST}/`)).toBe(true)
  })
})

describe('the clubs server\'s copy of functions/', () => {
  it('sets the one line, and the copy then differs from functions/ by that line alone', () => {
    const folder = copyOfFunctions()
    expect(copyDifferences(FUNCTIONS, join(folder, 'functions'))).toEqual([])
    const copied = readFileSync(join(folder, 'functions', CLUB_PAGES_FILE), 'utf8').split('\n')
    expect(copied.filter((l) => l === CLUB_PAGES_LINE.copy)).toHaveLength(1)
    expect(copied.filter((l) => l === CLUB_PAGES_LINE.tree)).toHaveLength(0)
  })

  it('refuses a file that holds the line no times, or twice', () => {
    expect(() => setClubPagesLine('export const SOME_OTHER_LINE = 1\n')).toThrow(/0 times, not once/)
    expect(() => setClubPagesLine(`${CLUB_PAGES_LINE.tree}\n${CLUB_PAGES_LINE.tree}\n`)).toThrow(/2 times, not once/)
    // The line must be the whole line: a comment that names it does not count.
    expect(() => setClubPagesLine(`// ${CLUB_PAGES_LINE.tree}\n`)).toThrow(/0 times, not once/)
  })

  it('finds a second line changed in the switches\' file, another file changed, a file added and a file missing', () => {
    const folder = copyOfFunctions()
    const pages = join(folder, 'functions', CLUB_PAGES_FILE)
    // Its first line, the file's own name in a comment, changed as well.
    writeFileSync(pages, readFileSync(pages, 'utf8').replace(/^[^\n]*/, '// changed'))
    writeFileSync(join(folder, 'functions', 'types.ts'), `${readFileSync(join(FUNCTIONS, 'types.ts'), 'utf8')}\n// changed\n`)
    writeFileSync(join(folder, 'functions', 'extra.ts'), 'export {}\n')
    rmSync(join(folder, 'functions', 'robots.txt.ts'), { force: true })
    const problems = copyDifferences(FUNCTIONS, join(folder, 'functions'))
    expect(problems).toContain(`${CLUB_PAGES_FILE} differs in 2 lines, not in the one CLUB_PAGES_ON line alone`)
    expect(problems).toContain('types.ts differs')
    expect(problems).toContain('extra.ts is in the copy and not in functions/')
    expect(problems).toContain('robots.txt.ts is missing from the copy')
  })

  it('finds a copy that was not changed at all', () => {
    const folder = mkdtempSync(join(tmpdir(), 'a11y-clubs-'))
    made.push(folder)
    cpSync(FUNCTIONS, join(folder, 'functions'), { recursive: true })
    expect(copyDifferences(FUNCTIONS, join(folder, 'functions'))).toEqual([`${CLUB_PAGES_FILE} differs in 0 lines, not in the one CLUB_PAGES_ON line alone`])
  })

  // Once the club pages ship on, the tree's file holds the line set: the setup then makes the server from an
  // unchanged copy. These cases make such a tree by hand, from a copy of functions/ with the line set.
  it('takes a functions/ whose line is already set, and makes its copy unchanged with no problem', () => {
    const tree = join(copyOfFunctions(), 'functions')
    const text = readFileSync(join(tree, CLUB_PAGES_FILE), 'utf8')
    expect(clubPagesLineSet(text)).toBe(true)
    expect(setClubPagesLine(text)).toBe(text)
    const folder = mkdtempSync(join(tmpdir(), 'a11y-clubs-'))
    made.push(folder)
    cpSync(tree, join(folder, 'functions'), { recursive: true })
    const file = join(folder, 'functions', CLUB_PAGES_FILE)
    writeFileSync(file, setClubPagesLine(readFileSync(file, 'utf8')))
    expect(copyDifferences(tree, join(folder, 'functions'))).toEqual([])
  })

  it('refuses a copy of a tree whose line is already set when the copy differs in any line', () => {
    const tree = join(copyOfFunctions(), 'functions')
    for (const change of [
      (text: string) => text.replace(CLUB_PAGES_LINE.copy, CLUB_PAGES_LINE.tree),
      (text: string) => text.replace(/^[^\n]*/, '// changed'),
    ]) {
      const folder = mkdtempSync(join(tmpdir(), 'a11y-clubs-'))
      made.push(folder)
      cpSync(tree, join(folder, 'functions'), { recursive: true })
      const file = join(folder, 'functions', CLUB_PAGES_FILE)
      writeFileSync(file, change(readFileSync(file, 'utf8')))
      expect(copyDifferences(tree, join(folder, 'functions'))).toEqual([`${CLUB_PAGES_FILE} differs in 1 lines, though functions/ already holds the CLUB_PAGES_ON line set`])
    }
  })

  it('refuses a file that holds the line in both forms, or in neither, or the set form twice', () => {
    expect(() => setClubPagesLine(`${CLUB_PAGES_LINE.tree}\n${CLUB_PAGES_LINE.copy}\n`)).toThrow(/1 times and the line "export const CLUB_PAGES_ON = true" 1 times, not one of them once/)
    expect(() => setClubPagesLine(`${CLUB_PAGES_LINE.copy}\n${CLUB_PAGES_LINE.tree}\n${CLUB_PAGES_LINE.tree}\n`)).toThrow(/not one of them once/)
    expect(() => setClubPagesLine('export const SOME_OTHER_LINE = 1\n')).toThrow(/"export const CLUB_PAGES_ON = false" 0 times, not once/)
    expect(() => setClubPagesLine(`${CLUB_PAGES_LINE.copy}\n${CLUB_PAGES_LINE.copy}\n`)).toThrow(/"export const CLUB_PAGES_ON = true" 2 times, not once/)
    expect(() => setClubPagesLine(`// ${CLUB_PAGES_LINE.copy}\n`)).toThrow(/0 times, not once/)
  })

  it('links every folder the functions import from outside functions/, and finds one it does not', () => {
    const folder = copyOfFunctions()
    const reached = reachedOutside(folder)
    expect(reached).toContain('domain')
    for (const name of reached) expect(A11Y_CLUBS_LINKS as readonly string[], name).toContain(name)
    writeFileSync(join(folder, 'functions', 'extra.ts'), "import { x } from '../scripts/x'\nexport { x }\n")
    expect(reachedOutside(folder)).toContain('scripts')
  })
})
