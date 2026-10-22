// test/unit/helpers/woff2.ts
//
// Reads a font file the way a browser picks and draws from it, without a
// browser: which file an @font-face unicode-range sends a character to, and,
// inside a WOFF2 file, the font's own tables (its character map, its
// metrics and the OpenType features it offers).
//
// The table and character map reader is the one in
// test/unit/geist-mono-glyphs.test.ts, copied here so other tests can share
// it, with every table tag WOFF2 knows by number, so GSUB and the rest can
// be found too.
import { brotliDecompressSync } from 'node:zlib'

/** Whether a unicode-range list covers a code point. */
export function covers(range: string, codePoint: number): boolean {
  return range.split(',').some((part) => {
    const [from, to] = part.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16))
    return codePoint >= from && codePoint <= (to ?? from)
  })
}

/** The tags WOFF2 gives a number to in a table's flags byte, in order (63 means the tag follows). */
const WOFF2_KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
]

/** The raw bytes of every table of a WOFF2 file, by tag, and whether each was stored transformed. */
export function woff2Tables(file: Buffer): Map<string, { bytes: Buffer; transformed: boolean }> {
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
  const tables: Array<{ tag: string; size: number; transformed: boolean }> = []
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
    tables.push({ tag: tag ?? `#${flags & 0x3f}`, size, transformed })
  }
  const data = brotliDecompressSync(file.subarray(at, at + compressedSize))
  const out = new Map<string, { bytes: Buffer; transformed: boolean }>()
  let offset = 0
  for (const t of tables) {
    out.set(t.tag, { bytes: data.subarray(offset, offset + t.size), transformed: t.transformed })
    offset += t.size
  }
  return out
}

/** The raw bytes of one table of a WOFF2 file. */
export function woff2Table(file: Buffer, wanted: string): Buffer {
  const table = woff2Tables(file).get(wanted)
  if (!table) throw new Error(`no ${wanted} table`)
  return table.bytes
}

/** The glyph a cmap table maps a code point to (formats 4 and 12), or 0 when it maps none. */
export function cmapGlyph(cmap: Buffer, codePoint: number): number {
  const count = cmap.readUInt16BE(2)
  for (let i = 0; i < count; i++) {
    const offset = cmap.readUInt32BE(4 + i * 8 + 4)
    const format = cmap.readUInt16BE(offset)
    if (format === 12) {
      const groups = cmap.readUInt32BE(offset + 12)
      for (let g = 0; g < groups; g++) {
        const at = offset + 16 + g * 12
        const start = cmap.readUInt32BE(at)
        if (codePoint >= start && codePoint <= cmap.readUInt32BE(at + 4)) return cmap.readUInt32BE(at + 8) + (codePoint - start)
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
        const delta = cmap.readUInt16BE(deltas + s * 2)
        const ro = cmap.readUInt16BE(rangeOffsets + s * 2)
        if (ro === 0) return (codePoint + delta) & 0xffff
        const glyph = cmap.readUInt16BE(rangeOffsets + s * 2 + ro + (codePoint - start) * 2)
        return glyph === 0 ? 0 : (glyph + delta) & 0xffff
      }
    }
  }
  return 0
}

/** Whether a cmap table maps a code point to a glyph. */
export function cmapHas(cmap: Buffer, codePoint: number): boolean {
  return cmapGlyph(cmap, codePoint) !== 0
}

/** The feature tags a GSUB or GPOS table offers (smcp, tnum, kern and so on). */
export function layoutFeatures(table: Buffer): Set<string> {
  const list = table.readUInt16BE(6)
  const count = table.readUInt16BE(list)
  const tags = new Set<string>()
  for (let i = 0; i < count; i++) tags.add(table.toString('latin1', list + 2 + i * 6, list + 6 + i * 6))
  return tags
}

/** A font's size in units, its line metrics (hhea) and the advance of one character, in units. */
export function fontMetrics(file: Buffer) {
  const tables = woff2Tables(file)
  const head = tables.get('head')!.bytes
  const hhea = tables.get('hhea')!.bytes
  const hmtx = tables.get('hmtx')!
  if (hmtx.transformed) throw new Error('the hmtx table is stored transformed')
  const cmap = tables.get('cmap')!.bytes
  const longMetrics = hhea.readUInt16BE(34)
  return {
    unitsPerEm: head.readUInt16BE(18),
    ascent: hhea.readInt16BE(4),
    descent: hhea.readInt16BE(6),
    lineGap: hhea.readInt16BE(8),
    advance(codePoint: number): number {
      const glyph = cmapGlyph(cmap, codePoint)
      if (!glyph) throw new Error(`no glyph for U+${codePoint.toString(16).toUpperCase()}`)
      return hmtx.bytes.readUInt16BE(4 * Math.min(glyph, longMetrics - 1))
    },
  }
}
