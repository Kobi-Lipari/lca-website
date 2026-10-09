// There is no member price (decision D11). Beyond the wording scan in
// no-member-price-copy.test.ts, this pins the code: pricing takes no member
// argument and ignores a member option or column if one is passed anyway,
// including at the Central midnight and daylight-saving edges; and nothing
// in the site, the server handlers or the pricing module reads or writes the
// retired member_discount, memberDiscount or isLcaMember. The contract keeps
// member_discount in the row and memberDiscount in the edit request so the
// current setup form and older clients keep working.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lcaTimeToMs } from '../../domain/format/centralTime'
import { tierFees, type TierSection } from '../../domain/events/sections'
import { priceEntry, priceShownSection, type PriceTournament } from '../../domain/registration/pricing'

const ROOT = join(__dirname, '../..')

const loose = priceEntry as unknown as (...args: unknown[]) => ReturnType<typeof priceEntry>
const looseShown = priceShownSection as unknown as (...args: unknown[]) => ReturnType<typeof priceShownSection>

describe('priceEntry and priceShownSection take no member status', () => {
  const rows: Array<PriceTournament & { member_discount: number; label: string }> = [
    { label: 'regular', entry_fee: 25, member_discount: 7 },
    { label: 'early', entry_fee: 25, early_deadline: '2099-01-01', early_discount: 5, member_discount: 7 },
    { label: 'late', entry_fee: 25, late_after: '2020-01-01T00:00', late_fee: 10, member_discount: 7 },
    { label: 'free', entry_fee: 0, early_deadline: '2099-01-01', early_discount: 5, member_discount: 7 },
    { label: 'discount bigger than the fee', entry_fee: 5, member_discount: 50 },
  ]
  const section = plainSection()
  const now = Date.parse('2026-10-09T17:00:00Z')

  it.each(rows)('$label: a leftover member option or column changes nothing', ({ label: _label, ...row }) => {
    void _label
    const plain = priceEntry(section, row, now)
    expect(loose(section, row, now, true)).toEqual(plain)
    expect(loose(section, row, now, { isLcaMember: true })).toEqual(plain)
    expect(loose(section, { ...row, member_discount: 0 }, now)).toEqual(plain)
    expect(loose(section, { ...row, member_discount: 999 }, now)).toEqual(plain)
    const shown = { name: 'Open', fees: tierFees({ feeRegular: row.entry_fee }, row) }
    expect(looseShown(shown, row, now, true)).toEqual(priceShownSection(shown, row, now))
    expect(looseShown(shown, { ...row, member_discount: 0 }, now)).toEqual(priceShownSection(shown, row, now))
    expect(plain.lines.map((l) => l.label).join(' ')).not.toMatch(/member/i)
  })

  it('a section with its own early and late prices ignores member_discount too', () => {
    const t: PriceTournament & { member_discount: number } = { entry_fee: 30, early_deadline: '2099-01-01', early_discount: 5, member_discount: 12 }
    const own = tierFees({ feeRegular: 40, feeEarly: 33, feeLate: 55 }, t)
    expect(own).toMatchObject({ regular: 40, early: 33, late: 55 })
    expect(priceShownSection({ id: 's', name: 'Open', entryFee: 40, fees: own } as never, t, now).amount).toBe(33)
  })

  it('the amount is the same with and without a member option at Central midnight and both daylight-saving days', () => {
    const edges = [
      // Midnight Central, October 10, 2026, and one second either side.
      lcaTimeToMs('2026-10-10T00:00') - 1000, lcaTimeToMs('2026-10-10T00:00'), lcaTimeToMs('2026-10-10T00:00') + 1000,
      // Clocks go forward on March 8, 2026 and back on November 1, 2026.
      Date.parse('2026-03-08T07:59:59Z'), Date.parse('2026-03-08T08:00:00Z'), Date.parse('2026-03-09T04:59:59Z'), Date.parse('2026-03-09T05:00:00Z'),
      Date.parse('2026-11-02T05:59:59Z'), Date.parse('2026-11-02T06:00:00Z'),
    ]
    const dated: PriceTournament & { member_discount: number } = {
      entry_fee: 30, early_deadline: '2026-10-10', early_discount: 10, late_after: '2026-10-10T00:00', late_fee: 10, member_discount: 6,
    }
    const springAndFall = [
      { ...dated, early_deadline: '2026-03-08', late_after: '2026-03-09' },
      { ...dated, early_deadline: '2026-11-01', late_after: '2026-11-02T00:00' },
    ]
    for (const row of [dated, ...springAndFall]) {
      for (const at of edges) {
        expect(loose(plainSection(), row, at, { isLcaMember: true }), `${row.early_deadline} ${new Date(at).toISOString()}`)
          .toEqual(priceEntry(plainSection(), row, at))
      }
    }
  })
})

function plainSection(): TierSection {
  return { feeRegular: null, feeEarly: null, feeLate: null }
}

const SOURCE = /\.(ts|tsx)$/
function filesUnder(dir: string): string[] {
  const full = join(ROOT, dir)
  return readdirSync(full).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) return []
    const path = join(full, name)
    if (statSync(path).isDirectory()) return filesUnder(relative(ROOT, path))
    return SOURCE.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}
const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n')
const RETIRED = /\b(?:memberDiscount|member_discount|isLcaMember|selfIsLcaMember|LCA_MEMBER_DISCOUNT)\b/

describe('the retired member price is not read or written anywhere', () => {
  it('no page, component, hook or client helper under src mentions it', () => {
    const hits = filesUnder('src').filter((f) => RETIRED.test(withoutComments(readFileSync(f, 'utf8')))).map((f) => relative(ROOT, f))
    expect(hits).toEqual([])
  })

  it('the pricing module and the registration domain do not mention it', () => {
    const hits = filesUnder('domain/registration').filter((f) => RETIRED.test(withoutComments(readFileSync(f, 'utf8')))).map((f) => relative(ROOT, f))
    expect(hits).toEqual([])
  })

  it('no server handler, helper or scheduled worker reads or writes it', () => {
    const hits = [...filesUnder('functions'), ...filesUnder('workers')]
      .filter((f) => !/functions\/db\/schema\.ts$|functions\/types\.ts$/.test(f))
      .filter((f) => RETIRED.test(withoutComments(readFileSync(f, 'utf8'))))
      .map((f) => relative(ROOT, f))
    expect(hits).toEqual([])
  })

  it('the contract keeps member_discount in the row and memberDiscount in the edit request, nowhere else', () => {
    const lines = withoutComments(readFileSync(join(ROOT, 'domain/contracts/events.ts'), 'utf8'))
      .split('\n').filter((line) => RETIRED.test(line)).map((l) => l.trim())
    expect(lines).toEqual(['member_discount: dollarsSchema,', 'memberDiscount: z.number().nullable().optional(),'])
  })
})
