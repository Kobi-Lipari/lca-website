// Geist Mono has the glyphs the plain-language rules need (WS01 step 21).
//
// A half is written ½, never .5, and the figures in a font-mono cell are
// Geist Mono's own only if the browser can draw them from the font it
// downloads. The browser picks which file to fetch from each @font-face
// unicode-range, so this reads the real font files: it finds the file whose
// range covers ½ (U+00BD) and checks the font's character map holds it, and
// that the digits and the minus sign used in scores are there as well.
import { brotliDecompressSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRules, read, ROOT } from './helpers/cssTokens'

const PACKAGE = 'node_modules/@fontsource-variable/geist-mono'

/** Whether a unicode-range list covers a code point. */
function covers(range: string, codePoint: number): boolean {
  return range.split(',').some((part) => {
    const [from, to] = part.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16))
    return codePoint >= from && codePoint <= (to ?? from)
  })
}

const WOFF2_KNOWN_TAGS: Record<number, string> = { 0: 'cmap', 1: 'head', 2: 'hhea', 3: 'hmtx', 4: 'maxp', 5: 'name', 6: 'OS/2', 7: 'post', 10: 'glyf', 11: 'loca' }

/** The raw bytes of one table of a WOFF2 file. */
function woff2Table(file: Buffer, wanted: string): Buffer {
  if (file.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file')
  const numTables = file.readUInt16BE(12)
  const compressedSize = file.readUInt32BE(20)
  let at = 48
  const base128 = () => {
    let value = 0
    for (let i = 0; i < 5; i++) {
      const byte = file[at++]
      value = value * 128 + (byte & 0x7f)
      if (!(byte & 0x80)) return value
    }
    throw new Error('bad UIntBase128')
  }
  const tables: Array<{ tag: string; size: number }> = []
  for (let i = 0; i < numTables; i++) {
    const flags = file[at++]
    let tag = WOFF2_KNOWN_TAGS[flags & 0x3f]
    if ((flags & 0x3f) === 0x3f) {
      tag = file.toString('latin1', at, at + 4)
      at += 4
    }
    const version = flags >> 6
    const origLength = base128()
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0
    const size = transformed ? base128() : origLength
    tables.push({ tag: tag ?? `#${flags & 0x3f}`, size })
  }
  const data = brotliDecompressSync(file.subarray(at, at + compressedSize))
  let offset = 0
  for (const t of tables) {
    if (t.tag === wanted) return data.subarray(offset, offset + t.size)
    offset += t.size
  }
  throw new Error(`no ${wanted} table`)
}

/** Whether a cmap table maps a code point to a glyph (formats 4 and 12). */
function cmapHas(cmap: Buffer, codePoint: number): boolean {
  const count = cmap.readUInt16BE(2)
  for (let i = 0; i < count; i++) {
    const offset = cmap.readUInt32BE(4 + i * 8 + 4)
    const format = cmap.readUInt16BE(offset)
    if (format === 12) {
      const groups = cmap.readUInt32BE(offset + 12)
      for (let g = 0; g < groups; g++) {
        const at = offset + 16 + g * 12
        if (codePoint >= cmap.readUInt32BE(at) && codePoint <= cmap.readUInt32BE(at + 4) && cmap.readUInt32BE(at + 8) + (codePoint - cmap.readUInt32BE(at)) > 0) return true
      }
    } else if (format === 4 && codePoint <= 0xffff) {
      const segX2 = cmap.readUInt16BE(offset + 6)
      const ends = offset + 14
      const starts = ends + segX2 + 2
      const deltas = starts + segX2
      const rangeOffsets = deltas + segX2
      for (let s = 0; s < segX2 / 2; s++) {
        const end = cmap.readUInt16BE(ends + s * 2)
        const start = cmap.readUInt16BE(starts + s * 2)
        if (codePoint < start || codePoint > end) continue
        const ro = cmap.readUInt16BE(rangeOffsets + s * 2)
        if (ro === 0) return ((codePoint + cmap.readUInt16BE(deltas + s * 2)) & 0xffff) !== 0
        const glyphAt = rangeOffsets + s * 2 + ro + (codePoint - start) * 2
        return cmap.readUInt16BE(glyphAt) !== 0
      }
    }
  }
  return false
}

describe('Geist Mono, as the browser will fetch it', () => {
  const faces = parseRules(read(`${PACKAGE}/index.css`)).filter((r) => r.selector === '@font-face' && r.decls.get('font-style') === 'normal')
  const half = faces.filter((f) => covers(f.decls.get('unicode-range') ?? '', 0x00bd))

  it('has exactly one face whose range covers ½, and it is the latin file', () => {
    expect(half).toHaveLength(1)
    expect(half[0].decls.get('src')).toContain('geist-mono-latin-wght-normal.woff2')
  })

  const latin = readFileSync(join(ROOT, PACKAGE, 'files/geist-mono-latin-wght-normal.woff2'))
  const cmap = woff2Table(latin, 'cmap')

  it('draws ½ itself, so a half is never typeset as .5', () => {
    expect(cmapHas(cmap, 0x00bd)).toBe(true)
  })

  it('draws the digits, the minus sign, the colon and the en dash that scores and times use', () => {
    for (const ch of '0123456789:+-.') expect(cmapHas(cmap, ch.charCodeAt(0)), ch).toBe(true)
    expect(cmapHas(cmap, 0x2212), 'minus sign').toBe(true)
    expect(cmapHas(cmap, 0x2013), 'en dash').toBe(true)
  })

  it('reads the character map correctly: a code point the font lacks is reported missing', () => {
    expect(cmapHas(cmap, 0x25cb)).toBe(false) // white circle
    expect(cmapHas(cmap, 0x4e2d)).toBe(false) // a CJK ideograph
  })
})

// The colour marks of a result cell (WS01 step 27). The boards write White
// and Black as ○ and ● (U+25CB and U+25CF). No file of the face covers
// either in its range, so a browser would draw them from whatever font the
// device has, and no file's character map holds them either; so
// src/components/ResultCell.tsx draws them as shapes instead.
describe('the colour marks, which the face does not have', () => {
  const faces = parseRules(read(`${PACKAGE}/index.css`)).filter((r) => r.selector === '@font-face' && r.decls.get('font-style') === 'normal')
  const MARKS: Array<[string, number]> = [['white circle', 0x25cb], ['black circle', 0x25cf]]

  it('has six files: latin, latin-ext, cyrillic, cyrillic-ext, vietnamese and symbols2', () => {
    const names = faces.map((f) => f.decls.get('src')!.match(/geist-mono-([a-z0-9-]+)-wght-normal\.woff2/)![1]).sort()
    expect(names).toEqual(['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext', 'symbols2', 'vietnamese'])
  })

  it.each(MARKS)('no file covers the %s in its unicode-range', (_name, codePoint) => {
    for (const face of faces) expect(covers(face.decls.get('unicode-range') ?? '', codePoint), face.decls.get('src')).toBe(false)
  })

  it.each(MARKS)('no file\'s character map holds the %s', (_name, codePoint) => {
    for (const face of faces) {
      const file = face.decls.get('src')!.match(/files\/([\w-]+\.woff2)/)![1]
      expect(cmapHas(woff2Table(readFileSync(join(ROOT, PACKAGE, 'files', file)), 'cmap'), codePoint), file).toBe(false)
    }
  })

  it('so the result cell draws the marks as shapes, and never types either character', () => {
    const cell = read('src/components/ResultCell.tsx').replace(/\/\/.*$/gm, '')
    expect(cell).toContain('<circle')
    expect(cell).not.toMatch(/[○●]/)
  })
})
