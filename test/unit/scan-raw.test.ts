// test/unit/scan-raw.test.ts — turning the vision model's reply into a RawScan.
import { describe, expect, it } from 'vitest'
import { extractJson, parseModelReply, toRawScan } from '../../functions/utils/scan/rawScan'
import { toBase64 } from '../../functions/utils/scan/extract'

const minimal = { header: { legibility: 'clear' }, rows: [{ n: 1, white: { raw: 'e4', confidence: 'high' }, black: null }] }

describe('extractJson', () => {
  it('reads plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('strips code fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('finds the object inside surrounding prose', () => {
    expect(extractJson('Sure! Here it is: {"a":{"b":2}} Hope that helps.')).toEqual({ a: { b: 2 } })
  })

  it('gives up on text with no object', () => {
    expect(extractJson('I cannot read this image.')).toBeUndefined()
    expect(extractJson('{ broken')).toBeUndefined()
  })
})

describe('toRawScan', () => {
  it('keeps a well-formed scan as it is', () => {
    const result = toRawScan(minimal)
    expect(result).toEqual({ ok: true, scan: minimal })
  })

  it('rejects a reply with no rows unless the sheet was unreadable', () => {
    expect(toRawScan({ header: { legibility: 'clear' } }).ok).toBe(false)
    expect(toRawScan({ header: { legibility: 'unreadable' } })).toEqual({
      ok: true,
      scan: { header: { legibility: 'unreadable' }, rows: [] },
    })
  })

  it('rejects things that are not objects', () => {
    expect(toRawScan(null).ok).toBe(false)
    expect(toRawScan([minimal]).ok).toBe(false)
    expect(toRawScan('scan').ok).toBe(false)
  })

  it('defaults a missing or invented legibility to partial', () => {
    const noHeader = toRawScan({ rows: [] })
    expect(noHeader.ok && noHeader.scan.header.legibility).toBe('partial')
    const odd = toRawScan({ header: { legibility: 'mostly fine' }, rows: [] })
    expect(odd.ok && odd.scan.header.legibility).toBe('partial')
  })

  it('turns numeric header fields into strings and drops empty ones', () => {
    const result = toRawScan({
      header: { legibility: 'clear', whiteRating: 1843, round: 3, event: '  ', board: null },
      rows: [],
    })
    expect(result.ok && result.scan.header).toEqual({ legibility: 'clear', whiteRating: '1843', round: '3' })
  })

  it('ignores header fields that are not in the contract', () => {
    const result = toRawScan({ header: { legibility: 'clear', favouriteOpening: 'Najdorf' }, rows: [] })
    expect(result.ok && result.scan.header).toEqual({ legibility: 'clear' })
  })

  it('treats blank, empty and malformed cells as blank', () => {
    const result = toRawScan({
      header: { legibility: 'clear' },
      rows: [
        { n: 1, white: { raw: '', confidence: 'high' }, black: { confidence: 'low' } },
        { n: 2, white: 42, black: undefined },
      ],
    })
    expect(result.ok && result.scan.rows).toEqual([
      { n: 1, white: null, black: null },
      { n: 2, white: null, black: null },
    ])
  })

  it('accepts a bare string as a cell, at low confidence', () => {
    const result = toRawScan({ header: { legibility: 'clear' }, rows: [{ n: 1, white: 'e4', black: 'c5' }] })
    expect(result.ok && result.scan.rows[0]).toEqual({
      n: 1,
      white: { raw: 'e4', confidence: 'low' },
      black: { raw: 'c5', confidence: 'low' },
    })
  })

  it('never upgrades an unlabelled confidence', () => {
    const result = toRawScan({ header: { legibility: 'clear' }, rows: [{ n: 1, white: { raw: 'e4', confidence: 'certain' }, black: null }] })
    expect(result.ok && result.scan.rows[0].white?.confidence).toBe('low')
  })

  it('cleans alternatives: strings only, no repeats, not the raw reading itself', () => {
    const result = toRawScan({
      header: { legibility: 'clear' },
      rows: [{ n: 1, white: { raw: 'Nf3', alts: ['Nf5', 'Nf3', 'Nf5', 7, '', 'Hf3'], confidence: 'medium' }, black: null }],
    })
    expect(result.ok && result.scan.rows[0].white?.alts).toEqual(['Nf5', '7', 'Hf3'])
  })

  it('keeps struck only when it is literally true', () => {
    const result = toRawScan({
      header: { legibility: 'clear' },
      rows: [{ n: 1, white: { raw: 'e4', confidence: 'high', struck: 'yes' }, black: { raw: 'e5', confidence: 'high', struck: true } }],
    })
    expect(result.ok && result.scan.rows[0].white?.struck).toBeUndefined()
    expect(result.ok && result.scan.rows[0].black?.struck).toBe(true)
  })

  it('does not correct the transcription, even when it is illegal chess', () => {
    // The parser is shape-checking only. Chess legality belongs to the decoder.
    const result = toRawScan({ header: { legibility: 'clear' }, rows: [{ n: 1, white: { raw: 'Ke9??', confidence: 'high' }, black: null }] })
    expect(result.ok && result.scan.rows[0].white?.raw).toBe('Ke9??')
  })

  it('drops rows without a usable move number and sorts the rest', () => {
    const result = toRawScan({
      header: { legibility: 'clear' },
      rows: [
        { n: 3, white: 'Bb5', black: null },
        { n: '1', white: 'e4', black: null },
        { white: 'orphan', black: null },
        { n: 0, white: 'zero', black: null },
        { n: 2.5, white: 'half', black: null },
        { n: 2, white: 'Nf3', black: null },
      ],
    })
    expect(result.ok && result.scan.rows.map((r) => r.n)).toEqual([1, 2, 3])
  })

  it('caps a runaway reply', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ n: i + 1, white: 'e4', black: null }))
    const result = toRawScan({ header: { legibility: 'clear' }, rows })
    expect(result.ok && result.scan.rows.length).toBe(200)
  })

  it('keeps sheet notes that are text, and leaves the field out when none are', () => {
    const withNotes = toRawScan({ header: { legibility: 'clear' }, rows: [], sheetNotes: ['continued on back', 5, ''] })
    expect(withNotes.ok && withNotes.scan.sheetNotes).toEqual(['continued on back', '5'])
    const without = toRawScan({ header: { legibility: 'clear' }, rows: [], sheetNotes: [] })
    expect(without.ok && 'sheetNotes' in without.scan).toBe(false)
  })
})

describe('parseModelReply', () => {
  it('goes from fenced text to a scan', () => {
    const result = parseModelReply('```\n' + JSON.stringify(minimal) + '\n```')
    expect(result).toEqual({ ok: true, scan: minimal })
  })

  it('reports prose as not JSON', () => {
    expect(parseModelReply('Sorry, I cannot do that.')).toEqual({ ok: false, reason: 'reply was not valid JSON' })
  })
})

describe('toBase64', () => {
  it('matches btoa for small input', () => {
    const bytes = new TextEncoder().encode('scoresheet')
    expect(toBase64(bytes.buffer)).toBe(btoa('scoresheet'))
  })

  it('handles input larger than one chunk', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256)
    const decoded = Uint8Array.from(atob(toBase64(bytes.buffer)), (c) => c.charCodeAt(0))
    expect(decoded).toEqual(bytes)
  })
})
