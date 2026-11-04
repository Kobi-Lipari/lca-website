// test/unit/public-answer.test.ts
//
// The Phase 0 trim of the public answers, piece by piece, with no database:
// - publicTournamentAnswer leaves created_by, keep_apart, report_settings
//   and review_notified_at out of a tournament answer for anyone who does
//   not manage the event, the keys gone rather than null, and hands a manager
//   the answer as it was;
// - eventsManagedBy, the list's manager rule, gives the same people as the
//   detail's (an admin, an observer, the organizing club's rep and an
//   assigned director, a guest never) and reads the assignments once;
// - publicRoster writes an entrant under 18 (a guardian link, or an entry
//   that confirmed a scholastic range) as first name and last initial when
//   it is asked to shorten, and leaves every name as stored when it is not;
// - publicClubAnswer leaves the club's contact_email out once told to;
// - the contracts: the four keys optional on the public list row and the
//   public detail and required on the admin's answers, contact_email
//   optional on the club page's answer alone, and no officer's email;
// - the daily-emails worker, which deploys on any change under
//   functions/utils/ or domain/, bundles none of the files the trim changes.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import {
  MANAGER_ONLY_TOURNAMENT_KEYS,
  adminTournamentResponseSchema,
  clubDetailResponseSchema,
  clubRowSchema,
  tournamentDetailResponseSchema,
  tournamentDetailSchema,
  tournamentListItemSchema,
  tournamentManageResponseSchema,
} from '../../domain/contracts'
import { publicClubAnswer } from '../../functions/utils/clubs/publicAnswer'
import { eventsManagedBy, publicRoster, publicTournamentAnswer, type RosterRead } from '../../functions/utils/events/publicAnswer'

// The trim's three keys, and review_notified_at, which WS08 step 2 added.
const MANAGERS_ONLY = ['created_by', 'keep_apart', 'report_settings', 'review_notified_at']

/** A tournament answer with the four keys and a few others. */
const answer = () => ({ id: 't1', name: 'Fall Open', club_id: 'c1', created_by: 'm9', keep_apart: 'family', report_settings: '{"affiliateId":"A6000001"}', review_notified_at: '2026-11-03 21:00:00', sections: [] })

describe('publicTournamentAnswer', () => {
  it('names the four keys the contracts make optional, in one list', () => {
    expect([...MANAGER_ONLY_TOURNAMENT_KEYS]).toEqual(MANAGERS_ONLY)
  })

  it('hands a manager the answer as it was, the same object', () => {
    const given = answer()
    expect(publicTournamentAnswer(given, true)).toBe(given)
  })

  it('leaves the four keys out for anyone else, not as null, and keeps every other key', () => {
    const trimmed = publicTournamentAnswer(answer(), false)
    for (const key of MANAGERS_ONLY) expect(Object.hasOwn(trimmed, key), key).toBe(false)
    expect(trimmed).toEqual({ id: 't1', name: 'Fall Open', club_id: 'c1', sections: [] })
    expect(JSON.parse(JSON.stringify(trimmed))).toEqual(trimmed)
  })

  it('does not change the answer it is handed', () => {
    const given = answer()
    publicTournamentAnswer(given, false)
    expect(given).toEqual(answer())
  })

  it('is a no-op on an answer that carries none of the four', () => {
    expect(publicTournamentAnswer({ id: 't1' }, false)).toEqual({ id: 't1' })
  })
})

/** A database that answers the assignments query with the given events, and counts its queries. */
function assignmentsDb(directed: string[]) {
  const prepare = vi.fn((sql: string) => {
    expect(sql).toMatch(/FROM tournament_directors WHERE member_id = \?/)
    return { bind: () => ({ all: async () => ({ results: directed.map((id) => ({ tournament_id: id })) }) }) }
  })
  return { db: { prepare } as unknown as D1Database, prepare }
}

const EVENTS = [
  { id: 'own', club_id: 'c1' },
  { id: 'other', club_id: 'c2' },
  { id: 'directed', club_id: null },
  { id: 'loose', club_id: null },
]
const managed = async (viewer: { role: string; id: string; clubId: string | null } | null, directed: string[] = []) => {
  const { db, prepare } = assignmentsDb(directed)
  const manages = await eventsManagedBy(db, viewer)
  return { ids: EVENTS.filter(manages).map((e) => e.id), queries: prepare.mock.calls.length }
}

describe('eventsManagedBy, the list\'s manager rule', () => {
  it('someone signed out manages nothing, and nothing is read', async () => {
    expect(await managed(null, ['directed'])).toEqual({ ids: [], queries: 0 })
  })

  it('an LCA admin and both observer roles manage every event, with nothing read', async () => {
    for (const role of ['lca_admin', 'lca_observer', 'lca_officer']) {
      expect(await managed({ role, id: 'm1', clubId: null }), role).toEqual({ ids: ['own', 'other', 'directed', 'loose'], queries: 0 })
    }
  })

  it('a club rep manages their own club\'s events and the ones they direct, read once', async () => {
    expect(await managed({ role: 'club_rep', id: 'm1', clubId: 'c1' }, ['directed'])).toEqual({ ids: ['own', 'directed'], queries: 1 })
  })

  it('a club rep with no club manages no club-less event for want of one', async () => {
    expect(await managed({ role: 'club_rep', id: 'm1', clubId: null })).toEqual({ ids: [], queries: 1 })
  })

  it('a member with a club but not the rep\'s role manages only what they direct', async () => {
    expect(await managed({ role: 'member', id: 'm1', clubId: 'c1' }, ['directed'])).toEqual({ ids: ['directed'], queries: 1 })
  })

  it('a director manages the events they are assigned to, whatever their role', async () => {
    expect(await managed({ role: 'tournament_director', id: 'm1', clubId: null }, ['directed', 'other'])).toEqual({ ids: ['other', 'directed'], queries: 1 })
  })

  it('a guest manages nothing, an assignment included, and nothing is read', async () => {
    expect(await managed({ role: 'guest', id: 'm1', clubId: 'c1' }, ['directed'])).toEqual({ ids: [], queries: 0 })
  })

  it('reads the assignments once however many events are listed', async () => {
    const { db, prepare } = assignmentsDb(['e7'])
    const manages = await eventsManagedBy(db, { role: 'member', id: 'm1', clubId: null })
    const many = Array.from({ length: 300 }, (_, i) => ({ id: `e${i}`, club_id: null }))
    expect(many.filter(manages).map((e) => e.id)).toEqual(['e7'])
    expect(prepare).toHaveBeenCalledTimes(1)
  })
})

/** A roster row as the handler reads it. */
function entrant(fullName: string, guardianLink: number, entryMarked: number): RosterRead {
  return {
    member_id: `m-${fullName}`, section: 'Open', withdrawn_at: null, rating_at_entry: null,
    full_name: fullName, uscf_id: null, uscf_rating: null, guardian_link: guardianLink, entry_marked: entryMarked,
  }
}
const ROSTER_KEYS = ['full_name', 'member_id', 'rating_at_entry', 'section', 'uscf_id', 'uscf_rating', 'withdrawn_at']

describe('publicRoster', () => {
  const rows = [
    entrant('Leo Robichaux', 1, 0),
    entrant('Maya Fontenot', 0, 1),
    entrant('Ana de la Cruz', 1, 1),
    entrant('Pat Grownup', 0, 0),
  ]

  it('shortens an entrant with a guardian link or a confirmed range, and no one else', () => {
    expect(publicRoster(rows, true).map((r) => r.full_name)).toEqual(['Leo R.', 'Maya F.', 'Ana D.', 'Pat Grownup'])
  })

  it('leaves every name as stored when it is not to shorten', () => {
    expect(publicRoster(rows, false).map((r) => r.full_name)).toEqual(['Leo Robichaux', 'Maya Fontenot', 'Ana de la Cruz', 'Pat Grownup'])
    expect(publicRoster([entrant('  Leo   Robichaux ', 1, 1)], false)[0].full_name).toBe('  Leo   Robichaux ')
  })

  it('writes "Leo Robichaux V" and "Leo Robichaux 3rd" as "Leo R.", and a one-word name whole', () => {
    expect(publicRoster([entrant('Leo Robichaux V', 1, 0), entrant('Leo Robichaux 3rd', 0, 1), entrant('Leo', 1, 1)], true).map((r) => r.full_name))
      .toEqual(['Leo R.', 'Leo R.', 'Leo'])
  })

  it('answers the contract\'s keys alone, the two signs left out, either way', () => {
    for (const shorten of [false, true]) {
      for (const row of publicRoster(rows, shorten)) expect(Object.keys(row).sort()).toEqual(ROSTER_KEYS)
    }
  })

  it('changes nothing but the name, and not the rows it is handed', () => {
    const given = [{ ...entrant('Leo Robichaux', 1, 0), uscf_id: '12345678', uscf_rating: 1210, rating_at_entry: 1200, withdrawn_at: '2026-10-20 10:00:00' }]
    const copy = structuredClone(given)
    const [row] = publicRoster(given, true)
    expect(row).toEqual({ member_id: 'm-Leo Robichaux', section: 'Open', withdrawn_at: '2026-10-20 10:00:00', rating_at_entry: 1200, full_name: 'Leo R.', uscf_id: '12345678', uscf_rating: 1210 })
    expect(given).toEqual(copy)
  })

  it('passes the roster contract', () => {
    for (const shorten of [false, true]) {
      const roster = publicRoster(rows, shorten)
      expect(tournamentDetailResponseSchema.shape.roster.safeParse(roster).success, String(shorten)).toBe(true)
    }
  })
})

describe('publicClubAnswer', () => {
  const club = () => ({ id: 'c1', name: 'Kenner Chess Club', contact_email: 'club@example.org', city: 'Kenner' })

  it('hands the row back as it was while the email is shown', () => {
    const given = club()
    expect(publicClubAnswer(given, false)).toBe(given)
  })

  it('leaves contact_email out, not as null, once it is hidden, and does not change the row', () => {
    const given = club()
    const trimmed = publicClubAnswer(given, true)
    expect(Object.hasOwn(trimmed, 'contact_email')).toBe(false)
    expect(trimmed).toEqual({ id: 'c1', name: 'Kenner Chess Club', city: 'Kenner' })
    expect(given).toEqual(club())
  })
})

/** The keys of a strict object schema that accept a missing value. */
const optionalKeys = (shape: Record<string, { safeParse: (v: unknown) => { success: boolean } }>) =>
  Object.keys(shape).filter((key) => shape[key].safeParse(undefined).success).sort()

describe('the contracts', () => {
  it('make the four optional on the public list row and the public detail, and nothing else', () => {
    expect(optionalKeys(tournamentListItemSchema.shape)).toEqual(MANAGERS_ONLY)
    expect(optionalKeys(tournamentDetailSchema.shape)).toEqual(MANAGERS_ONLY)
  })

  it('keep every key required on the admin\'s answers and the manage page\'s', () => {
    expect(optionalKeys(adminTournamentResponseSchema.shape.tournament.shape)).toEqual([])
    expect(optionalKeys(tournamentManageResponseSchema.shape.tournament.shape)).toEqual([])
  })

  it('keep 46 keys in the public row, the four among them', () => {
    expect(Object.keys(tournamentListItemSchema.shape)).toHaveLength(46)
    expect(Object.keys(tournamentListItemSchema.shape)).toEqual(expect.arrayContaining(MANAGERS_ONLY))
  })

  it('make contact_email optional on the club page\'s answer alone, and give an officer no email', () => {
    expect(optionalKeys(clubDetailResponseSchema.shape.club.shape)).toEqual(['contact_email'])
    expect(optionalKeys(clubRowSchema.shape)).toEqual([])
    const officer = { id: 'o1', role: 'President', full_name: 'Pat Officer' }
    const page = (officers: unknown[]) => ({ club: { id: 'c1', name: 'Club', city: 'Kenner', location: null, description: null, meeting_schedule: null, created_at: '2026-10-01 12:00:00', color: null, image_url: null, region: null, latitude: null, longitude: null }, officers, tournaments: [], news: [] })
    expect(clubDetailResponseSchema.safeParse(page([officer])).success).toBe(true)
    expect(clubDetailResponseSchema.safeParse(page([{ ...officer, email: 'pat@example.org' }])).success).toBe(false)
  })
})

// ── The daily-emails worker ──────────────────────────────────────────

const ROOT = resolve(__dirname, '../..')

/** Every file the worker's entry reaches through relative imports, as its bundler would find them. */
function workerFiles(entry: string): Set<string> {
  const files = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (files.has(file)) continue
    files.add(file)
    for (const { fileName } of ts.preProcessFile(readFileSync(join(ROOT, file), 'utf8'), true, true).importedFiles) {
      if (!fileName.startsWith('.')) continue
      const base = resolve(dirname(join(ROOT, file)), fileName)
      const found = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((c) => existsSync(c) && statSync(c).isFile())
      expect(found, `${file}: ${fileName}`).toBeDefined()
      queue.push(relative(ROOT, found!))
    }
  }
  return files
}

/** The files the trim adds or changes under functions/utils/ and domain/, the paths the worker's deploy watches. */
const TRIM_SHARED = [
  'functions/utils/events/publicAnswer.ts',
  'functions/utils/clubs/publicAnswer.ts',
  'domain/contracts/events.ts',
  'domain/contracts/clubs.ts',
  'domain/households/publicName.ts',
]

describe('the daily-emails worker', () => {
  it('reaches its usual files, so the walk is not blind, and none the trim changes', () => {
    const files = workerFiles('workers/daily-emails/src/index.ts')
    for (const file of ['functions/utils/time.ts', 'functions/utils/email.ts', 'domain/format/centralTime.ts']) expect([...files], file).toContain(file)
    for (const file of TRIM_SHARED) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
  })
})
