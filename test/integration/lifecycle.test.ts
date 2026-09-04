// test/integration/lifecycle.test.ts — the tournament pipeline, end to end.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  invoke,
  resetHarness,
  signStripePayload,
  stripeSessions,
} from './harness'
import {
  seedAdmin,
  seedMember,
  seedRegistration,
  seedTournament,
  seedTournamentDirector,
} from './factories'

import { onRequestPost as registrationsPost } from '../../functions/api/registrations'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestPost as payPost } from '../../functions/api/registrations/[id]/pay'
import { onRequestPost as webhookPost } from '../../functions/api/stripe/webhook'
import { onRequestPost as walkInPost } from '../../functions/api/admin/tournaments/[id]/walk-ins'
import { onRequestPost as generatePost } from '../../functions/api/admin/tournaments/[id]/generate-pairings'
import { onRequestPatch as resultPatch } from '../../functions/api/admin/tournaments/[id]/games/[gameId]'
import { onRequestDelete as roundDelete } from '../../functions/api/admin/tournaments/[id]/rounds/[round]'
import { onRequestGet as ratingReportGet } from '../../functions/api/admin/tournaments/[id]/rating-report'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'

beforeEach(resetHarness)

// ── helpers ──────────────────────────────────────────────────────

async function sendWebhook(payload: object, sign = true) {
  const rawBody = JSON.stringify(payload)
  const headers: Record<string, string> = {}
  if (sign) headers['stripe-signature'] = await signStripePayload(rawBody)
  else headers['stripe-signature'] = 't=1,v1=deadbeef'
  return invoke(webhookPost, { method: 'POST', rawBody, headers })
}

function checkoutCompletedEvent(metadata: Record<string, string>) {
  return {
    type: 'checkout.session.completed',
    data: { object: { payment_intent: 'pi_test_1', metadata } },
  }
}

async function gamesFor(tournamentId: string, round?: number) {
  const q = round === undefined
    ? env.DB.prepare('SELECT * FROM tournament_games WHERE tournament_id = ? ORDER BY round, board').bind(tournamentId)
    : env.DB.prepare('SELECT * FROM tournament_games WHERE tournament_id = ? AND round = ? ORDER BY board').bind(tournamentId, round)
  const { results } = await q.all<{
    id: string; round: number; board: number
    white_member_id: string | null; black_member_id: string | null; result: string
  }>()
  return results ?? []
}

// ── payments: register → pay → webhook ───────────────────────────

describe('payment flow', () => {
  it('webhook with a valid signature completes the payment; replay is idempotent; bad signature rejected', async () => {
    const member = await seedMember()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 30 }] })

    const reg = await invoke(registrationsPost, {
      method: 'POST', as: member, body: { tournamentId, section: 'Open' },
    })
    expect(reg.status).toBe(201)
    const session = stripeSessions[0]

    // Bad signature: rejected, nothing changes
    const bad = await sendWebhook(checkoutCompletedEvent(session.metadata), false)
    expect(bad.status).toBe(400)

    // Valid signature: registration flips to paid
    const ok = await sendWebhook(checkoutCompletedEvent(session.metadata))
    expect(ok.status).toBe(200)
    const regRow = await env.DB.prepare('SELECT payment_status FROM registrations WHERE id = ?')
      .bind(session.metadata.registration_id).first<{ payment_status: string }>()
    expect(regRow?.payment_status).toBe('paid')

    // Replay: still 200, still paid, no error
    const replay = await sendWebhook(checkoutCompletedEvent(session.metadata))
    expect(replay.status).toBe(200)
  })

  it('retry-pay creates a fresh session priced from the payment row', async () => {
    const member = await seedMember()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 45 }] })
    await invoke(registrationsPost, {
      method: 'POST', as: member, body: { tournamentId, section: 'Open' },
    })
    const registrationId = stripeSessions[0].metadata.registration_id

    const retry = await invoke(payPost, {
      method: 'POST', as: member, params: { id: registrationId },
    })
    expect(retry.status).toBe(200)
    expect(stripeSessions).toHaveLength(2)
    expect(stripeSessions[1].amountCents).toBe(4500)
  })
})

// ── walk-ins ─────────────────────────────────────────────────────

describe('membership renewal', () => {
  /** Seeds a member with a paid-but-pending membership payment. */
  async function pendingMembership(expiry: string | null) {
    const memberId = await seedMember({ membershipStatus: expiry ? 'active' : 'pending' })
    if (expiry) {
      await env.DB.prepare('UPDATE members SET membership_expiry = ? WHERE id = ?')
        .bind(expiry, memberId).run()
    }
    const paymentId = `pay-${memberId}`
    await env.DB.prepare(
      `INSERT INTO payments (id, member_id, amount, type, reference_id, status)
       VALUES (?, ?, ?, 'membership', ?, 'pending')`,
    ).bind(paymentId, memberId, 25, memberId).run()
    return { memberId, paymentId }
  }

  const expiryOf = (memberId: string) =>
    env.DB.prepare('SELECT membership_status, membership_expiry FROM members WHERE id = ?')
      .bind(memberId).first<{ membership_status: string; membership_expiry: string | null }>()

  const plusYears = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00Z`)
    d.setUTCFullYear(d.getUTCFullYear() + n)
    return d.toISOString().slice(0, 10)
  }
  const todayIso = () => new Date().toISOString().slice(0, 10)

  it('renewing early adds a year to the existing expiry instead of discarding it', async () => {
    // The bug: this used to return one year from today, so a member renewing
    // with ten months left paid for a year and lost those ten months.
    const future = plusYears(todayIso(), 1)
    const { memberId, paymentId } = await pendingMembership(future)

    const res = await sendWebhook(checkoutCompletedEvent({
      type: 'membership', payment_id: paymentId, member_id: memberId,
    }))
    expect(res.status).toBe(200)

    const row = await expiryOf(memberId)
    expect(row?.membership_status).toBe('active')
    expect(row?.membership_expiry).toBe(plusYears(future, 1))
  })

  it('a lapsed member starts a fresh year from today', async () => {
    const past = plusYears(todayIso(), -2)
    const { memberId, paymentId } = await pendingMembership(past)

    await sendWebhook(checkoutCompletedEvent({
      type: 'membership', payment_id: paymentId, member_id: memberId,
    }))

    const row = await expiryOf(memberId)
    expect(row?.membership_expiry).toBe(plusYears(todayIso(), 1))
  })

  it('a first-time member gets a year from today', async () => {
    const { memberId, paymentId } = await pendingMembership(null)

    await sendWebhook(checkoutCompletedEvent({
      type: 'membership', payment_id: paymentId, member_id: memberId,
    }))

    const row = await expiryOf(memberId)
    expect(row?.membership_status).toBe('active')
    expect(row?.membership_expiry).toBe(plusYears(todayIso(), 1))
  })

  it('a retried delivery does not grant a second year', async () => {
    // Stripe retries on any non-2xx, and the idempotency guard is the only
    // thing between that and members accumulating free years.
    const future = plusYears(todayIso(), 1)
    const { memberId, paymentId } = await pendingMembership(future)
    const event = checkoutCompletedEvent({
      type: 'membership', payment_id: paymentId, member_id: memberId,
    })

    await sendWebhook(event)
    const afterFirst = await expiryOf(memberId)
    await sendWebhook(event)
    const afterSecond = await expiryOf(memberId)

    expect(afterSecond?.membership_expiry).toBe(afterFirst?.membership_expiry)
  })

  it('rejects a replayed signature, however valid its HMAC', async () => {
    // Signed six minutes ago with the real secret. Before the tolerance
    // existed this was indistinguishable from a live delivery.
    const { memberId, paymentId } = await pendingMembership(null)
    const rawBody = JSON.stringify(checkoutCompletedEvent({
      type: 'membership', payment_id: paymentId, member_id: memberId,
    }))
    const stale = await signStripePayload(rawBody, Math.floor(Date.now() / 1000) - 360)

    const res = await invoke(webhookPost, {
      method: 'POST', rawBody, headers: { 'stripe-signature': stale },
    })

    expect(res.status).toBe(400)
    const row = await expiryOf(memberId)
    expect(row?.membership_expiry).toBeNull()
  })
})

describe('walk-ins', () => {
  it('rated tournament requires a USCF ID; success creates guest + cash payment; duplicate USCF ID is 409', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({
      isRated: true, sections: [{ name: 'Open', entryFee: 20 }],
    })

    const noId = await invoke(walkInPost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { fullName: 'Door Player', section: 'Open' },
    })
    expect(noId.status).toBe(400)

    const ok = await invoke(walkInPost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { fullName: 'Door Player', section: 'Open', uscfId: '12345678', uscfRating: 1500 },
    })
    expect(ok.status).toBe(201)
    const { guestId } = await ok.json()

    const guest = await env.DB.prepare('SELECT role, email FROM members WHERE id = ?')
      .bind(guestId).first<{ role: string; email: string }>()
    expect(guest?.role).toBe('guest')
    expect(guest?.email).toMatch(/@walkin\.lca\.invalid$/)

    const payment = await env.DB.prepare(
      `SELECT status, stripe_session_id FROM payments WHERE member_id = ?`,
    ).bind(guestId).first<{ status: string; stripe_session_id: string | null }>()
    expect(payment?.status).toBe('completed')
    expect(payment?.stripe_session_id).toBeNull()

    const dup = await invoke(walkInPost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { fullName: 'Door Player Again', section: 'Open', uscfId: '12345678' },
    })
    expect(dup.status).toBe(409)
  })
})

// ── pairing, results, rounds ─────────────────────────────────────

describe('pairing lifecycle', () => {
  it('TD-scoped auth: a plain member is 403, an assigned TD passes', async () => {
    const td = await seedMember({ role: 'tournament_director' })
    const rando = await seedMember()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    await seedTournamentDirector(tournamentId, td)
    const m = await seedMember({ uscfRating: 1500 })
    await seedRegistration({ tournamentId, memberId: m, section: 'Open' })

    const denied = await invoke(generatePost, {
      method: 'POST', as: rando, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })
    expect(denied.status).toBe(403)

    const allowed = await invoke(generatePost, {
      method: 'POST', as: td, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })
    expect(allowed.status).toBe(201)
  })

  it('round 1: assigned bye to lowest-rated active player, requested bye-half row present, duplicate generation 409', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 4, sections: [{ name: 'Open', entryFee: 0 }] })

    // Ratings 2600 down to 2100; the 2100 player requested a round-1 bye.
    const ids: string[] = []
    for (let i = 0; i < 6; i++) {
      const id = await seedMember({ uscfRating: 2600 - i * 100 })
      ids.push(id)
      await seedRegistration({
        tournamentId, memberId: id, section: 'Open',
        byeRounds: i === 5 ? [1] : [],
      })
    }
    const lowestActive = ids[4] // 2200 — lowest among the five who play

    const gen = await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })
    expect(gen.status).toBe(201)

    const rows = await gamesFor(tournamentId, 1)
    // 5 active (odd) → 2 games + 1 assigned bye, plus 1 requested half-bye row
    expect(rows).toHaveLength(4)
    const assignedBye = rows.find((g) => g.result === 'bye')
    expect(assignedBye?.white_member_id).toBe(lowestActive)
    const halfBye = rows.find((g) => g.result === 'bye-half')
    expect(halfBye?.white_member_id).toBe(ids[5])

    const again = await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })
    expect(again.status).toBe(409)
  })

  it('results: forfeit codes accepted (regression), round 2 blocked until round 1 complete, then generates clean', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 3, sections: [{ name: 'Open', entryFee: 0 }] })
    for (let i = 0; i < 4; i++) {
      const id = await seedMember({ uscfRating: 2000 - i * 100 })
      await seedRegistration({ tournamentId, memberId: id, section: 'Open' })
    }
    await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })

    const early = await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 2, section: 'Open' },
    })
    expect(early.status).toBe(400) // pending round-1 results

    const r1 = await gamesFor(tournamentId, 1)
    expect(r1).toHaveLength(2)

    // One normal result, one FORFEIT — the regression case
    const win = await invoke(resultPatch, {
      method: 'PATCH', as: admin,
      params: { id: tournamentId, gameId: r1[0].id },
      body: { result: '1-0' },
    })
    expect(win.status).toBe(200)
    const forfeit = await invoke(resultPatch, {
      method: 'PATCH', as: admin,
      params: { id: tournamentId, gameId: r1[1].id },
      body: { result: '1-0 F' },
    })
    expect(forfeit.status).toBe(200)

    const r2 = await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 2, section: 'Open' },
    })
    expect(r2.status).toBe(201)
  })

  it('withdrawn players are excluded from subsequent pairings; withdrawal is manager-only', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 3, sections: [{ name: 'Open', entryFee: 0 }] })
    const ids: string[] = []
    const regIds: string[] = []
    for (let i = 0; i < 4; i++) {
      const id = await seedMember({ uscfRating: 1900 - i * 100 })
      ids.push(id)
      regIds.push(await seedRegistration({ tournamentId, memberId: id, section: 'Open' }))
    }
    await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })
    for (const g of await gamesFor(tournamentId, 1)) {
      await invoke(resultPatch, {
        method: 'PATCH', as: admin,
        params: { id: tournamentId, gameId: g.id }, body: { result: '1-0' },
      })
    }

    // A plain member (the owner) cannot self-withdraw — manager only
    const selfTry = await invoke(registrationPatch, {
      method: 'PATCH', as: ids[3], params: { id: regIds[3] },
      body: { withdrawn: true },
    })
    expect(selfTry.status).toBe(403)

    const withdrawn = await invoke(registrationPatch, {
      method: 'PATCH', as: admin, params: { id: regIds[3] },
      body: { withdrawn: true },
    })
    expect(withdrawn.status).toBe(200)

    await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 2, section: 'Open' },
    })
    const r2 = await gamesFor(tournamentId, 2)
    const r2Players = r2.flatMap((g) =>
      [g.white_member_id, g.black_member_id].filter(Boolean),
    )
    expect(r2Players).not.toContain(ids[3])
  })

  it('section change is blocked once a player has been paired', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({
      sections: [{ name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 0 }],
    })
    const a = await seedMember({ uscfRating: 1500 })
    const b = await seedMember({ uscfRating: 1400 })
    const regA = await seedRegistration({ tournamentId, memberId: a, section: 'Open' })
    await seedRegistration({ tournamentId, memberId: b, section: 'Open' })
    await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })

    const move = await invoke(registrationPatch, {
      method: 'PATCH', as: admin, params: { id: regA },
      body: { section: 'U1200' },
    })
    expect(move.status).toBe(400)
  })

  it('delete-round: refuses non-latest, deletes latest', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 3, sections: [{ name: 'Open', entryFee: 0 }] })
    for (let i = 0; i < 4; i++) {
      const id = await seedMember({ uscfRating: 1800 - i * 100 })
      await seedRegistration({ tournamentId, memberId: id, section: 'Open' })
    }
    await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })
    for (const g of await gamesFor(tournamentId, 1)) {
      await invoke(resultPatch, {
        method: 'PATCH', as: admin,
        params: { id: tournamentId, gameId: g.id }, body: { result: '1/2-1/2' },
      })
    }
    await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 2, section: 'Open' },
    })

    const earlyDelete = await invoke(roundDelete, {
      method: 'DELETE', as: admin,
      params: { id: tournamentId, round: '1' }, path: '/api/x?section=Open',
    })
    expect(earlyDelete.status).toBe(400)

    const latestDelete = await invoke(roundDelete, {
      method: 'DELETE', as: admin,
      params: { id: tournamentId, round: '2' }, path: '/api/x?section=Open',
    })
    expect(latestDelete.status).toBe(200)
    expect(await gamesFor(tournamentId, 2)).toHaveLength(0)
  })
})

// ── rating report + standings ────────────────────────────────────

describe('rating report and standings', () => {
  it('emits correct USCF codes, flags missing IDs and pending games', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({
      rounds: 2, isRated: true, sections: [{ name: 'Open', entryFee: 0 }],
    })
    const a = await seedMember({ uscfRating: 1800, uscfId: '11111111', fullName: 'Alice A' })
    const b = await seedMember({ uscfRating: 1600, uscfId: '22222222', fullName: 'Bob B' })
    const c = await seedMember({ uscfRating: 1400, uscfId: null, fullName: 'Carol C' })
    for (const id of [a, b, c]) {
      await seedRegistration({ tournamentId, memberId: id, section: 'Open' })
    }
    // Hand-built games so codes are deterministic:
    // R1: A beats B; C half-bye. R2: A forfeit-beats C; B pending.
    const rows = [
      ['g1', 1, 1, a, b, '1-0'],
      ['g2', 1, 2, c, null, 'bye-half'],
      ['g3', 2, 1, a, c, '1-0 F'],
      ['g4', 2, 2, b, null, 'pending'],
    ] as const
    for (const [id, round, board, white, black, result] of rows) {
      await env.DB.prepare(
        `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
         VALUES (?, ?, ?, ?, 'Open', ?, ?, ?)`,
      ).bind(`${id}-${tournamentId}`, tournamentId, round, board, white, black, result).run()
    }

    const report = await invoke(ratingReportGet, {
      as: admin, params: { id: tournamentId },
    })
    expect(report.status).toBe(200)
    const data = await report.json()

    const open = data.sections.find((s: { name: string }) => s.name === 'Open')
    const alice = open.players.find((p: { name: string }) => p.name === 'Alice A')
    const bob = open.players.find((p: { name: string }) => p.name === 'Bob B')
    const carol = open.players.find((p: { name: string }) => p.name === 'Carol C')

    expect(alice.pairingNum).toBe(1) // highest rated
    expect(alice.rounds.map((r: { code: string }) => r.code)).toEqual(['W', 'X'])
    expect(alice.score).toBe(2)
    expect(bob.rounds[0].code).toBe('L')
    expect(carol.rounds.map((r: { code: string }) => r.code)).toEqual(['H', 'F'])
    expect(carol.score).toBe(0.5)

    const errText = data.validationErrors.join(' | ')
    expect(errText).toContain('Carol C')
    expect(errText).toContain('pending')
  })

  it('manage endpoint standings reflect entered results', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 2, sections: [{ name: 'Open', entryFee: 0 }] })
    const a = await seedMember({ uscfRating: 1700, fullName: 'Winner W' })
    const b = await seedMember({ uscfRating: 1500, fullName: 'Loser L' })
    await seedRegistration({ tournamentId, memberId: a, section: 'Open' })
    await seedRegistration({ tournamentId, memberId: b, section: 'Open' })
    await invoke(generatePost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open' },
    })
    const [game] = await gamesFor(tournamentId, 1)
    const aIsWhite = game.white_member_id === a
    await invoke(resultPatch, {
      method: 'PATCH', as: admin,
      params: { id: tournamentId, gameId: game.id },
      body: { result: aIsWhite ? '1-0' : '0-1' },
    })

    const manage = await invoke(manageGet, { as: admin, params: { id: tournamentId } })
    expect(manage.status).toBe(200)
    const { standings } = await manage.json()
    const winner = standings.find((s: { member_id: string }) => s.member_id === a)
    const loser = standings.find((s: { member_id: string }) => s.member_id === b)
    expect(winner?.score).toBe(1)
    expect(loser?.score).toBe(0)
  })
})