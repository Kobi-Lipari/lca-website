// test/integration/coverage.test.ts — clubs, governance, support, membership.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { emailOutbox, invoke, resetHarness, stripeSessions } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'

import { onRequestGet as clubsGet } from '../../functions/api/clubs'
import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'
import {
  onRequestDelete as adminClubDelete,
  onRequestPatch as adminClubPatch,
} from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as boardGet, onRequestPost as boardPost } from '../../functions/api/governance/board'
import { onRequestGet as docsGet, onRequestPost as docsPost } from '../../functions/api/governance/documents'
import { onRequestGet as newsGet } from '../../functions/api/news'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestPost as membershipCheckout } from '../../functions/api/membership/checkout'
import { onRequestPost as membershipConfirm } from '../../functions/api/membership/confirm'

beforeEach(resetHarness)

describe('clubs', () => {
  it('public list returns color/image_url/region (card-tint regression)', async () => {
    const clubId = await seedClub()
    await env.DB.prepare(
      `UPDATE clubs SET color = '#123abc', region = 'Greater New Orleans' WHERE id = ?`,
    ).bind(clubId).run()

    const res = await invoke(clubsGet)
    const { clubs } = await res.json()
    const mine = clubs.find((c: { id: string }) => c.id === clubId)
    expect(mine.color).toBe('#123abc')
    expect(mine.region).toBe('Greater New Orleans')
  })

  it('public club page hides is_visible = 0 tournaments', async () => {
    const clubId = await seedClub()
    const hidden = await seedTournament({ clubId, isVisible: false })
    const shown = await seedTournament({ clubId })

    const res = await invoke(clubGet, { params: { id: clubId } })
    const { tournaments } = await res.json()
    const ids = tournaments.map((t: { id: string }) => t.id)
    expect(ids).toContain(shown)
    expect(ids).not.toContain(hidden)
  })

  it('PATCH: valid hex accepted, invalid hex keeps existing, null clears; foreign club_rep is 403', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const foreignRep = await seedMember({ role: 'club_rep', clubId: otherClub })

    expect((await invoke(adminClubPatch, {
      method: 'PATCH', as: foreignRep, params: { id: clubId }, body: { color: '#000000' },
    })).status).toBe(403)

    await invoke(adminClubPatch, {
      method: 'PATCH', as: admin, params: { id: clubId }, body: { color: '#ABCdef' },
    })
    let row = await env.DB.prepare('SELECT color FROM clubs WHERE id = ?').bind(clubId).first<{ color: string }>()
    expect(row?.color).toBe('#ABCdef')

    await invoke(adminClubPatch, {
      method: 'PATCH', as: admin, params: { id: clubId }, body: { color: 'not-a-color' },
    })
    row = await env.DB.prepare('SELECT color FROM clubs WHERE id = ?').bind(clubId).first<{ color: string }>()
    expect(row?.color).toBe('#ABCdef') // invalid ignored, existing kept

    await invoke(adminClubPatch, {
      method: 'PATCH', as: admin, params: { id: clubId }, body: { color: null },
    })
    row = await env.DB.prepare('SELECT color FROM clubs WHERE id = ?').bind(clubId).first<{ color: string | null }>()
    expect(row?.color).toBeNull()
  })

  it('DELETE is admin-only and nulls tournaments.club_id instead of deleting history', async () => {
    const admin = await seedAdmin()
    const rep = await seedMember({ role: 'club_rep' })
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })

    expect((await invoke(adminClubDelete, {
      method: 'DELETE', as: rep, params: { id: clubId },
    })).status).toBe(403)

    expect((await invoke(adminClubDelete, {
      method: 'DELETE', as: admin, params: { id: clubId },
    })).status).toBe(200)

    const t = await env.DB.prepare('SELECT club_id FROM tournaments WHERE id = ?')
      .bind(tournamentId).first<{ club_id: string | null }>()
    expect(t?.club_id).toBeNull()
  })
})

describe('governance', () => {
  it('board: public GET, admin-only POST, created member appears', async () => {
    const admin = await seedAdmin()
    expect((await invoke(boardPost, {
      method: 'POST', as: await seedMember(),
      body: { role: 'President', name: 'X' },
    })).status).toBe(403)

    const created = await invoke(boardPost, {
      method: 'POST', as: admin,
      body: { role: 'President', name: 'Pat President', sort_order: 1 },
    })
    expect(created.status).toBe(201)

    const list = await invoke(boardGet)
    const { members } = await list.json()
    expect(members.some((m: { name: string }) => m.name === 'Pat President')).toBe(true)
  })

  it('documents: category filter returns only that category', async () => {
    const admin = await seedAdmin()
    await invoke(docsPost, {
      method: 'POST', as: admin,
      body: { category: 'bylaws', title: 'LCA Bylaws 2026', content: 'text' },
    })
    await invoke(docsPost, {
      method: 'POST', as: admin,
      body: { category: 'minutes', title: 'June Minutes', content: 'text' },
    })

    const res = await invoke(docsGet, { path: '/api/governance/documents?category=bylaws' })
    const { documents } = await res.json()
    expect(documents.length).toBeGreaterThan(0)
    expect(documents.every((d: { category: string }) => d.category === 'bylaws')).toBe(true)
  })

  it('board POST: missing name or role is 400, not 500', async () => {
    const admin = await seedAdmin()
    expect((await invoke(boardPost, {
      method: 'POST', as: admin, body: { role: 'Treasurer' },
    })).status).toBe(400)
    expect((await invoke(boardPost, {
      method: 'POST', as: admin, body: { name: 'No Role' },
    })).status).toBe(400)
    expect((await invoke(boardPost, {
      method: 'POST', as: admin, rawBody: '{not json', headers: { 'Content-Type': 'application/json' },
    })).status).toBe(400)
  })

  it('board POST: sort_order 0 is preserved, not coerced to the default', async () => {
    const admin = await seedAdmin()
    const res = await invoke(boardPost, {
      method: 'POST', as: admin,
      body: { role: 'President', name: 'First Sorter', sort_order: 0 },
    })
    expect(res.status).toBe(201)
    const { member } = await res.json()
    expect(member.sort_order).toBe(0)
  })

  it('documents POST: missing title or invalid category is 400, not 500', async () => {
    const admin = await seedAdmin()
    expect((await invoke(docsPost, {
      method: 'POST', as: admin, body: { category: 'bylaws' },
    })).status).toBe(400)
    expect((await invoke(docsPost, {
      method: 'POST', as: admin, body: { category: 'memes', title: 'Nope' },
    })).status).toBe(400)
  })
})

describe('support', () => {
  it('anonymous ticket creation sends two emails with injected HTML escaped', async () => {
    const res = await invoke(supportPost, {
      method: 'POST',
      body: {
        name: '<img src=x onerror=alert(1)>', email: 'a@b.c',
        subject: 'Help', body: 'my <b>problem</b>',
      },
    })
    expect(res.status).toBe(201)

    // Two emails with no board seat involved: the staff notification and the
    // submitter's confirmation. Staff mail goes to CONTACT_EMAIL — createTicket
    // uses that for every new ticket, whichever endpoint opened it.
    expect(emailOutbox).toHaveLength(2)
    const notification = emailOutbox.find((e) => e.to === 'contact@louisianachess.org')
    expect(notification, 'staff notification was not sent').toBeDefined()
    expect(notification?.html).not.toContain('<img src=x')
    expect(notification?.html).toContain('&lt;img')
  })
})

describe('membership', () => {
  it('valid tier creates a correctly-priced session and pending payment; invalid tier 400', async () => {
    const member = await seedMember()

    expect((await invoke(membershipCheckout, {
      method: 'POST', as: member, body: { tier: 'platinum' },
    })).status).toBe(400)

    const res = await invoke(membershipCheckout, {
      method: 'POST', as: member, body: { tier: 'adult' },
    })
    expect(res.status).toBe(200)
    const { paymentId } = await res.json()
    expect(stripeSessions[0].amountCents).toBe(1500)
    expect(stripeSessions[0].metadata.type).toBe('membership')

    const pay = await env.DB.prepare('SELECT status, type FROM payments WHERE id = ?')
      .bind(paymentId).first<{ status: string; type: string }>()
    expect(pay?.status).toBe('pending')
    expect(pay?.type).toBe('membership')
  })

  it('confirm reports pending before the webhook and completed after', async () => {
    const member = await seedMember()
    const res = await invoke(membershipCheckout, {
      method: 'POST', as: member, body: { tier: 'senior' },
    })
    const { paymentId } = await res.json()

    const before = await invoke(membershipConfirm, {
      method: 'POST', as: member, body: { paymentId },
    })
    expect((await before.json()).pending).toBe(true)

    await env.DB.prepare(`UPDATE payments SET status = 'completed' WHERE id = ?`)
      .bind(paymentId).run()

    const after = await invoke(membershipConfirm, {
      method: 'POST', as: member, body: { paymentId },
    })
    expect((await after.json()).alreadyConfirmed).toBe(true)
  })

  // ── LAUNCH GUARD ─────────────────────────────────────────────────
  // The 'test' tier is gone from checkout.ts; from now on CI permanently
  // prevents its reintroduction.
  it('the test tier does not exist (launch blocker resolved)', async () => {
    const res = await invoke(membershipCheckout, {
      method: 'POST', as: await seedMember(), body: { tier: 'test' },
    })
    expect(res.status).toBe(400)
  })
})

describe('news', () => {
  it('aggregate feed is public, joins club name/color, newest first', async () => {
    const clubId = await seedClub()
    await env.DB.prepare(`UPDATE clubs SET color = '#123abc' WHERE id = ?`)
      .bind(clubId).run()
    await env.DB.prepare(
      `INSERT INTO club_news (id, club_id, title, news_date, excerpt)
       VALUES (?, ?, 'Older post', '2026-07-01', 'first'),
              (?, ?, 'Newer post', '2026-07-10', 'second')`,
    ).bind(crypto.randomUUID(), clubId, crypto.randomUUID(), clubId).run()

    const res = await invoke(newsGet) // no auth — endpoint is public
    expect(res.status).toBe(200)
    const { news } = await res.json()
    expect(news.length).toBeGreaterThanOrEqual(2)
    const idx = (title: string) => news.findIndex((n: { title: string }) => n.title === title)
    expect(idx('Newer post')).toBeLessThan(idx('Older post'))
    const newer = news[idx('Newer post')]
    expect(newer.club_id).toBe(clubId)
    expect(newer.club_color).toBe('#123abc')
    expect(typeof newer.club_name).toBe('string')
  })
})