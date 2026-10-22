// The heritage look's font budget (WS01 step 30).
//
// The brief gives the heritage faces 110 KB of woff2, latin subset. This
// follows src/styles/themes/heritage.css the way the build does, into the
// package stylesheet it imports and to the files its faces name, and reads
// the real files:
//
// - each family has one roman (normal) face, and its file is the package's
//   latin file: every face of the package that names the file covers the
//   letters, figures and marks of English text, and a face the stylesheet
//   writes itself keeps the package's own range for it;
// - the woff2 files of the roman faces, which a browser fetches for a page's
//   roman text, come to 110,000 bytes or less, so either reading of 110 KB
//   holds;
// - the italic is declared, and its file is named by an italic face only, so
//   a browser fetches it only when italic text is set in the face; it is not
//   counted, and nor is the woff beside Caslon's woff2, which comes after it,
//   so a browser that reads woff2 never fetches it;
// - the fallback faces name no file, only a face of the device's own.
//
// Each check fails on a planted stylesheet: an extra file, another subset,
// or the italic declared as roman.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { read, ROOT } from './helpers/cssTokens'
import { declaredFaces, onDisk, type DeclaredFace } from './helpers/heritageFaces'
import { covers } from './helpers/woff2'

const SHEET = 'src/styles/themes/heritage.css'
const BUDGET = 110_000

/** The characters of English text, space to tilde: what every page in the look sets. */
const ENGLISH = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => 0x20 + i)
const coversEnglish = (range: string) => range === '' || ENGLISH.every((codePoint) => covers(range, codePoint))
const sameRange = (a: string, b: string) => a.replace(/\s+/g, '').toUpperCase() === b.replace(/\s+/g, '').toUpperCase()
const bytes = (path: string) => statSync(join(ROOT, path)).size

/** Every face the package's own stylesheets declare, for the package that holds `file`. */
function packageFaces(file: string): DeclaredFace[] {
  const root = dirname(dirname(file))
  return readdirSync(join(ROOT, root))
    .filter((name) => name.endsWith('.css'))
    .flatMap((name) => declaredFaces(readFileSync(join(ROOT, root, name), 'utf8'), join(root, name)))
}

interface Budget {
  roman: DeclaredFace[]
  italic: DeclaredFace[]
  /** The bytes of the roman faces' woff2 files. */
  sum: number
  problems: string[]
}

/** What a stylesheet's faces cost, and what is wrong with them. */
function budget(css: string): Budget {
  const faces = declaredFaces(css, SHEET)
  const withFiles = faces.filter((face) => face.files.length > 0)
  const roman = withFiles.filter((face) => face.style === 'normal')
  const italic = withFiles.filter((face) => face.style === 'italic')
  const problems: string[] = []

  for (const face of withFiles) {
    if (!face.woff2) problems.push(`${face.family} (${face.style}) names no woff2 file`)
    else if (!onDisk(face.woff2)) problems.push(`${face.woff2} is not on disk`)
    if (face.files[0] !== face.woff2) problems.push(`${face.family} (${face.style}) names another format before its woff2`)
  }
  for (const [style, list] of [['normal', roman], ['italic', italic]] as const) {
    const families = new Map<string, number>()
    for (const face of list) families.set(face.family, (families.get(face.family) ?? 0) + 1)
    for (const [family, count] of families) if (count > 1) problems.push(`${family} has ${count} ${style} faces`)
  }
  for (const face of withFiles.filter((f) => f.woff2 && onDisk(f.woff2))) {
    if (!coversEnglish(face.range)) problems.push(`${face.woff2} is declared for a range without English text`)
    const own = packageFaces(face.woff2).filter((f) => f.woff2 === face.woff2)
    if (own.length === 0) problems.push(`no stylesheet of its package names ${face.woff2}`)
    for (const f of own) {
      if (!coversEnglish(f.range)) problems.push(`${face.woff2} is not the package's latin file (${f.from} gives it ${f.range})`)
      if (f.style !== face.style) problems.push(`${face.woff2} is the package's ${f.style} file, declared ${face.style}`)
    }
    const ranged = own.filter((f) => f.range !== '')
    if (face.from === SHEET && ranged.length > 0 && !ranged.every((f) => sameRange(f.range, face.range))) {
      problems.push(`${face.woff2} is declared with a range its package does not give it`)
    }
  }
  const romanFiles = new Set(roman.map((face) => face.woff2))
  for (const face of italic) if (romanFiles.has(face.woff2)) problems.push(`${face.woff2} is named by a roman face as well`)
  const sum = [...romanFiles].filter((file) => file && onDisk(file)).reduce((total, file) => total + bytes(file), 0)
  if (sum > BUDGET) problems.push(`the roman files come to ${sum} bytes, over ${BUDGET}`)
  return { roman, italic, sum, problems }
}

const real = read(SHEET)
const now = budget(real)

describe('the heritage faces, as the build follows them', () => {
  it('declare one roman face each for Libre Caslon Display and Source Serif 4, and one italic, Source Serif 4\'s', () => {
    expect(now.roman.map((face) => face.family).sort()).toEqual(['Libre Caslon Display', 'Source Serif 4 Variable'])
    expect(now.italic.map((face) => face.family)).toEqual(['Source Serif 4 Variable'])
    expect(now.problems).toEqual([])
  })

  it('name the latin file of each package, each the face the package itself gives English text', () => {
    for (const face of [...now.roman, ...now.italic]) {
      expect(face.woff2, face.family).toMatch(/-latin-[\w-]+\.woff2$/)
      expect(face.woff2, face.family).not.toMatch(/-latin-ext-/)
    }
    // Source Serif's files have the weight axis only: not the larger files that add the optical size.
    for (const face of [...now.roman, ...now.italic].filter((f) => f.family.startsWith('Source Serif'))) expect(face.woff2).toMatch(/-wght-(normal|italic)\.woff2$/)
  })

  it('come to 110,000 bytes or less in their roman woff2 files, the files a browser fetches for roman text', () => {
    const files = now.roman.map((face) => face.woff2)
    expect(now.sum).toBe(files.reduce((total, file) => total + bytes(file), 0))
    expect(now.sum).toBeGreaterThan(0)
    expect(now.sum).toBeLessThanOrEqual(BUDGET)
  })

  it('declare the italic, named by an italic face only, outside the sum', () => {
    const [italic] = now.italic
    expect(italic.woff2).toMatch(/-italic\.woff2$/)
    expect(now.roman.some((face) => face.woff2 === italic.woff2)).toBe(false)
    const withItalic = now.sum + bytes(italic.woff2)
    expect(withItalic).toBeGreaterThan(now.sum)
  })

  it('name a woff file only after its woff2, so a browser that reads woff2 never fetches it, and count no woff', () => {
    for (const face of [...now.roman, ...now.italic]) {
      expect(face.files[0], face.family).toBe(face.woff2)
      for (const file of face.files.slice(1)) expect(file, face.family).toMatch(/\.woff$/)
    }
  })

  it('give the fallback faces no file, only a face of the device\'s own', () => {
    const fallbacks = declaredFaces(real, SHEET).filter((face) => face.files.length === 0)
    expect(fallbacks.length).toBeGreaterThanOrEqual(3)
    for (const face of fallbacks) {
      expect(face.local.length, face.family).toBeGreaterThan(0)
      expect(face.family).toMatch(/ Fallback$/)
    }
  })
})

describe('the budget check on planted stylesheets', () => {
  const serif = 'source-serif-4'

  it('fails on an extra file: the optical size file beside the weight one', () => {
    const extra = `${real}\n@font-face { font-family: 'Source Serif 4 Variable'; font-style: normal; font-weight: 200 900; src: url("@fontsource-variable/${serif}/files/${serif}-latin-opsz-normal.woff2") format("woff2-variations"); }`
    const { problems, sum } = budget(extra)
    expect(sum).toBeGreaterThan(BUDGET)
    expect(problems).toContain('Source Serif 4 Variable has 2 normal faces')
    expect(problems.some((p) => p.startsWith('the roman files come to'))).toBe(true)
  })

  it('fails on a planted subset: both of Caslon\'s subsets imported in place of the latin one', () => {
    const both = real.replace('/latin-400.css', '/400.css')
    expect(both).not.toBe(real)
    const { problems } = budget(both)
    expect(problems).toContain('Libre Caslon Display has 2 normal faces')
    expect(problems.some((p) => p.includes('latin-ext') && p.includes('without English text'))).toBe(true)
  })

  it('fails on another subset in place of the latin file', () => {
    const swapped = real.replace(`${serif}-latin-wght-normal.woff2`, `${serif}-latin-ext-wght-normal.woff2`)
    expect(swapped).not.toBe(real)
    expect(budget(swapped).problems.some((p) => p.includes("is not the package's latin file"))).toBe(true)
  })

  it('fails when the italic is declared as roman, which would count it and fetch it for roman text', () => {
    const roman = real.replace(/font-style:\s*italic;\s*font-display/, 'font-style: normal;\n  font-display')
    expect(roman).not.toBe(real)
    const { problems, sum } = budget(roman)
    expect(problems).toContain('Source Serif 4 Variable has 2 normal faces')
    expect(problems.some((p) => p.includes("is the package's italic file"))).toBe(true)
    expect(sum).toBeGreaterThan(BUDGET)
  })

  it('fails on a range the package does not give the file', () => {
    const narrowed = real.replace(/unicode-range: U\+0000-00FF,/, 'unicode-range: U+0000-007F,')
    expect(narrowed).not.toBe(real)
    expect(budget(narrowed).problems.some((p) => p.includes('with a range its package does not give it'))).toBe(true)
  })
})
