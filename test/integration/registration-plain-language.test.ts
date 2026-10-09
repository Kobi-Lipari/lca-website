// test/integration/registration-plain-language.test.ts
// The words the player endpoints say to a player: "US Chess", never USCF,
// a weekday on every date, no ".5" for a half. Messages from the three
// handlers in the player flow are read here as a player would read them.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestPost as registerPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)

const WEEKDAY = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b/
const ISO_DATE = /\d{4}-\d{2}-\d{2}/

/** Every sentence the endpoints return for a player in one place. */
const wordsOf = (body: Record<string, unknown>): string[] =>
  [body.error, body.message, ...(Array.isArray(body.warnings) ? body.warnings : []), body.feeNote]
    .filter((w): w is string => typeof w === 'string')

describe('what a player is told', () => {
  it('asks for a US Chess ID, not a USCF ID, on a rated event (single and family)', async () => {
    const tournamentId = await seedTournament({ isRated: true })
    const single = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect(single.status).toBe(400)
    const singleWords = wordsOf(await single.json())
    expect(singleWords.join(' ')).toMatch(/US Chess/)
    expect(singleWords.join(' ')).not.toMatch(/USCF/)

    const parent = await seedMember({ uscfId: '12345678' })
    const kid = await seedMember({ fullName: 'Kid Player' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, kid).run()
    const family = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: kid, section: 'Open' }] } })
    expect(family.status).toBe(400)
    const familyWords = wordsOf(await family.json()).join(' ')
    expect(familyWords).toMatch(/Kid Player/)
    expect(familyWords).toMatch(/US Chess/)
    expect(familyWords).not.toMatch(/USCF/)
  })

  it('writes the membership warning with a weekday on the date, not a bare 2026-09-01', async () => {
    const tournamentId = await seedTournament({ isRated: true, date: '2026-10-17' })
    const member = await seedMember({ uscfId: '12345678' })
    await env.DB.prepare(`UPDATE members SET uscf_expiration = '2026-09-01' WHERE id = ?`).bind(member).run()
    const res = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'U1200' } })
    expect(res.status).toBe(201)
    const { warnings } = await res.json<{ warnings: string[] }>()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/US Chess/)
    expect(warnings[0]).not.toMatch(/USCF/)
    expect(warnings[0]).toMatch(WEEKDAY)
    expect(warnings[0]).toContain('Tue, Sep 1, 2026')
    expect(warnings[0]).not.toMatch(ISO_DATE)
  })

  it('the success messages name the event and section and carry no ISO date, USCF or ".5"', async () => {
    const tournamentId = await seedTournament({ name: 'Kenner Fall Open' })
    const member = await seedMember()
    const paid = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open' } })
    const paidWords = wordsOf(await paid.json()).join(' ')
    expect(paidWords).toContain('Kenner Fall Open')
    expect(paidWords).toContain('(Open)')

    const { parent, kid } = await (async () => {
      const p = await seedMember(); const k = await seedMember()
      await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(p, k).run()
      return { parent: p, kid: k }
    })()
    const family = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'U1200' }, { memberId: kid, section: 'U1200' }] } })
    const familyWords = wordsOf(await family.json()).join(' ')
    for (const words of [paidWords, familyWords]) {
      expect(words).not.toMatch(ISO_DATE)
      expect(words).not.toMatch(/USCF/)
      expect(words).not.toMatch(/\d\.5\b/)
    }
  })

  it('the fee note says whole dollars the way the page does, and names no code', async () => {
    const tournamentId = await seedTournament()
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player, section: 'Open', paymentStatus: 'paid' })
    await env.DB.prepare(`INSERT INTO payments (id, member_id, amount, type, reference_id, status) VALUES (?, ?, 25, 'tournament', ?, 'completed')`)
      .bind(`pay-${reg}`, player, reg).run()
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'U1200' } })
    const { feeNote } = await res.json<{ feeNote: string }>()
    expect(feeNote).toBe('Entry fee changed from $25 to $0 but payment is already completed. Reconcile manually in the Stripe dashboard.')
  })
})
