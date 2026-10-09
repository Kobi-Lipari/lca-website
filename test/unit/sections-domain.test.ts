// test/unit/sections-domain.test.ts
//
// The pure parts of the one section writer (K2b):
// - domain/events/sections.ts: reading legacy JSON, the JSON shape the
//   writer stores, repeated names, the refusal messages and tier prices
// - the request schema for a section in domain/contracts/events.ts
// - the helpers in functions/utils/events/sectionsRepo.ts that need no
//   database: the row columns for a legacy element (checked here against
//   the 0053 trigger itself on node:sqlite), the report settings key move,
//   new ids and the temporary rename name
import { describe, expect, it } from 'vitest'
import {
  SECTION_NAME_MAX,
  asSectionInput,
  normalizeLegacySections,
  repeatedSectionName,
  sectionHasEntriesMessage,
  sectionFeeOverrides,
  sectionHasGamesMessage,
  sectionListProblem,
  tierFees,
  toLegacySection,
  type LegacySection,
} from '../../domain/events/sections'
import { savedSectionSchema, sectionListItemSchema, sectionSchema } from '../../domain/contracts/events'
import {
  columnsFromLegacy,
  newSectionId,
  renameReportSettingsKeys,
  temporarySectionName,
} from '../../functions/utils/events/sectionsRepo'
import { openMigratedDb } from './helpers/sqlite'

describe('normalizeLegacySections', () => {
  it('reads text or a parsed value; strings are names, objects keep their keys', () => {
    const json = '["Open",{"name":"U1400","entryFee":20,"note":"x"}]'
    expect(normalizeLegacySections(json)).toEqual([{ name: 'Open' }, { name: 'U1400', entryFee: 20, note: 'x' }])
    expect(normalizeLegacySections(JSON.parse(json))).toEqual(normalizeLegacySections(json))
  })

  it('gives no sections for malformed JSON, a non-array, null or a number', () => {
    for (const value of ['[{"name":"Open"', '{"name":"Open"}', 'null', null, undefined, 42, { name: 'Open' }]) {
      expect(normalizeLegacySections(value)).toEqual([])
    }
  })

  it('skips elements without a text name or with an empty one, and keeps the first of a repeated name, untrimmed', () => {
    expect(normalizeLegacySections([
      { name: 'Open', entryFee: 1 }, { entryFee: 5 }, { name: 7 }, { name: '' }, '', null, 3, ['x'],
      { name: 'Open', entryFee: 2 }, ' Reserve',
    ])).toEqual([{ name: 'Open', entryFee: 1 }, { name: ' Reserve' }])
  })

  it('returns copies, so changing one does not change the input', () => {
    const input = [{ name: 'Open', entryFee: 1 }]
    normalizeLegacySections(input)[0].entryFee = 99
    expect(input[0].entryFee).toBe(1)
  })
})

describe('toLegacySection: the JSON keeps today\'s shape', () => {
  it('drops id, cap and fees and undefined values, and keeps every other key in order, nulls included', () => {
    const element = toLegacySection({
      id: 'abc', name: 'Open', entryFee: 40, cap: 30, fees: { early: 30 }, prizeFund: undefined, rulesSet: null, note: 'kept',
    })
    expect(element).toEqual({ name: 'Open', entryFee: 40, rulesSet: null, note: 'kept' })
    expect(Object.keys(element)).toEqual(['name', 'entryFee', 'rulesSet', 'note'])
  })

  it('leaves what tournament-edit.test.ts sends exactly as sent', () => {
    const sent = [{ name: 'Open', entryFee: 40, prizeFund: '$700' }, { name: 'U1400', entryFee: 30 }]
    expect(sent.map(toLegacySection)).toEqual(sent)
  })

  it('keeps a bare name a bare name; the section it stands for is { name }', () => {
    expect(toLegacySection('Open')).toBe('Open')
    expect(asSectionInput('Open')).toEqual({ name: 'Open' })
    const section = { name: 'U1400', entryFee: 20 }
    expect(asSectionInput(section)).toBe(section)
  })
})

describe('names', () => {
  it('repeatedSectionName finds the first repeat, matching exactly', () => {
    expect(repeatedSectionName(['Open', 'U1400', 'Open', 'U1400'])).toBe('Open')
    expect(repeatedSectionName(['Open', 'open', 'Open '])).toBeNull()
    expect(repeatedSectionName([])).toBeNull()
  })

  it('sectionListProblem names the problem in plain words', () => {
    expect(sectionListProblem([{ name: 'Open' }, { name: 'U1400' }])).toBeNull()
    expect(sectionListProblem([])).toBeNull()
    expect(sectionListProblem([{ name: 'Open' }, { name: 'Open' }])).toBe('Two sections are named “Open”. Give each section its own name.')
    expect(sectionListProblem([{ name: '   ' }])).toBe('Every section needs a name.')
    expect(sectionListProblem([{ name: 'x'.repeat(SECTION_NAME_MAX + 1) }])).toBe('Section names can be at most 80 characters.')
    expect(sectionListProblem([{ id: 'a', name: 'Open' }, { id: 'a', name: 'Reserve' }])).toBe('The same section is listed twice.')
  })

  it('the refusal messages for decision 7', () => {
    expect(sectionHasEntriesMessage('Reserve', 3)).toBe('3 entries are in the Reserve section. Move them to another section first.')
    expect(sectionHasEntriesMessage('Reserve', 1)).toBe('1 entry is in the Reserve section. Move it to another section first.')
    expect(sectionHasGamesMessage('Blitz')).toBe('Games have been paired in the Blitz section, so it cannot be removed.')
  })
})

describe('tierFees', () => {
  const t = { entry_fee: 25, early_deadline: '2026-10-01T23:59', early_discount: 5, late_after: '2026-10-20T12:00', late_fee: 10 }

  it('regular is the section fee, else the tournament entry fee', () => {
    expect(tierFees({ feeRegular: 40 }, t).regular).toBe(40)
    expect(tierFees({ feeRegular: null }, t).regular).toBe(25)
    expect(tierFees({}, t).regular).toBe(25)
    expect(tierFees({ feeRegular: 0 }, t).regular).toBe(0)
  })

  it('early and late are worked out from the tournament unless the section sets them', () => {
    expect(tierFees({ feeRegular: 40 }, t)).toEqual({ regular: 40, early: 35, late: 50 })
    expect(tierFees({ feeRegular: 40, feeEarly: 30, feeLate: 60 }, t)).toEqual({ regular: 40, early: 30, late: 60 })
    expect(tierFees({ feeRegular: 40, feeEarly: null, feeLate: 45 }, t)).toEqual({ regular: 40, early: 35, late: 45 })
  })

  it('no early price without a deadline or a discount, no late price without a date or a fee', () => {
    expect(tierFees({ feeRegular: 40 }, { entry_fee: 25 })).toEqual({ regular: 40, early: null, late: null })
    expect(tierFees({ feeRegular: 40 }, { ...t, early_discount: 0, late_fee: 0 })).toEqual({ regular: 40, early: null, late: null })
    expect(tierFees({ feeRegular: 40 }, { ...t, early_deadline: null, late_after: '' })).toEqual({ regular: 40, early: null, late: null })
  })

  it('a free section has no tiers of its own making, and an early price never goes below zero', () => {
    expect(tierFees({ feeRegular: 0 }, t)).toEqual({ regular: 0, early: null, late: null })
    expect(tierFees({ feeRegular: 3 }, t).early).toBe(0)
    expect(tierFees({ feeRegular: 12.5 }, { ...t, early_discount: 2.25, late_fee: 0.1 })).toEqual({ regular: 12.5, early: 10.25, late: 12.6 })
  })
})

describe('sectionSchema (a section in a create or edit request)', () => {
  it('takes a name of 1 to 80 characters, the same limit as SECTION_NAME_MAX', () => {
    expect(SECTION_NAME_MAX).toBe(80)
    expect(sectionSchema.safeParse({ name: 'Open' }).success).toBe(true)
    expect(sectionSchema.safeParse({ name: 'x'.repeat(SECTION_NAME_MAX) }).success).toBe(true)
    expect(sectionSchema.safeParse({ name: 'x'.repeat(SECTION_NAME_MAX + 1) }).success).toBe(false)
    expect(sectionSchema.safeParse({ name: '' }).success).toBe(false)
    expect(sectionSchema.safeParse({ name: '  ' }).success).toBe(false)
    expect(sectionSchema.safeParse({ entryFee: 5 }).success).toBe(false)
  })

  it('takes a cap that is a positive whole number or null', () => {
    for (const cap of [1, 40, null, undefined]) expect(sectionSchema.safeParse({ name: 'Open', cap }).success, String(cap)).toBe(true)
    for (const cap of [0, -1, 2.5, '40']) expect(sectionSchema.safeParse({ name: 'Open', cap }).success, String(cap)).toBe(false)
  })

  it('takes an optional id and early and late fees, the rule and prize fields, and keeps unknown keys', () => {
    const body = {
      id: 'a1b2c3d4e5f60718', name: 'U1400', entryFee: 20, fees: { early: 15, late: null }, prizeFund: '$200',
      ratingMax: 1399, ratingMin: null, unratedOk: true, gradeMin: null, gradeMax: null, rulesSet: true,
      prizes: { place: [{ amount: 100 }, { label: 'Trophy' }], classes: [{ label: 'Top U1000', ratingMax: 999, prizes: [{}] }] },
      note: 'kept',
    }
    const parsed = sectionSchema.safeParse(body)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual(body)
    expect(sectionSchema.safeParse({ name: 'Open', fees: { regular: '5' } }).success).toBe(false)
    expect(sectionSchema.safeParse({ name: 'Open', fees: { regular: 5, early: 4, late: 6, other: 1 } }).success).toBe(false)
    expect(sectionSchema.safeParse({ name: 'Open', entryFee: -1 }).success).toBe(false)
    expect(sectionSchema.safeParse({ name: 'Open', id: '' }).success).toBe(false)
  })

  it('takes a known key of another type as it is, as events saved before the contracts can hold one', () => {
    const old = { name: 'Reserve', entryFee: '40', prizeFund: 700, ratingMax: '1599', unratedOk: 'yes', gradeMin: 'K', rulesSet: 1, prizes: 'Trophies' }
    const parsed = sectionSchema.safeParse(old)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual(old)
    // A value of the column's own type must still be valid for it.
    expect(sectionSchema.safeParse({ name: 'Open', entryFee: -1 }).success).toBe(false)
    expect(sectionSchema.safeParse({ name: 'Open', prizes: [] }).success).toBe(false)
    expect(sectionSchema.safeParse({ name: 'Open', prizes: { place: 'first' } }).success).toBe(false)
    // id, cap and fees are new, and strict.
    expect(sectionSchema.safeParse({ name: 'Open', fees: { early: '5' } }).success).toBe(false)
  })

  it('a list element is a section or a bare name of 1 to 80 characters', () => {
    expect(sectionListItemSchema.safeParse('Open').success).toBe(true)
    expect(sectionListItemSchema.safeParse({ name: 'Open' }).success).toBe(true)
    for (const bad of ['', '  ', 'x'.repeat(SECTION_NAME_MAX + 1), 5, null]) {
      expect(sectionListItemSchema.safeParse(bad).success, String(bad)).toBe(false)
    }
  })

  it('the saved section schema is strict in its own keys, passes stored extra keys, and leaves out what the JSON element left out', () => {
    const saved = {
      id: 'a1', name: 'Open', entryFee: 25, ratingMax: null, ratingMin: null,
      gradeMin: null, gradeMax: null, rulesSet: false, cap: null, fees: { regular: 25, early: null, late: null },
    }
    expect(savedSectionSchema.safeParse(saved).success).toBe(true)
    expect(savedSectionSchema.safeParse({ ...saved, prizeFund: '$100', unratedOk: false, prizes: { place: [{ amount: 50 }] } }).success).toBe(true)
    // A key the JSON element carried that no column holds comes back as stored.
    expect(savedSectionSchema.safeParse({ ...saved, note: 'Bring a clock', maxByes: 2 }).success).toBe(true)
    expect(savedSectionSchema.safeParse({ ...saved, entryFee: '25' }).success).toBe(false)
    expect(savedSectionSchema.safeParse({ ...saved, fees: { early: null, late: null } }).success).toBe(false)
    // A page read prizeFund, unratedOk and prizes as absent or set, never null.
    for (const key of ['prizeFund', 'unratedOk', 'prizes']) {
      expect(savedSectionSchema.safeParse({ ...saved, [key]: null }).success, key).toBe(false)
    }
  })

  it('fees sent back as an answer showed them (with regular) set nothing; fees without regular are the section\'s own', () => {
    expect(sectionFeeOverrides({ name: 'Open', fees: { regular: 30, early: 25, late: 40 } })).toBeUndefined()
    expect(sectionFeeOverrides({ name: 'Open', fees: { early: 25 } })).toEqual({ early: 25 })
    expect(sectionFeeOverrides({ name: 'Open', fees: { early: null, late: null } })).toEqual({ early: null, late: null })
    expect(sectionFeeOverrides({ name: 'Open' })).toBeUndefined()
    expect(sectionSchema.safeParse({ name: 'Open', fees: { regular: 30, early: 25, late: null } }).success).toBe(true)
  })
})

describe('columnsFromLegacy matches what the 0053 trigger writes', () => {
  const elements: LegacySection[] = [
    { name: 'Open', entryFee: 40, prizeFund: '$700' },
    { name: 'U1400', entryFee: 20, ratingMax: 1399, ratingMin: 800, unratedOk: false, rulesSet: true },
    { name: 'K-5', gradeMin: 0, gradeMax: 5, unratedOk: true },
    { name: 'Prizes', entryFee: 12.5, prizes: { place: [{ amount: 100, label: '1st' }, { label: 'Trophy' }], classes: [] } },
    { name: 'Nulls', entryFee: null, prizeFund: null, ratingMax: null, unratedOk: null, rulesSet: null, prizes: null },
    { name: 'Odd', entryFee: '25' as unknown as number, ratingMax: 'U1400' as unknown as number, rulesSet: 'yes' as unknown as boolean, note: 'kept', tags: ['a', 1] },
    { name: 'Array prizes', prizes: [{ amount: 5 }], rulesSet: false },
    { name: 'Bare' },
  ]

  it('for every kind of element', () => {
    const db = openMigratedDb()
    db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee, sections) VALUES ('t', 'T', 'Kenner, LA', '2026-10-24', 25, ?)`)
      .run(JSON.stringify(elements))
    const rows = db.prepare(`SELECT name, position, fee_regular, prize_fund, rating_min, rating_max, unrated_ok, grade_min, grade_max, rules_set, prizes_json, extra_json
      FROM tournament_sections WHERE tournament_id = 't' AND archived_at IS NULL ORDER BY position`).all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(elements.length)
    rows.forEach((row, i) => {
      const c = columnsFromLegacy(elements[i])
      expect({ ...row, prizes_json: row.prizes_json && JSON.parse(row.prizes_json as string), extra_json: row.extra_json && JSON.parse(row.extra_json as string) }, elements[i].name).toEqual({
        name: elements[i].name,
        position: i,
        fee_regular: c.feeRegular,
        prize_fund: c.prizeFund,
        rating_min: c.ratingMin,
        rating_max: c.ratingMax,
        unrated_ok: c.unratedOk,
        grade_min: c.gradeMin,
        grade_max: c.gradeMax,
        rules_set: c.rulesSet,
        prizes_json: c.prizesJson && JSON.parse(c.prizesJson),
        extra_json: c.extraJson && JSON.parse(c.extraJson),
      })
      // The text itself, not only its value, so the trigger has nothing to rewrite.
      expect(row.extra_json, elements[i].name).toBe(c.extraJson)
      expect(row.prizes_json, elements[i].name).toBe(c.prizesJson)
    })
  })

  it('keeps a known key of the wrong type, and any unknown key, in extra_json', () => {
    expect(columnsFromLegacy({ name: 'Odd', entryFee: '25' as unknown as number, note: 'kept' })).toMatchObject({
      feeRegular: null, extraJson: '{"entryFee":"25","note":"kept"}',
    })
    expect(columnsFromLegacy({ name: 'Plain', entryFee: 5 })).toMatchObject({ feeRegular: 5, extraJson: null, rulesSet: 0, unratedOk: null })
  })
})

describe('renameReportSettingsKeys', () => {
  const settings = JSON.stringify({ affiliateId: 'A1', sections: { Open: { r: 1 }, U1400: { r: 2 }, K5: { r: 3 } } })

  it('moves keys, all at once so a swap works', () => {
    const swapped = renameReportSettingsKeys(settings, new Map([['Open', 'U1400'], ['U1400', 'Open']]))
    expect(JSON.parse(swapped as string)).toEqual({ affiliateId: 'A1', sections: { U1400: { r: 1 }, Open: { r: 2 }, K5: { r: 3 } } })
  })

  it('replaces a stale key holding the new name', () => {
    const text = JSON.stringify({ sections: { Old: { r: 9 }, Open: { r: 1 } } })
    expect(JSON.parse(renameReportSettingsKeys(text, new Map([['Open', 'Old']])) as string)).toEqual({ sections: { Old: { r: 1 } } })
  })

  it('leaves alone null, malformed text, settings without a sections object, no renames, and a result past 8000 characters', () => {
    const rename = new Map([['Open', 'Main']])
    expect(renameReportSettingsKeys(null, rename)).toBeNull()
    expect(renameReportSettingsKeys('{not json', rename)).toBe('{not json')
    expect(renameReportSettingsKeys('{"sections":[1]}', rename)).toBe('{"sections":[1]}')
    expect(renameReportSettingsKeys('[]', rename)).toBe('[]')
    expect(renameReportSettingsKeys(settings, new Map())).toBe(settings)
    expect(renameReportSettingsKeys(settings, new Map([['Nobody', 'Main']]))).toBe(settings)
    const full = JSON.stringify({ pad: 'x'.repeat(7965), sections: { Open: 1 } })
    expect(full.length).toBeLessThanOrEqual(8000)
    expect(renameReportSettingsKeys(full, new Map([['Open', 'Championship Section']]))).toBe(full)
  })
})

describe('ids and temporary names', () => {
  it('new ids are 16 hex characters and differ', () => {
    const ids = Array.from({ length: 200 }, newSectionId)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/)
    expect(new Set(ids).size).toBe(200)
  })

  it('a temporary name is longer than any section name and holds the row id', () => {
    const name = temporarySectionName('a1b2c3d4e5f60718')
    expect(name.length).toBeGreaterThan(SECTION_NAME_MAX)
    expect(name).toContain('a1b2c3d4e5f60718')
    expect(temporarySectionName('x')).not.toBe(temporarySectionName('y'))
    expect(sectionSchema.safeParse({ name }).success).toBe(false)
  })
})
