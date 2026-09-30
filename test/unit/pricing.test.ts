import { describe, expect, it } from 'vitest'
import { entryPrice } from '../../functions/utils/pricing'

const t = {
  entry_fee: 0,
  sections: JSON.stringify([{ name: 'Open', entryFee: 50 }, { name: 'Free', entryFee: 0 }]),
  early_deadline: '2026-10-10T23:59',
  early_discount: 10,
  late_after: '2026-10-16T12:00',
  late_fee: 15,
  member_discount: 5,
}
const at = (iso: string) => Date.parse(iso)

describe('entry price', () => {
  it('applies the early discount and member discount before the early deadline', () => {
    const p = entryPrice(t, 'Open', { isLcaMember: true, nowMs: at('2026-10-01T12:00:00Z') })
    expect(p.amount).toBe(35)
    expect(p.lines.map((l) => l.label)).toEqual(['Early entry discount', 'LCA member discount'])
  })

  it('charges the base fee in between and the late fee after the late date (Central time)', () => {
    expect(entryPrice(t, 'Open', { isLcaMember: false, nowMs: at('2026-10-12T12:00:00Z') }).amount).toBe(50)
    // 11:30 AM Central on the 16th is before the noon late date.
    expect(entryPrice(t, 'Open', { isLcaMember: false, nowMs: at('2026-10-16T16:30:00Z') }).amount).toBe(50)
    expect(entryPrice(t, 'Open', { isLcaMember: false, nowMs: at('2026-10-16T18:00:00Z') }).amount).toBe(65)
  })

  it('keeps free sections free', () => {
    expect(entryPrice(t, 'Free', { isLcaMember: true, nowMs: at('2026-10-01T12:00:00Z') }).amount).toBe(0)
  })
})
