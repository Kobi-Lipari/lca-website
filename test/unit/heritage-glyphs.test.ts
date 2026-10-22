// The heritage faces have the glyphs the plain-language rules need (WS01
// step 30).
//
// Inside the heritage look, headings and display figures are set in Libre
// Caslon Display and reading text in Source Serif 4, from the latin files
// src/styles/themes/heritage.css names. A half is written ½, never .5, a
// span of figures takes an en dash, a negative figure the minus sign, and a
// figure keeps to its unit with a no-break space; each must come from the
// face itself, not from whatever font the device has. This reads the real
// files, roman and italic: each draws ½ (U+00BD), the en dash, the minus
// sign, the ten digits and the no-break space; neither face draws the white
// or the black circle (U+25CB, U+25CF), so a result cell keeps drawing its
// colour marks as shapes in every look, as the fixed-width face's own test
// finds for chess data; and in each package's full stylesheet the one face
// whose range covers ½ is the latin file the look names. Neither latin file
// has true small capitals (no smcp or c2sc feature), which is why the small
// capitals class sets capitals at 0.85em instead of asking for them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { read, ROOT } from './helpers/cssTokens'
import { declaredFaces } from './helpers/heritageFaces'
import { cmapHas, covers, layoutFeatures, woff2Table } from './helpers/woff2'

const SHEET = 'src/styles/themes/heritage.css'
const faces = declaredFaces(read(SHEET), SHEET).filter((face) => face.woff2 !== '')
const font = (file: string) => readFileSync(join(ROOT, file))

const NEEDED: Array<[string, number]> = [
  ['½ (U+00BD)', 0x00bd],
  ['the en dash (U+2013)', 0x2013],
  ['the minus sign (U+2212)', 0x2212],
  ['the no-break space (U+00A0)', 0x00a0],
  ...[...'0123456789'].map((digit): [string, number] => [`the digit ${digit}`, digit.charCodeAt(0)]),
]
const MARKS: Array<[string, number]> = [
  ['white circle (U+25CB)', 0x25cb],
  ['black circle (U+25CF)', 0x25cf],
]

describe('the faces the heritage look names', () => {
  it('are Libre Caslon Display\'s latin file and Source Serif 4\'s, roman and italic', () => {
    expect(faces.map((face) => `${face.family} ${face.style}`).sort()).toEqual([
      'Libre Caslon Display normal',
      'Source Serif 4 Variable italic',
      'Source Serif 4 Variable normal',
    ])
  })

  it.each(faces.map((face) => [face.woff2] as const))('%s draws ½, the en dash, the minus sign, the digits and the no-break space', (file) => {
    const cmap = woff2Table(font(file), 'cmap')
    for (const [name, codePoint] of NEEDED) expect(cmapHas(cmap, codePoint), name).toBe(true)
  })

  it.each(faces.map((face) => [face.woff2] as const))('%s draws neither colour mark, in its character map or its range', (file) => {
    const face = faces.find((f) => f.woff2 === file)!
    const cmap = woff2Table(font(file), 'cmap')
    for (const [name, codePoint] of MARKS) {
      expect(cmapHas(cmap, codePoint), name).toBe(false)
      if (face.range) expect(covers(face.range, codePoint), name).toBe(false)
    }
  })

  it('reads the character map correctly: a character the files lack is reported missing', () => {
    for (const face of faces) expect(cmapHas(woff2Table(font(face.woff2), 'cmap'), 0x4e2d), face.woff2).toBe(false) // a CJK ideograph
  })

  it.each(faces.map((face) => [face.woff2] as const))('%s has no true small capitals: no smcp and no c2sc feature', (file) => {
    const features = layoutFeatures(woff2Table(font(file), 'GSUB'))
    expect(features.size).toBeGreaterThan(0)
    expect(features.has('liga')).toBe(true)
    expect(features.has('smcp')).toBe(false)
    expect(features.has('c2sc')).toBe(false)
  })
})

describe('the file a browser fetches for ½', () => {
  // Each package's stylesheet of every subset, for the faces the look names.
  const FULL = [
    ['Libre Caslon Display', 'normal', 'node_modules/@fontsource/libre-caslon-display/400.css'],
    ['Source Serif 4 Variable', 'normal', 'node_modules/@fontsource-variable/source-serif-4/wght.css'],
    ['Source Serif 4 Variable', 'italic', 'node_modules/@fontsource-variable/source-serif-4/wght-italic.css'],
  ] as const

  it.each(FULL)('%s (%s): one face of %s covers ½, and it is the latin file the look names', (family, style, sheet) => {
    const all = declaredFaces(read(sheet), sheet)
    expect(all.length).toBeGreaterThan(1)
    const half = all.filter((face) => covers(face.range, 0x00bd))
    expect(half).toHaveLength(1)
    expect(half[0].woff2).toMatch(/-latin-[\w-]+\.woff2$/)
    const named = faces.find((face) => face.family === family && face.style === style)
    expect(named?.woff2).toBe(half[0].woff2)
  })
})
