// test/integration/member-export.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember } from './factories'
import { onRequestGet as exportGet } from '../../functions/api/admin/members/export'

beforeEach(resetHarness)

const get = (as: string, query: string) => invoke(exportGet, { as, path: `/api/admin/members/export?${query}` })

describe('exporting members', () => {
  it('gives admins and observers a CSV, each address once, and logs it', async () => {
    const admin = await seedAdmin()
    const observer = await seedMember({ role: 'lca_observer' })
    const parent = await seedMember({ email: 'fam@example.org', fullName: 'Pat Parent' })
    const child = await seedMember({ email: 'fam@example.org', fullName: 'Kid Parent' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    await seedMember({ email: 'tricky@example.org', fullName: '=HYPERLINK("x")', membershipStatus: 'expired' })

    const res = await get(admin, 'type=emails&who=all')
    expect(res.status).toBe(200)
    expect(res.response.headers.get('Content-Type')).toContain('text/csv')
    const csv = await res.response.text()
    expect(csv.match(/fam@example\.org/g)).toHaveLength(1)
    // A formula typed as a name can't run when the file is opened.
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)

    const lapsed = await (await get(observer, 'type=emails&who=lapsed')).response.text()
    expect(lapsed).toContain('tricky@example.org')
    expect(lapsed).not.toContain('fam@example.org')

    const log = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'members_export'`).first<{ n: number }>()
    expect(log?.n).toBe(2)
  })

  it('full list can include children; plain list format for copying', async () => {
    const admin = await seedAdmin()
    const parent = await seedMember({ email: 'fam2@example.org', fullName: 'Pat Two' })
    const child = await seedMember({ email: 'fam2@example.org', fullName: 'Kid Two' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()

    const without = await (await get(admin, 'type=full&who=all')).response.text()
    expect(without).not.toContain('Kid Two')
    const withKids = await (await get(admin, 'type=full&who=all&children=1')).response.text()
    expect(withKids).toContain('Kid Two')
    expect(withKids.split('\r\n')[0]).toContain('US Chess expires')

    const list = await (await get(admin, 'type=emails&who=all&format=list')).response.text()
    expect(list.split('\n')).toContain('fam2@example.org')
  })

  it('is not for other roles', async () => {
    const rep = await seedMember({ role: 'club_rep' })
    expect((await get(rep, 'type=emails&who=all')).status).toBe(403)
  })
})

describe('full member list columns', () => {
  it('has exactly name, email, LCA status and expiry, US Chess ID and expiry', async () => {
    const admin = await seedAdmin()
    await seedMember({ email: 'col@example.org', fullName: 'Col Umns', uscfId: '56781234' })
    const csv = await (await get(admin, 'type=full&who=all')).response.text()
    expect(csv.replace('﻿', '').split('\r\n')[0]).toBe('Name,Email,LCA membership,LCA expires,US Chess ID,US Chess expires')
  })
})
