// test/integration/announcement-window.test.ts
//
// A banner's start and end are typed by an admin in Louisiana and stored as
// that wall-clock time, with no zone. The public endpoint has to read them
// the same way. It used to compare them with the database's UTC clock, so a
// banner set to end at 6 PM came down at 1 PM (noon in winter), and one set
// to start at 6 PM was already up.
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness } from './harness'
import { seedAdmin } from './factories'

import { onRequestGet as publicGet } from '../../functions/api/announcement'
import { onRequestPost as adminPost } from '../../functions/api/admin/announcement'

beforeEach(resetHarness)

/** Louisiana wall-clock time some hours from now, as the admin form sends it. */
function louisianaTime(hoursFromNow: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(Date.now() + hoursFromNow * 3600_000))
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:00`
}

async function banner(admin: string, message: string, window: { startsAt?: string; endsAt?: string }) {
  const res = await invoke(adminPost, { method: 'POST', as: admin, body: { message, ...window } })
  expect(res.status).toBe(201)
}

async function onScreen(): Promise<string[]> {
  const res = await invoke(publicGet)
  const { announcements } = await res.json<{ announcements: Array<{ message: string }> }>()
  return announcements.map((a) => a.message)
}

describe('a banner with a start and an end', () => {
  it('stays up until its end time in Louisiana', async () => {
    const admin = await seedAdmin()
    await banner(admin, 'Ends in two hours', { endsAt: louisianaTime(2) })
    await banner(admin, 'Ended two hours ago', { endsAt: louisianaTime(-2) })

    const shown = await onScreen()
    expect(shown).toContain('Ends in two hours')
    expect(shown).not.toContain('Ended two hours ago')
  })

  it('does not go up before its start time in Louisiana', async () => {
    const admin = await seedAdmin()
    await banner(admin, 'Starts in two hours', { startsAt: louisianaTime(2) })
    await banner(admin, 'Started two hours ago', { startsAt: louisianaTime(-2), endsAt: louisianaTime(2) })

    const shown = await onScreen()
    expect(shown).not.toContain('Starts in two hours')
    expect(shown).toContain('Started two hours ago')
  })
})
