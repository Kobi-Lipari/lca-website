// test/integration/automation-runs-table.test.ts
//
// Migration 0068's table, automation_runs, as the brief's data model writes it,
// on D1 built from the migrations, and the edges of recordRun and lastRun that
// test/integration/automation-runs.test.ts leaves (WS09 step 13):
// - the table's columns, defaults, CHECK, reference and index are the brief's,
//   and a database that has the table refuses what the brief's table refuses;
// - lastRun reads the latest by when a run started, not by the order the rows
//   were written, and reads no other job's;
// - recordRun's counts are whole numbers of zero or more or nothing, and the
//   detail is masked in the places an address or a token could ride;
// - two runs at once each get a row of their own;
// - a member who is named in the club tables of 0066 and on a run's mark is
//   deleted with both cleared and the answer unchanged.
// Every club, person, address and token here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { lastRun, MAX_DETAIL_LENGTH, plainDetail, recordRun } from '../../functions/utils/admin/automations'
import { sealToken, signToken } from '../../functions/utils/tokens'
import { clubRowCounts, giveClubRows } from './clubTables'
import { seedAdmin, seedClub, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(async () => {
  resetHarness()
  await env.DB.prepare('DELETE FROM automation_runs').run()
})
afterEach(() => {
  vi.restoreAllMocks()
})

interface Column { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }
const rows = async () => (await env.DB.prepare('SELECT * FROM automation_runs ORDER BY id').all<Record<string, unknown>>()).results
const insert = (job: string, startedAt: string, outcome = 'ok') =>
  env.DB.prepare('INSERT INTO automation_runs (job, started_at, outcome) VALUES (?, ?, ?) RETURNING id').bind(job, startedAt, outcome).first<{ id: number }>()

describe('the table as the brief writes it', () => {
  it('has the brief\'s ten columns, with its types, its NOT NULLs and its one default', async () => {
    const info = (await env.DB.prepare('PRAGMA table_info(automation_runs)').all<Column>()).results
    expect(info.map((c) => [c.name, c.type, c.notnull, c.pk])).toEqual([
      ['id', 'INTEGER', 0, 1], ['job', 'TEXT', 1, 0], ['started_at', 'TEXT', 1, 0], ['finished_at', 'TEXT', 0, 0], ['outcome', 'TEXT', 1, 0],
      ['sent_count', 'INTEGER', 0, 0], ['failed_count', 'INTEGER', 0, 0], ['detail', 'TEXT', 0, 0], ['seen_at', 'TEXT', 0, 0], ['seen_by', 'TEXT', 0, 0],
    ])
    expect(info.filter((c) => c.dflt_value !== null).map((c) => [c.name, c.dflt_value])).toEqual([['started_at', "datetime('now')"]])
  })

  it('has its index on the job and the time it started, and its one reference, seen_by to members with no delete action', async () => {
    const indexes = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'automation_runs' AND name NOT LIKE 'sqlite_%'").all<{ name: string }>()).results
    expect(indexes.map((i) => i.name)).toEqual(['idx_automation_runs_job'])
    const columns = (await env.DB.prepare("PRAGMA index_info('idx_automation_runs_job')").all<{ name: string }>()).results
    expect(columns.map((c) => c.name)).toEqual(['job', 'started_at'])
    const links = (await env.DB.prepare('PRAGMA foreign_key_list(automation_runs)').all<{ table: string; from: string; to: string; on_delete: string }>()).results
    expect(links.map((l) => [l.table, l.from, l.to, l.on_delete])).toEqual([['members', 'seen_by', 'id', 'NO ACTION']])
  })

  it('starts empty on a database built from the migrations, and stamps a row with the time it started', async () => {
    expect(await rows()).toEqual([])
    const made = await env.DB.prepare("INSERT INTO automation_runs (job, outcome) VALUES ('daily:reminders', 'ok') RETURNING started_at, finished_at").first<Record<string, unknown>>()
    expect(made?.started_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(made?.finished_at).toBeNull()
  })

  it('refuses an outcome that is not ok, partial or failed, an outcome left out, and a job left out', async () => {
    for (const outcome of ['OK', 'success', 'done', '', 'Failed']) {
      await expect(env.DB.prepare('INSERT INTO automation_runs (job, outcome) VALUES (?, ?)').bind('daily:reminders', outcome).run(), outcome).rejects.toThrow()
    }
    await expect(env.DB.prepare('INSERT INTO automation_runs (job) VALUES (?)').bind('daily:reminders').run()).rejects.toThrow()
    await expect(env.DB.prepare("INSERT INTO automation_runs (outcome) VALUES ('ok')").run()).rejects.toThrow()
    await expect(env.DB.prepare("INSERT INTO automation_runs (job, outcome) VALUES (NULL, 'ok')").run()).rejects.toThrow()
    for (const outcome of ['ok', 'partial', 'failed']) await env.DB.prepare('INSERT INTO automation_runs (job, outcome) VALUES (?, ?)').bind('daily:reminders', outcome).run()
    expect(await rows()).toHaveLength(3)
  })

  it('refuses a seen_by that names no member, and a delete of a member a run still names, which is why the member delete clears it', async () => {
    await expect(env.DB.prepare("INSERT INTO automation_runs (job, outcome, seen_by) VALUES ('daily:reminders', 'ok', 'no-such-member')").run()).rejects.toThrow()
    const member = await seedMember({ role: 'lca_admin', fullName: 'Player One', email: 'player.one@example.org' })
    await env.DB.prepare("INSERT INTO automation_runs (job, outcome, seen_at, seen_by) VALUES ('daily:reminders', 'ok', '2026-11-14 19:00:00', ?)").bind(member).run()
    await expect(env.DB.prepare('DELETE FROM members WHERE id = ?').bind(member).run()).rejects.toThrow()
    expect(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(member).first()).not.toBeNull()
  })
})

describe('lastRun', () => {
  it('reads the run that started last, whatever order the rows were written in, and no other job\'s', async () => {
    const later = await insert('daily:reminders', '2026-11-14 18:05:00', 'partial')
    await insert('daily:reminders', '2026-11-13 18:05:00', 'ok')
    await insert('daily:reminders', '2026-11-12 18:05:00', 'failed')
    await insert('daily:reminders:extra', '2026-11-15 09:00:00', 'ok')
    await insert('five_minute:reminders', '2026-11-15 09:00:00', 'ok')
    const read = await lastRun(env.DB, 'daily:reminders')
    expect(read).toMatchObject({ id: later!.id, job: 'daily:reminders', outcome: 'partial', started_at: '2026-11-14 18:05:00' })
    expect(Object.keys(read!).sort()).toEqual(['detail', 'failed_count', 'finished_at', 'id', 'job', 'outcome', 'seen_at', 'seen_by', 'sent_count', 'started_at'])
    expect(await lastRun(env.DB, 'daily:remind')).toBeNull()
    expect(await lastRun(env.DB, 'daily:%')).toBeNull()
    expect(await lastRun(env.DB, '')).toBeNull()
  })

  it('breaks a tie of the second by the later row, three runs in one second', async () => {
    await insert('clearinghouse_sync', '2026-11-14 18:05:00', 'ok')
    await insert('clearinghouse_sync', '2026-11-14 18:05:00', 'failed')
    const third = await insert('clearinghouse_sync', '2026-11-14 18:05:00', 'partial')
    expect((await lastRun(env.DB, 'clearinghouse_sync'))?.id).toBe(third!.id)
  })

  it('reads a run that has not closed as failed with no finish, the truth for an admin, and a run seen by someone with who and when', async () => {
    const answer = recordRun(env.DB, 'daily:reminders', async () => {
      const open = await lastRun(env.DB, 'daily:reminders')
      expect(open).toMatchObject({ outcome: 'failed', finished_at: null, sent_count: null, failed_count: null, detail: null, seen_at: null, seen_by: null })
      return { outcome: 'ok' as const, sentCount: 1 }
    })
    await answer
    const admin = await seedMember({ role: 'lca_admin', fullName: 'Player One', email: 'player.one@example.org' })
    await env.DB.prepare("UPDATE automation_runs SET seen_at = '2026-11-14 19:00:00', seen_by = ?").bind(admin).run()
    expect(await lastRun(env.DB, 'daily:reminders')).toMatchObject({ outcome: 'ok', sent_count: 1, seen_at: '2026-11-14 19:00:00', seen_by: admin })
  })
})

describe('recordRun', () => {
  it('writes a count as a whole number of zero or more, and anything else as nothing', async () => {
    const counts: Array<[unknown, unknown, number | null, number | null]> = [
      [0, 0, 0, 0], [12, 3, 12, 3], [-1, 2.5, null, null], [Number.NaN, Number.POSITIVE_INFINITY, null, null], ['7', null, null, null], [undefined, undefined, null, null],
      [Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER, 1], [Number.MAX_SAFE_INTEGER + 2, 1, null, 1],
    ]
    for (const [sent, failed, wantSent, wantFailed] of counts) {
      await recordRun(env.DB, 'daily:counts', async () => ({ outcome: 'ok' as const, sentCount: sent as number, failedCount: failed as number }))
      const row = await lastRun(env.DB, 'daily:counts')
      expect([row?.sent_count, row?.failed_count], `${String(sent)} ${String(failed)}`).toEqual([wantSent, wantFailed])
    }
  })

  it('records a job that answers nothing, or something that is not a report, as failed, and gives the answer back', async () => {
    for (const given of [undefined, null, 'done', 42, {}, { outcome: 'success' }, { outcome: null }]) {
      const got = await recordRun(env.DB, 'daily:odd', (async () => given) as never)
      expect(got).toBe(given)
      expect(await lastRun(env.DB, 'daily:odd')).toMatchObject({ outcome: 'failed', sent_count: null, failed_count: null, detail: null })
    }
    expect(await rows()).toHaveLength(7)
  })

  it('writes no address, token or secret into the detail, a thrown error\'s words or the job\'s own, and keeps the line one line of at most 200 characters', async () => {
    const signed = await signToken('example-signing-key-not-a-real-one-0001', 'club_confirm', { clubId: 'example-chess-club' }, 60)
    const sealed = await sealToken('example-signing-key-not-a-real-one-0001', 'club_confirm', { email: 'player.one@example.org' }, 60)
    const texts = [
      `Could not send to player.one@example.org with ${signed}`,
      `Player One <player.one@example.org> and "Player Two" <player.two@example.org>; mailto:player.three@example.org`,
      `Link https://example.org/confirm?token=${sealed}&next=/me failed`,
      `Link https://example.org/confirm/${signed} failed`,
      `Authorization: Bearer ${signed.split('.')[3]} was refused`,
      'secret = example-signing-key-not-a-real-one-0001 is too short',
      'api_key="abc def" and password: hunter2 were in the request',
      `line one\nline two\r\nPLAYER.ONE@EXAMPLE.ORG\u2028${'long words '.repeat(60)}`,
    ]
    for (const text of texts) {
      for (const via of ['thrown', 'reported'] as const) {
        await recordRun(env.DB, 'daily:detail', async () => {
          if (via === 'thrown') throw new Error(text)
          return { outcome: 'partial' as const, detail: text }
        })
        const detail = (await lastRun(env.DB, 'daily:detail'))?.detail as string
        expect(detail.length, text.slice(0, 30)).toBeLessThanOrEqual(MAX_DETAIL_LENGTH)
        expect(detail).not.toMatch(/\n|\r|\u2028/)
        expect(detail).not.toMatch(/@|player\.(one|two|three)|hunter2|abc def|example-signing-key/i)
        for (const part of [...signed.split('.').slice(2), ...sealed.split('.').slice(2)]) expect(detail).not.toContain(part)
        expect(detail).toBe(plainDetail(text))
      }
    }
  })

  it('writes the detail of a thrown value that is not an Error as plain text, and the job\'s thrown answer has the shape of a failed run', async () => {
    for (const thrown of ['player.one@example.org refused', { message: 'player.one@example.org' }, null, undefined, 7]) {
      const got = await recordRun(env.DB, 'daily:thrown', async () => {
        throw thrown
      })
      expect(got).toMatchObject({ outcome: 'failed', sentCount: null, failedCount: null, thrown: true })
      expect(JSON.stringify(got)).not.toContain('example.org')
    }
    const written = await rows()
    expect(written).toHaveLength(5)
    for (const row of written) {
      expect(row).toMatchObject({ outcome: 'failed', sent_count: null, failed_count: null })
      expect(row.finished_at).not.toBeNull()
      expect(JSON.stringify(row)).not.toContain('example.org')
    }
  })

  it('gives each of two runs at once, of one job and of two, a row of its own with its own outcome', async () => {
    const [a, b, c] = await Promise.all([
      recordRun(env.DB, 'daily:reminders', async () => ({ outcome: 'ok' as const, sentCount: 3 })),
      recordRun(env.DB, 'daily:reminders', async () => ({ outcome: 'partial' as const, sentCount: 2, failedCount: 1, detail: 'One address was refused.' })),
      recordRun(env.DB, 'five_minute:offers', async () => {
        throw new Error('The queue was not reachable.')
      }),
    ])
    expect([a, b].map((r) => r.outcome)).toEqual(['ok', 'partial'])
    expect(c).toMatchObject({ outcome: 'failed', thrown: true })
    const written = await rows()
    expect(new Set(written.map((r) => r.id)).size).toBe(3)
    expect(written.map((r) => [r.job, r.outcome, r.sent_count, r.failed_count, r.detail]).sort()).toEqual([
      ['daily:reminders', 'ok', 3, null, null], ['daily:reminders', 'partial', 2, 1, 'One address was refused.'], ['five_minute:offers', 'failed', null, null, 'The queue was not reachable.'],
    ].sort())
    expect(written.every((r) => r.finished_at !== null)).toBe(true)
  })

  it('records the next run of a job whose last run never closed, and leaves the open row failed', async () => {
    await env.DB.prepare("INSERT INTO automation_runs (job, outcome, started_at) VALUES ('daily:reminders', 'failed', '2026-11-13 18:00:00')").run()
    await recordRun(env.DB, 'daily:reminders', async () => ({ outcome: 'ok' as const }))
    const written = await rows()
    expect(written.map((r) => [r.outcome, r.finished_at === null])).toEqual([['failed', true], ['ok', false]])
  })

  it('does not throw, and keeps the job\'s answer, when the database itself throws on every call', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const refusing = { prepare: () => { throw new Error('D1_ERROR: no such table: automation_runs: SQLITE_ERROR player.one@example.org') } } as unknown as D1Database
    const answer = await recordRun(refusing, 'daily:reminders', async () => ({ outcome: 'ok' as const, sentCount: 9 }))
    expect(answer).toEqual({ outcome: 'ok', sentCount: 9 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/example\.org|player\.one|no such table/)
  })
})

describe('the member delete with both of the two migrations that name a member', () => {
  it('clears 0066\'s references and the member\'s run marks in one delete, and answers as before', async () => {
    const admin = await seedAdmin()
    const leaving = await seedMember({ role: 'lca_admin', fullName: 'Player One', email: 'player.one@example.org' })
    const staying = await seedMember({ role: 'lca_admin', fullName: 'Player Two', email: 'player.two@example.org' })
    const club = await seedClub({ id: 'example-chess-club', name: 'Example Chess Club' })
    await giveClubRows(club, leaving, 'example-old-name')
    await env.DB.prepare("UPDATE clubs SET told_by = ?, told_updated_at = '2026-11-02 18:00:00' WHERE id = ?").bind(leaving, club).run()
    await env.DB.prepare("INSERT INTO automation_runs (job, outcome, seen_at, seen_by) VALUES ('daily:reminders', 'ok', '2026-11-14 19:00:00', ?), ('clearinghouse_sync', 'partial', '2026-11-14 19:05:00', ?), ('daily:reminders', 'ok', '2026-11-14 19:10:00', ?)")
      .bind(leaving, leaving, staying).run()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: leaving } })
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe('{"success":true,"authDeleted":false}')
    expect(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(leaving).first()).toBeNull()
    expect((await env.DB.prepare('SELECT seen_at, seen_by FROM automation_runs ORDER BY id').all()).results).toEqual([
      { seen_at: '2026-11-14 19:00:00', seen_by: null }, { seen_at: '2026-11-14 19:05:00', seen_by: null }, { seen_at: '2026-11-14 19:10:00', seen_by: staying },
    ])
    expect((await env.DB.prepare('SELECT told_by, told_updated_at FROM clubs WHERE id = ?').bind(club).first())).toEqual({ told_by: null, told_updated_at: '2026-11-02 18:00:00' })
    expect((await clubRowCounts(club)).club_places).toBe(2)
    expect(warn.mock.calls.filter(([line]) => typeof line === 'string' && line.startsWith('member delete: '))).toEqual([])
  })

  it('deletes a member no run names, and leaves the runs another member marked alone', async () => {
    const lone = await seedMember({ fullName: 'Player Three', email: 'player.three@example.org' })
    const admin = await seedAdmin()
    await env.DB.prepare("INSERT INTO automation_runs (job, outcome, seen_at, seen_by) VALUES ('daily:reminders', 'ok', '2026-11-14 19:00:00', ?)").bind(admin).run()
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: lone } })).status).toBe(200)
    expect((await env.DB.prepare('SELECT seen_by FROM automation_runs').first<{ seen_by: string }>())?.seen_by).toBe(admin)
  })
})
