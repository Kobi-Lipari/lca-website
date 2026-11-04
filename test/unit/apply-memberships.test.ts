// test/unit/apply-memberships.test.ts
//
// scripts/apply-memberships.mjs, mostly without a database: buildPlan on a
// hand-made snapshot (every kind of entry and every branch: a new member, a
// member found by email, a family whose guardian row is named by id, a
// family with a new guardian, a child already on the account, linked
// children with and without another guardian, a fourth child past the family
// coverage, updates with and without a new email, an expiry before today and
// dates that are not dates), then the same operations applied to the
// snapshot in memory and planned again, which must give nothing but skips.
// Also the plan and actor checks, the snapshot reader, the dry run's
// printing, the two service adapters and the command line's early stops, the
// Node version among them; the text for people the script never acts on
// ("decided" and decidedByK); a family that would take over a row holding a
// US Chess ID or tournament entries; and that every audit log action the
// script writes is one the site's AdminAction union names. Also the people to
// tell when an entry stops part way, named on the one list with a note; an
// audit log row that fails, tried once more under its id, then kept beside
// the plan for the next run to write, from the moment it fails, so a run
// stopped part way has kept it; an update's expiry given without a status; a
// guardian that has become a child by the time of the run; and two entries
// that reach one row, a child already on a family's account among them.
// Where a real database is wanted (answers that leave out meta.changes, a
// refusal after an account was made, and the command line from one run to
// the next), node:sqlite with the migrations applied stands in for D1. Every
// person here is invented.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import {
  AUDIT_ACTIONS,
  PlanError,
  buildPlan,
  centralToday,
  checkPlan,
  d1Http,
  execute,
  formatDate,
  isIsoDate,
  keepMissingAudit,
  loadSnapshot,
  main,
  membershipWords,
  missingAuditPath,
  nodeVersionProblem,
  readMissingAudit,
  supabaseAuth,
} from '../../scripts/apply-memberships.mjs'
import { openMigratedDb } from './helpers/sqlite'

interface Membership {
  status: string
  expiry: string | null
  type: string | null
}

interface Op {
  type: string
  text: string
  details?: string[]
  email?: string
  fullName?: string
  memberId?: string | null
  guardianId?: string | null
  childId?: string | null
  childKey?: string | null
  name?: string
  from?: unknown
  to?: unknown
  guard?: boolean
  keeps?: boolean
}

interface Group {
  index: number
  kind: string
  person: string
  notes: string[]
  audit: { actorId: string; actorEmail: string; reason: string }
  ops: Op[]
}

type Row = {
  id: string
  email: string
  full_name: string
  uscf_id: string | null
  role: string
  membership_status: string
  membership_expiry: string | null
  membership_type: string | null
  club_id: string | null
  guardian_id: string | null
  created_at: string
  row_order: number
}

const ROOT = join(__dirname, '../..')
const TODAY = '2026-11-03'
const SOURCE = 'Payments taken at the club table, entered by hand'

let order = 0
function row(fields: Partial<Row> & Pick<Row, 'id' | 'email' | 'full_name'>): Row {
  return {
    uscf_id: null,
    role: 'member',
    membership_status: 'none',
    membership_expiry: null,
    membership_type: null,
    club_id: null,
    guardian_id: null,
    created_at: '2025-06-01 12:00:00',
    row_order: ++order,
    ...fields,
  }
}

const ADMIN = row({ id: 'admin-1', email: 'Admin@Example.org', full_name: 'Avery Admin', role: 'lca_admin', membership_status: 'active', membership_expiry: '2027-12-31', membership_type: 'adult' })

const ROWS: Row[] = [
  ADMIN,
  // Found by email for an add entry; the email is stored with capitals.
  row({ id: 'mem-ben', email: 'Ben.Thistle@Example.org', full_name: 'Thistle, Ben', membership_status: 'expired', membership_expiry: '2026-03-31', membership_type: 'adult' }),
  // A guardian named by id: the row holding the email carries a child's name.
  row({ id: 'mem-cleo', email: 'cleo@example.org', full_name: 'Fernwood, Dov', membership_status: 'active', membership_expiry: '2027-02-28', membership_type: 'scholastic', club_id: 'club-1', created_at: '2025-03-01 12:00:00' }),
  // Already on that account.
  row({ id: 'child-dov', email: 'cleo@example.org', full_name: 'Dov Fernwood', club_id: 'club-1', guardian_id: 'mem-cleo', created_at: '2026-10-01 12:00:00' }),
  // To link: no guardian yet, an email of their own and a later expiry.
  row({ id: 'mem-esme', email: 'esme@example.org', full_name: 'Fernwood, Esme', membership_status: 'active', membership_expiry: '2028-02-29', membership_type: 'scholastic', created_at: '2025-01-10 12:00:00' }),
  // To link, but already on someone else's account.
  row({ id: 'mem-other', email: 'other@example.org', full_name: 'Otto Otherway' }),
  row({ id: 'mem-finn', email: 'finn@example.org', full_name: 'Fernwood, Finn', guardian_id: 'mem-other', created_at: '2025-04-01 12:00:00' }),
  // Updates: one with a placeholder email, one without an email change.
  row({ id: 'mem-kit', email: 'kit.placeholder@lca.invalid', full_name: 'Quillfeather, Kit', membership_status: 'active', membership_expiry: '2099-12-31', membership_type: 'adult' }),
  row({ id: 'mem-lark', email: 'lark@example.org', full_name: 'Ashdown, Lark', membership_status: 'expired', membership_expiry: '2026-03-31', membership_type: 'adult' }),
  row({ id: 'mem-pia', email: 'pia@example.org', full_name: 'Pia Sundown', membership_status: 'expired', membership_expiry: '2026-03-31', membership_type: 'adult' }),
]

const ENTRIES = [
  { kind: 'add', fullName: 'Ada Larkspur', email: 'Ada@Example.org', membershipExpiry: '2027-06-18', pending: 'the spelling of the surname is to be confirmed' },
  { kind: 'add', fullName: 'Ben Thistle', email: 'ben.thistle@example.org', membershipExpiry: '2027-06-18', note: 'paid at the club table' },
  {
    kind: 'family',
    memberId: 'mem-cleo',
    fullName: 'Cleo Fernwood',
    email: 'cleo@example.org',
    membershipExpiry: '2027-06-17',
    children: ['Dov Fernwood', 'Esme Fernwood', 'Finn Fernwood', 'Gus Fernwood', 'Hattie Fernwood'],
    linkExisting: [
      { memberId: 'mem-esme', fullName: 'Esme Fernwood' },
      { memberId: 'mem-finn', fullName: 'Finn Fernwood' },
    ],
  },
  { kind: 'family', fullName: 'Ivo Brambleton', email: 'ivo@example.org', membershipExpiry: '2027-07-26', children: ['Juno Brambleton'] },
  { kind: 'update', memberId: 'mem-kit', fullName: 'Quillfeather, Kit', email: 'kit@example.org', membershipExpiry: '2027-06-18', membershipStatus: 'active' },
  { kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown', email: 'lark@example.org', membershipExpiry: '2027-06-19', membershipStatus: 'active' },
  { kind: 'family', fullName: 'Milo Pastdue', email: 'milo@example.org', membershipExpiry: '2026-10-01', children: ['Nell Pastdue'] },
  { kind: 'update', memberId: 'mem-pia', membershipExpiry: '2026-10-15', membershipStatus: 'active' },
  { kind: 'add', fullName: 'Remy Slashdate', email: 'remy@example.org', membershipExpiry: '06/18/2027' },
  { kind: 'add', fullName: 'Sol Noday', email: 'sol@example.org', membershipExpiry: '2027-02-30' },
  { kind: 'add', fullName: 'Tess Lapsed', email: 'tess@example.org', membershipExpiry: '2026-10-15' },
  { kind: 'add', fullName: 'Uma Senior', email: 'uma@example.org', membershipExpiry: '2027-06-18', membershipType: 'senior' },
]

const plan = (entries: unknown[] = ENTRIES, extra: Record<string, unknown> = {}) => ({
  source: SOURCE,
  actor: { memberId: 'admin-1', email: 'admin@example.org' },
  defaults: { individualType: 'adult', familyType: 'family' },
  entries,
  ...extra,
})

const build = (entries: unknown[] = ENTRIES, rows: Row[] = ROWS, today = TODAY, registrationCounts: Record<string, number> = {}) =>
  buildPlan(plan(entries), { members: rows, registrationCounts }, today) as Group[]

/** A sign-in service with no accounts, for dry runs: any write is a failure. */
const noAccounts = {
  findUserByEmail: async () => null,
  createUser: async (): Promise<never> => Promise.reject(new Error('a write in a dry run')),
  updateEmail: async (): Promise<never> => Promise.reject(new Error('a write in a dry run')),
}

const steps = (group: Group) => group.ops.map((op) => [op.type, op.text])

/**
 * Applies the operations to a copy of the rows the way the script's writes
 * would: new accounts and child profiles get made-up ids, and new rows are
 * added after every existing one.
 */
function applyInMemory(rows: Row[], groups: Group[]): Row[] {
  const out = rows.map((r) => ({ ...r }))
  let last = Math.max(...out.map((r) => r.row_order))
  let made = 0
  const byId = (id: string | null | undefined) => {
    const found = out.find((r) => r.id === id)
    if (!found) throw new Error(`no row ${id}`)
    return found
  }
  for (const group of groups) {
    let account: string | null = null
    const children = new Map<string, string>()
    for (const op of group.ops) {
      const to = op.to as Partial<Membership>
      switch (op.type) {
        case 'create-sign-in':
          account = `auth-${++made}`
          break
        case 'insert-member':
          out.push(row({ id: account!, email: op.email!, full_name: op.fullName!, membership_status: to.status!, membership_expiry: to.expiry ?? null, membership_type: to.type ?? null, created_at: '2026-11-03 18:00:00', row_order: ++last }))
          break
        case 'set-membership': {
          const target = byId(op.memberId ?? account)
          if (to.status !== undefined) target.membership_status = to.status
          if (to.expiry !== undefined) target.membership_expiry = to.expiry
          if (to.type !== undefined) target.membership_type = to.type
          break
        }
        case 'rename':
          byId(op.memberId).full_name = op.to as string
          break
        case 'change-email':
          byId(op.memberId).email = op.to as string
          break
        case 'insert-child': {
          const guardian = byId(op.guardianId ?? account)
          const id = `child-made-${++made}`
          out.push(row({ id, email: guardian.email, full_name: op.fullName!, club_id: guardian.club_id, guardian_id: guardian.id, created_at: '2026-11-03 18:00:00', row_order: ++last }))
          children.set(op.childKey!, id)
          break
        }
        case 'link-child':
          byId(op.childId).guardian_id = op.guardianId ?? account
          break
        case 'cover-child': {
          const child = byId(op.childId ?? children.get(op.childKey!))
          child.membership_status = to.status!
          child.membership_expiry = to.expiry ?? null
          child.membership_type = to.type ?? null
          break
        }
      }
    }
  }
  return out
}

describe('dates and words', () => {
  it('reads only real dates written YYYY-MM-DD', () => {
    expect(isIsoDate('2027-06-18')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2027-02-29')).toBe(false)
    expect(isIsoDate('2027-6-18')).toBe(false)
    expect(isIsoDate('06/18/2027')).toBe(false)
    expect(isIsoDate('2027-06-18T00:00:00Z')).toBe(false)
    expect(isIsoDate(20270618)).toBe(false)
  })

  it('writes every date with its weekday, and memberships in words', () => {
    expect(formatDate('2026-11-03')).toBe('Tue, Nov 3, 2026')
    expect(formatDate('2028-02-29')).toBe('Tue, Feb 29, 2028')
    expect(membershipWords({ status: 'active', expiry: '2027-06-18', type: 'single_event' })).toBe('single event, active to Fri, Jun 18, 2027')
    expect(membershipWords({ status: 'expired', expiry: '2026-03-31', type: 'adult' })).toBe('adult, expired Tue, Mar 31, 2026')
    expect(membershipWords({ status: 'none', expiry: null, type: 'adult' })).toBe('no membership')
  })

  it("takes today from Louisiana's clock, not UTC's", () => {
    // 9 PM Central on Tuesday is already Wednesday in UTC.
    expect(centralToday(new Date('2026-11-04T03:00:00Z'))).toBe('2026-11-03')
    expect(centralToday(new Date('2026-11-04T06:30:00Z'))).toBe('2026-11-04')
  })
})

describe('buildPlan, entry by entry', () => {
  const groups = build()

  it('makes one group per entry, in order, carrying notes, pending text and the audit context', () => {
    expect(groups.map((g) => [g.index, g.kind, g.person])).toEqual([
      [1, 'add', 'Ada Larkspur <ada@example.org>'],
      [2, 'add', 'Ben Thistle <ben.thistle@example.org>'],
      [3, 'family', 'Cleo Fernwood <cleo@example.org>'],
      [4, 'family', 'Ivo Brambleton <ivo@example.org>'],
      [5, 'update', 'Quillfeather, Kit <kit@example.org>'],
      [6, 'update', 'Lark Ashdown <lark@example.org>'],
      [7, 'family', 'Milo Pastdue <milo@example.org>'],
      [8, 'update', 'Pia Sundown <pia@example.org>'],
      [9, 'add', 'Remy Slashdate <remy@example.org>'],
      [10, 'add', 'Sol Noday <sol@example.org>'],
      [11, 'add', 'Tess Lapsed <tess@example.org>'],
      [12, 'add', 'Uma Senior <uma@example.org>'],
    ])
    expect(groups[0].notes).toEqual(['pending: the spelling of the surname is to be confirmed'])
    expect(groups[1].notes).toEqual(['note: paid at the club table'])
    expect(groups[0].audit).toEqual({ actorId: 'admin-1', actorEmail: 'Admin@Example.org', reason: SOURCE })
  })

  it('add, new: a sign-in account, then a row with the default type, active from the expiry', () => {
    expect(steps(groups[0])).toEqual([
      ['create-sign-in', 'sign-in account for ada@example.org'],
      ['insert-member', 'member row for Ada Larkspur <ada@example.org>: adult, active to Fri, Jun 18, 2027'],
    ])
    expect(groups[0].ops[1]).toMatchObject({ email: 'ada@example.org', fullName: 'Ada Larkspur', to: { status: 'active', expiry: '2027-06-18', type: 'adult' } })
    expect(groups[11].ops[1]).toMatchObject({ to: { status: 'active', expiry: '2027-06-18', type: 'senior' } })
  })

  it('add, new, with an expiry already past: the row is made expired, not refused', () => {
    expect(steps(groups[10])).toEqual([
      ['create-sign-in', 'sign-in account for tess@example.org'],
      ['insert-member', 'member row for Tess Lapsed <tess@example.org>: adult, expired Thu, Oct 15, 2026'],
    ])
  })

  it('add, email already on a row (any capitals): only its membership changes, and it says so', () => {
    expect(steps(groups[1])).toEqual([
      ['skip', 'ben.thistle@example.org has a sign-in account already (the member row mem-ben), so none is made'],
      ['set-membership', 'membership of Thistle, Ben: adult, active to Fri, Jun 18, 2027 (was adult, expired Tue, Mar 31, 2026)'],
    ])
    expect(groups[1].ops[1]).toMatchObject({ memberId: 'mem-ben', to: { status: 'active', expiry: '2027-06-18', type: 'adult' } })
    expect(groups[1].ops[1].details).toEqual(['this email already has a member row (mem-ben), so its membership changes and its name stays "Thistle, Ben"'])
    expect(groups[1].ops.some((op) => op.type === 'rename')).toBe(false)
  })

  it('family, guardian row named by id: renamed, made family, children skipped, linked, refused, added, covered', () => {
    expect(steps(groups[2])).toEqual([
      ['skip', 'cleo@example.org has a sign-in account already (the member row mem-cleo), so none is made'],
      ['rename', '"Fernwood, Dov" to "Cleo Fernwood" (mem-cleo); the row holds no US Chess ID and no tournament entries'],
      ['set-membership', 'membership of Cleo Fernwood: family, active to Thu, Jun 17, 2027 (was scholastic, active to Sun, Feb 28, 2027)'],
      ['skip', 'child Dov Fernwood is already on this account'],
      ['link-child', 'Fernwood, Esme (mem-esme) as a child of this account'],
      ['refuse', 'child Finn Fernwood: the row mem-finn (Fernwood, Finn) is already a child of another account (mem-other), so it is left alone'],
      ['insert-child', 'child profile Gus Fernwood'],
      ['insert-child', 'child profile Hattie Fernwood'],
      // Coverage follows when each child was added: Esme's row is the oldest.
      ['cover-child', 'family coverage for Fernwood, Esme: family, active to Tue, Feb 29, 2028 (was scholastic, active to Tue, Feb 29, 2028)'],
      ['cover-child', 'family coverage for Dov Fernwood: family, active to Thu, Jun 17, 2027 (was no membership)'],
      ['cover-child', 'family coverage for Gus Fernwood: family, active to Thu, Jun 17, 2027 (was no membership)'],
      ['skip', 'Hattie Fernwood is not covered: a family membership covers the first 3 children by when they were added, and Hattie Fernwood is number 4'],
    ])
    const [, , membership, , link, , gus, , esme, dov, gusCover] = groups[2].ops
    expect(membership).toMatchObject({ memberId: 'mem-cleo', to: { status: 'active', expiry: '2027-06-17', type: 'family' } })
    expect(link).toMatchObject({ childId: 'mem-esme', guardianId: 'mem-cleo' })
    expect(gus).toMatchObject({ guardianId: 'mem-cleo', fullName: 'Gus Fernwood', childKey: 'gus fernwood' })
    // A child's own later expiry is kept, as syncFamilyCoverage keeps it.
    expect(esme).toMatchObject({ childId: 'mem-esme', to: { status: 'active', expiry: '2028-02-29', type: 'family' } })
    expect(dov).toMatchObject({ childId: 'child-dov', to: { status: 'active', expiry: '2027-06-17', type: 'family' } })
    expect(gusCover).toMatchObject({ childId: null, childKey: 'gus fernwood', guardianId: 'mem-cleo' })
  })

  it('family, new guardian: an account made as for add, then the child and its coverage', () => {
    expect(steps(groups[3])).toEqual([
      ['create-sign-in', 'sign-in account for ivo@example.org'],
      ['insert-member', 'member row for Ivo Brambleton <ivo@example.org>: family, active to Mon, Jul 26, 2027'],
      ['insert-child', 'child profile Juno Brambleton'],
      ['cover-child', 'family coverage for Juno Brambleton: family, active to Mon, Jul 26, 2027 (was no membership)'],
    ])
    // The new account's id is known only when it is made.
    expect(groups[3].ops[2]).toMatchObject({ guardianId: null })
    expect(groups[3].ops[3]).toMatchObject({ guardianId: null, childId: null, childKey: 'juno brambleton' })
  })

  it('update with a new email: the sign-in account first, and a warning when the expiry gets earlier', () => {
    expect(steps(groups[4])).toEqual([
      ['change-email', 'kit.placeholder@lca.invalid to kit@example.org (mem-kit), on the sign-in account first and then on the row'],
      ['skip', 'name is already "Quillfeather, Kit"'],
      ['set-membership', 'membership of Quillfeather, Kit: adult, active to Fri, Jun 18, 2027 (was adult, active to Thu, Dec 31, 2099)'],
    ])
    expect(groups[4].ops[0]).toMatchObject({ memberId: 'mem-kit', from: 'kit.placeholder@lca.invalid', to: 'kit@example.org' })
    expect(groups[4].ops[2].to).toEqual({ status: 'active', expiry: '2027-06-18' })
    expect(groups[4].ops[2].details).toEqual(['warning: this ends the membership earlier than the date it holds now, Thu, Dec 31, 2099'])
  })

  it('update without a new email: the email is a skip, the name and membership change', () => {
    expect(steps(groups[5])).toEqual([
      ['skip', 'email is already lark@example.org'],
      ['rename', '"Ashdown, Lark" to "Lark Ashdown" (mem-lark); the row holds no US Chess ID and no tournament entries'],
      ['set-membership', 'membership of Lark Ashdown: adult, active to Sat, Jun 19, 2027 (was adult, expired Tue, Mar 31, 2026)'],
    ])
  })

  it('refuses an active membership that ends before today, and dates that are not YYYY-MM-DD dates', () => {
    expect(steps(groups[6])).toEqual([
      ['refuse', 'entry 7: a family membership is made active, so it cannot end before today: Thu, Oct 1, 2026 is before Tue, Nov 3, 2026'],
    ])
    expect(steps(groups[7])).toEqual([
      ['refuse', 'entry 8: an active membership cannot end before today: Thu, Oct 15, 2026 is before Tue, Nov 3, 2026'],
    ])
    expect(steps(groups[8])).toEqual([['refuse', 'entry 9: membershipExpiry "06/18/2027" is not a date written YYYY-MM-DD']])
    expect(steps(groups[9])).toEqual([['refuse', 'entry 10: membershipExpiry "2027-02-30" is not a date written YYYY-MM-DD']])
  })

  it('refuses an update to "active" that leaves a past expiry on the row', () => {
    const [group] = build([{ kind: 'update', memberId: 'mem-pia', membershipStatus: 'active' }])
    expect(steps(group)).toEqual([['refuse', 'an active membership cannot end before today: Tue, Mar 31, 2026 is before Tue, Nov 3, 2026']])
  })
})

describe('buildPlan refusals', () => {
  const only = (entry: unknown, rows: Row[] = ROWS) => steps(build([entry], rows)[0])

  it('refuses unknown kinds, unknown fields and missing fields', () => {
    expect(only({ kind: 'remove', memberId: 'mem-ben' })).toEqual([['refuse', 'entry 1: kind "remove" is not add, family or update']])
    expect(only({ kind: 'update', memberId: 'mem-ben', membershipStatu: 'active' })).toEqual([
      ['refuse', 'entry 1: "membershipStatu" is not a field of update entries; it names nothing to change'],
    ])
    expect(only({ kind: 'add', fullName: 'Vera Nomail', membershipExpiry: '2027-06-18' })).toEqual([['refuse', 'entry 1: email is missing']])
    expect(only({ kind: 'add', fullName: ' ', email: 'blank@example.org', membershipExpiry: '2027-06-18' })).toEqual([['refuse', 'entry 1: fullName is empty']])
    expect(only({ kind: 'add', fullName: 'Wren Typo', email: 'wren.example.org', membershipExpiry: '2027-06-18' })).toEqual([
      ['refuse', 'entry 1: email "wren.example.org" is not an email address'],
    ])
  })

  it('refuses the later of two entries for the same person', () => {
    const groups = build([
      { kind: 'add', fullName: 'Ada Larkspur', email: 'ada@example.org', membershipExpiry: '2027-06-18' },
      { kind: 'family', fullName: 'Ada Larkspur', email: 'ADA@example.org', membershipExpiry: '2027-06-18', children: [] },
    ])
    expect(groups[0].ops[0].type).toBe('create-sign-in')
    expect(steps(groups[1])).toEqual([['refuse', 'entry 2: entry 1 already names ada@example.org']])
  })

  it('refuses an email held by two account rows, but not one shared with child profiles', () => {
    const twins = [...ROWS, row({ id: 'mem-ben-2', email: 'ben.thistle@example.org', full_name: 'Ben Thistle' })]
    expect(only({ kind: 'add', fullName: 'Ben Thistle', email: 'ben.thistle@example.org', membershipExpiry: '2027-06-18' }, twins)).toEqual([
      ['refuse', '2 member rows hold ben.thistle@example.org (mem-ben, mem-ben-2); decide by hand which one is the account'],
    ])
    // cleo@example.org is on Cleo's row and on Dov's child profile: the account is Cleo's.
    expect(only({ kind: 'add', fullName: 'Cleo Fernwood', email: 'cleo@example.org', membershipExpiry: '2027-06-17' }).map(([type]) => type)).toEqual(['skip', 'set-membership'])
  })

  it("refuses a family whose named row holds another email, or whose row is someone's child", () => {
    expect(only({ kind: 'family', memberId: 'mem-lark', fullName: 'Lark Ashdown', email: 'cleo@example.org', membershipExpiry: '2027-06-17', children: [] })).toEqual([
      ['refuse', "the row mem-lark holds lark@example.org, not cleo@example.org; correct the plan, or change the row's email with an update entry first"],
    ])
    expect(only({ kind: 'family', fullName: 'Finn Fernwood', email: 'finn@example.org', membershipExpiry: '2027-06-17', children: [] })).toEqual([
      ['refuse', 'Fernwood, Finn <finn@example.org> is a child on another account (mem-other), and a child cannot be a guardian'],
    ])
    expect(only({ kind: 'family', memberId: 'child-dov', fullName: 'Dov Fernwood', email: 'cleo@example.org', membershipExpiry: '2027-06-17', children: [] })).toEqual([
      ['refuse', 'Dov Fernwood <cleo@example.org> is a child profile, not an account that can hold a family membership'],
    ])
    expect(only({ kind: 'family', memberId: 'mem-gone', fullName: 'Xavi Gone', email: 'xavi@example.org', membershipExpiry: '2027-06-17', children: [] })).toEqual([
      ['refuse', 'no member row has the id mem-gone'],
    ])
  })

  it('refuses a link to a name that is not among the children, and a child listed twice', () => {
    expect(only({ kind: 'family', fullName: 'Yara Hollow', email: 'yara@example.org', membershipExpiry: '2027-06-17', children: ['Zeb Hollow'], linkExisting: [{ memberId: 'mem-esme', fullName: 'Esme Fernwood' }] })).toEqual([
      ['refuse', 'entry 1: linkExisting names Esme Fernwood, who is not in children'],
    ])
    expect(only({ kind: 'family', fullName: 'Yara Hollow', email: 'yara@example.org', membershipExpiry: '2027-06-17', children: ['Zeb Hollow', 'zeb hollow'] })).toEqual([
      ['refuse', 'entry 1: zeb hollow is listed twice in children'],
    ])
  })

  it("refuses an email change to a child profile, or to an email another account holds", () => {
    expect(only({ kind: 'update', memberId: 'child-dov', email: 'dov@example.org' })).toEqual([
      ['refuse', 'Dov Fernwood <cleo@example.org> has no sign-in account of its own, so its email cannot change here'],
    ])
    expect(only({ kind: 'update', memberId: 'mem-kit', email: 'LARK@example.org' })).toEqual([
      ['refuse', 'lark@example.org already belongs to Ashdown, Lark <lark@example.org>'],
    ])
    expect(only({ kind: 'update', memberId: 'mem-none', fullName: 'Nobody Here' })).toEqual([['refuse', 'no member row has the id mem-none']])
  })

  it('refuses a ninth child on one account, as the site does', () => {
    const crowded = [...ROWS, ...Array.from({ length: 6 }, (_, i) => row({ id: `child-kid-${i}`, email: 'cleo@example.org', full_name: `Kid ${i} Fernwood`, guardian_id: 'mem-cleo' }))]
    const [group] = build([{ kind: 'family', memberId: 'mem-cleo', fullName: 'Cleo Fernwood', email: 'cleo@example.org', membershipExpiry: '2027-06-17', children: ['Gus Fernwood', 'Hattie Fernwood'] }], crowded)
    expect(group.ops.filter((op) => op.type === 'insert-child').map((op) => op.fullName)).toEqual(['Gus Fernwood'])
    expect(group.ops).toContainEqual({ type: 'refuse', text: 'child Hattie Fernwood: an account can hold at most 8 children' })
  })
})

describe('the plan as a whole', () => {
  it('stops the whole run when the actor is not an admin, or not who the plan says', () => {
    const member = ROWS.map((r) => (r.id === 'admin-1' ? { ...r, role: 'member' } : r))
    expect(() => buildPlan(plan(), { members: member }, TODAY)).toThrow(PlanError)
    expect(() => buildPlan(plan(), { members: member }, TODAY)).toThrow('Avery Admin <Admin@Example.org> is not an admin (role member)')
    expect(() => buildPlan(plan(ENTRIES, { actor: { memberId: 'admin-1', email: 'someone@example.org' } }), { members: ROWS }, TODAY)).toThrow(
      "The actor's row (admin-1) holds Admin@Example.org, not someone@example.org.",
    )
    expect(() => buildPlan(plan(), { members: ROWS.slice(1) }, TODAY)).toThrow("No member row has the actor's id, admin-1.")
  })

  it('stops the whole run on a plan without its source, defaults or entries, or a bad today', () => {
    expect(() => checkPlan([])).toThrow('The plan file must hold one JSON object.')
    expect(() => checkPlan(plan(ENTRIES, { source: ' ' }))).toThrow('"source" must say where these changes come from')
    expect(() => checkPlan(plan(ENTRIES, { defaults: { individualType: 'adult', familyType: 'adult' } }))).toThrow('"defaults.familyType" must be family')
    expect(() => checkPlan(plan([]))).toThrow('"entries" must be a list with at least one entry.')
    expect(() => buildPlan(plan(), { members: ROWS }, '11/03/2026')).toThrow('today must be a date written YYYY-MM-DD')
  })
})

describe('building again after the changes', () => {
  it('gives only skips, and the same refusals as before', () => {
    const first = build()
    const after = applyInMemory(ROWS, first)
    const second = build(ENTRIES, after)

    const refusals = (groups: Group[]) => groups.flatMap((g) => g.ops.filter((op) => op.type === 'refuse').map((op) => op.text))
    expect(refusals(second)).toEqual(refusals(first))
    expect(second.flatMap((g) => g.ops).filter((op) => op.type !== 'skip' && op.type !== 'refuse')).toEqual([])

    expect(steps(second[2])).toEqual([
      ['skip', 'cleo@example.org has a sign-in account already (the member row mem-cleo), so none is made'],
      ['skip', 'name is already "Cleo Fernwood"'],
      ['skip', 'membership of Cleo Fernwood is already family, active to Thu, Jun 17, 2027'],
      ['skip', 'child Dov Fernwood is already on this account'],
      ['skip', 'Fernwood, Esme (mem-esme) is already linked to this account'],
      ['refuse', 'child Finn Fernwood: the row mem-finn (Fernwood, Finn) is already a child of another account (mem-other), so it is left alone'],
      ['skip', 'child Gus Fernwood is already on this account'],
      ['skip', 'child Hattie Fernwood is already on this account'],
      ['skip', 'Fernwood, Esme is already covered: family, active to Tue, Feb 29, 2028'],
      ['skip', 'Dov Fernwood is already covered: family, active to Thu, Jun 17, 2027'],
      ['skip', 'Gus Fernwood is already covered: family, active to Thu, Jun 17, 2027'],
      ['skip', 'Hattie Fernwood is not covered: a family membership covers the first 3 children by when they were added, and Hattie Fernwood is number 4'],
    ])
    // The account the first run made is said to be there, so the two runs can be matched up.
    expect(steps(second[0])).toEqual([
      ['skip', 'ada@example.org has a sign-in account already (the member row auth-1), so none is made'],
      ['skip', 'membership of Ada Larkspur is already adult, active to Fri, Jun 18, 2027'],
    ])

    // And the rows themselves are what the site would hold.
    const byId = new Map(after.map((r) => [r.id, r]))
    expect(byId.get('mem-cleo')).toMatchObject({ full_name: 'Cleo Fernwood', membership_type: 'family', membership_expiry: '2027-06-17' })
    expect(byId.get('mem-esme')).toMatchObject({ guardian_id: 'mem-cleo', membership_type: 'family', membership_expiry: '2028-02-29' })
    expect(byId.get('mem-finn')).toMatchObject({ guardian_id: 'mem-other', membership_status: 'none' })
    const kids = after.filter((r) => r.guardian_id === 'mem-cleo').map((r) => [r.full_name, r.email, r.club_id, r.membership_status])
    expect(kids).toEqual([
      ['Dov Fernwood', 'cleo@example.org', 'club-1', 'active'],
      ['Fernwood, Esme', 'esme@example.org', null, 'active'],
      ['Gus Fernwood', 'cleo@example.org', 'club-1', 'active'],
      ['Hattie Fernwood', 'cleo@example.org', 'club-1', 'none'],
    ])
  })
})

/**
 * A database that answers reads from a list of rows, and from a count of
 * tournament entries for each member id, and refuses every write.
 */
function readOnlyDb(rows: Row[], registrations: Record<string, number> = {}) {
  const statements: Array<{ sql: string; params: unknown[] }> = []
  return {
    statements,
    async query(sql: string, params: unknown[] = []) {
      statements.push({ sql, params })
      if (!/^\s*SELECT\b/i.test(sql)) throw new Error(`a write in a read-only test: ${sql}`)
      const has = (p: unknown) => params.includes(p)
      if (/FROM registrations WHERE member_id IN/.test(sql)) {
        return { results: Object.entries(registrations).filter(([id]) => has(id)).map(([member_id, n]) => ({ member_id, n })), changes: null }
      }
      if (/FROM registrations WHERE member_id = \?/.test(sql)) return { results: [{ n: registrations[String(params[0])] ?? 0 }], changes: null }
      if (/WHERE id IN/.test(sql)) return { results: rows.filter((r) => has(r.id)), changes: null }
      if (/WHERE lower\(email\) IN/.test(sql)) return { results: rows.filter((r) => has(r.email.toLowerCase())), changes: null }
      if (/WHERE guardian_id IN/.test(sql)) return { results: rows.filter((r) => has(r.guardian_id)), changes: null }
      if (/WHERE id = \?/.test(sql)) return { results: rows.filter((r) => r.id === params[0]), changes: null }
      return { results: [], changes: null }
    },
  }
}

describe('loadSnapshot', () => {
  it("reads by id and by lower-cased email, then every child, then each row's tournament entries, with parameters only", async () => {
    // mem-gone has entries but is not among the rows read, so it is not counted.
    const db = readOnlyDb(ROWS, { 'mem-cleo': 2, 'mem-gone': 5 })
    const snapshot = await loadSnapshot(db, plan())
    const ids = snapshot.members.map((r: Row) => r.id).sort()
    expect(ids).toEqual(['admin-1', 'child-dov', 'mem-ben', 'mem-cleo', 'mem-esme', 'mem-finn', 'mem-kit', 'mem-lark', 'mem-pia'])
    expect(snapshot.registrationCounts).toEqual({ 'mem-cleo': 2 })
    expect(db.statements).toHaveLength(4)
    expect(db.statements[1].params).toContain('ada@example.org')
    for (const { sql } of db.statements.slice(0, 3)) expect(sql).toMatch(/^SELECT rowid AS row_order, id, email, full_name, uscf_id, /)
    expect(db.statements[3].sql).toMatch(/^SELECT member_id, COUNT\(\*\) AS n FROM registrations WHERE member_id IN \((\?, )*\?\) GROUP BY member_id$/)
    expect([...db.statements[3].params].sort()).toEqual(ids)
    for (const { sql } of db.statements) expect(sql).not.toMatch(/example\.org|Fernwood|admin-1|mem-/)
  })
})

describe('execute, dry run', () => {
  it('prints each person and what would happen, reads only, and lists the sign-in accounts it would make', async () => {
    const db = readOnlyDb(ROWS)
    const lines: string[] = []
    const auth = {
      async findUserByEmail(email: string) {
        return email === 'ivo@example.org' ? { id: 'auth-ivo', email, signedIn: false } : null
      },
      async createUser(): Promise<never> {
        throw new Error('a write in a dry run')
      },
      async updateEmail(): Promise<never> {
        throw new Error('a write in a dry run')
      },
    }
    const groups = build(ENTRIES.slice(0, 6))
    const result = await execute(groups, { auth, d1: db, apply: false, log: (line: string) => lines.push(line) })

    expect(lines[0]).toBe('Dry run: nothing is written. Run again with --apply to make these changes.')
    expect(lines).toContain('1. ADD Ada Larkspur <ada@example.org>')
    expect(lines).toContain('   pending: the spelling of the surname is to be confirmed')
    expect(lines).toContain('   CREATE  sign-in account for ada@example.org (new, with no password until they set one)')
    expect(lines).toContain('   CREATE  sign-in account for ivo@example.org: one already uses this email (auth-ivo), so its id becomes the member id')
    expect(lines).toContain('           this email already has a member row (mem-ben), so its membership changes and its name stays "Thistle, Ben"')
    expect(lines).toContain('   REFUSE  child Finn Fernwood: the row mem-finn (Fernwood, Finn) is already a child of another account (mem-other), so it is left alone')
    expect(lines).toContain('   EMAIL   kit.placeholder@lca.invalid to kit@example.org (mem-kit), on the sign-in account first and then on the row')
    expect(lines).toContain('           warning: this ends the membership earlier than the date it holds now, Thu, Dec 31, 2099')
    expect(lines).toContain('   SKIP    ben.thistle@example.org has a sign-in account already (the member row mem-ben), so none is made')
    expect(lines).toContain('Summary of the dry run, nothing written: would create 5, link 1, update 11; skipped 6; failed 1.')
    expect(lines).toContain('Failed or refused: Cleo Fernwood <cleo@example.org>. Fix the cause and run the script again; whatever already holds is skipped.')
    expect(lines.at(-1)).toBe('Sign-in accounts the real run would make: Ada Larkspur <ada@example.org>; Ivo Brambleton <ivo@example.org>.')
    expect(result.exitCode).toBe(1)
    expect(db.statements.every(({ sql }) => /^\s*SELECT\b/.test(sql))).toBe(true)
  })

  it('stops a person whose sign-in account already has a row under another email', async () => {
    const db = readOnlyDb([...ROWS, row({ id: 'auth-taken', email: 'old@example.org', full_name: 'Ada Larkspur' })])
    const lines: string[] = []
    const auth = {
      findUserByEmail: async (email: string) => ({ id: 'auth-taken', email, signedIn: true }),
      createUser: async () => ({ id: 'never' }),
      updateEmail: async () => undefined,
    }
    const result = await execute(build(ENTRIES.slice(0, 1)), { auth, d1: db, apply: false, log: (line: string) => lines.push(line) })
    expect(lines).toContain(
      '   FAIL    sign-in account for ada@example.org: a sign-in account (auth-taken) already uses this email, and its member row holds old@example.org; settle it by hand',
    )
    expect(lines.some((line) => line.includes('member row for Ada Larkspur'))).toBe(false)
    expect(result.exitCode).toBe(1)
  })
})

describe('the sign-in service adapter', () => {
  function fakeClient(pages: Array<Array<{ id: string; email: string; last_sign_in_at?: string | null }>>) {
    const calls: unknown[][] = []
    let createError: { message: string; code?: string } | null = null
    return {
      calls,
      failCreateWith(error: { message: string; code?: string }) {
        createError = error
      },
      auth: {
        admin: {
          async listUsers(params: { page: number; perPage: number }) {
            calls.push(['listUsers', params])
            return { data: { users: pages[params.page - 1] ?? [] }, error: null }
          },
          async createUser(attributes: Record<string, unknown>) {
            calls.push(['createUser', attributes])
            return createError ? { data: { user: null }, error: createError } : { data: { user: { id: 'auth-new' } }, error: null }
          },
          async updateUserById(id: string, attributes: Record<string, unknown>) {
            calls.push(['updateUserById', id, attributes])
            return { data: { user: { id } }, error: null }
          },
        },
      },
    }
  }

  it('finds an account by email in any capitals, reading the list once, page by page', async () => {
    const client = fakeClient([
      [{ id: 'a1', email: 'one@example.org', last_sign_in_at: '2026-10-01T12:00:00Z' }, { id: 'a2', email: 'two@example.org' }],
      [{ id: 'a3', email: 'Three@Example.org', last_sign_in_at: null }],
    ])
    const auth = supabaseAuth(client, { pageSize: 2 })
    expect(await auth.findUserByEmail('THREE@example.org')).toEqual({ id: 'a3', email: 'Three@Example.org', signedIn: false })
    expect(await auth.findUserByEmail('one@example.org')).toEqual({ id: 'a1', email: 'one@example.org', signedIn: true })
    expect(await auth.findUserByEmail('nobody@example.org')).toBeNull()
    expect(client.calls).toEqual([
      ['listUsers', { page: 1, perPage: 2 }],
      ['listUsers', { page: 2, perPage: 2 }],
    ])
  })

  it('makes accounts with the email confirmed and the name, and reports a taken email as a duplicate', async () => {
    const client = fakeClient([[]])
    const auth = supabaseAuth(client)
    expect(await auth.createUser({ email: 'new@example.org', fullName: 'New Person' })).toEqual({ id: 'auth-new' })
    expect(client.calls[0]).toEqual(['createUser', { email: 'new@example.org', email_confirm: true, user_metadata: { full_name: 'New Person' } }])
    client.failCreateWith({ message: 'A user with this email address has already been registered', code: 'email_exists' })
    expect(await auth.createUser({ email: 'new@example.org', fullName: 'New Person' })).toEqual({ duplicate: true })
    client.failCreateWith({ message: 'Database error creating new user' })
    await expect(auth.createUser({ email: 'x@example.org', fullName: 'X' })).rejects.toThrow('could not make the sign-in account: Database error creating new user')
  })

  it('changes an email with it confirmed, and finds the account under the new one afterwards', async () => {
    const client = fakeClient([[{ id: 'a1', email: 'old@example.org' }]])
    const auth = supabaseAuth(client)
    expect(await auth.findUserByEmail('old@example.org')).toMatchObject({ id: 'a1' })
    await auth.updateEmail('a1', 'new@example.org')
    expect(client.calls.at(-1)).toEqual(['updateUserById', 'a1', { email: 'new@example.org', email_confirm: true }])
    expect(await auth.findUserByEmail('new@example.org')).toMatchObject({ id: 'a1' })
    expect(await auth.findUserByEmail('old@example.org')).toBeNull()
  })
})

describe('the database adapter', () => {
  const TOKEN = 'token-value-for-the-test'
  const ACCOUNT = 'account-value-for-the-test'

  function fakeFetch(answer: { status?: number; body: string }) {
    const requests: Array<{ url: string; init: RequestInit }> = []
    const fetchFn = async (url: string, init: RequestInit) => {
      requests.push({ url, init })
      return new Response(answer.body, { status: answer.status ?? 200 })
    }
    return { requests, fetchFn }
  }

  it('sends one parameterised statement to the production database and reads results and changes', async () => {
    const { requests, fetchFn } = fakeFetch({ body: JSON.stringify({ success: true, result: [{ success: true, results: [{ id: 'm1' }], meta: { changes: 1 } }] }) })
    const d1 = d1Http(fetchFn, TOKEN, ACCOUNT)
    expect(await d1.query('SELECT id FROM members WHERE id = ?', ['m1'])).toEqual({ results: [{ id: 'm1' }], changes: 1 })
    expect(requests[0].url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/e891b93f-e7fe-48d0-9afc-8570d805ef08/query`)
    expect(requests[0].init.method).toBe('POST')
    expect(requests[0].init.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' })
    expect(JSON.parse(String(requests[0].init.body))).toEqual({ sql: 'SELECT id FROM members WHERE id = ?', params: ['m1'] })
  })

  it('reports changes as unknown when the answer leaves them out', async () => {
    const { fetchFn } = fakeFetch({ body: JSON.stringify({ success: true, result: [{ results: [] }] }) })
    expect(await d1Http(fetchFn, TOKEN, ACCOUNT).query('UPDATE members SET full_name = ? WHERE id = ?', ['A', 'm1'])).toEqual({ results: [], changes: null })
  })

  it('never repeats the token or the account id in an error', async () => {
    const { fetchFn } = fakeFetch({
      status: 400,
      body: JSON.stringify({ success: false, errors: [{ code: 7003, message: `Could not route to /client/v4/accounts/${ACCOUNT}/d1/database/x/query (${TOKEN})` }] }),
    })
    const failure = await d1Http(fetchFn, TOKEN, ACCOUNT).query('SELECT 1').catch((err: Error) => err)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toContain('/accounts/[account]/d1/database')
    expect((failure as Error).message).toContain('([token])')
    expect((failure as Error).message).not.toContain(ACCOUNT)
    expect((failure as Error).message).not.toContain(TOKEN)

    const down = async () => {
      throw new Error(`connect failed for ${ACCOUNT}`)
    }
    await expect(d1Http(down, TOKEN, ACCOUNT).query('SELECT 1')).rejects.toThrow('the database could not be reached: connect failed for [account]')
    const html = fakeFetch({ status: 502, body: '<html>Bad gateway</html>' })
    await expect(d1Http(html.fetchFn, TOKEN, ACCOUNT).query('SELECT 1')).rejects.toThrow('the database answered HTTP 502 with something other than JSON')
  })
})

describe('the command line', () => {
  const work = mkdtempSync(join(tmpdir(), 'apply-memberships-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  const planFile = join(work, 'plan.json')
  writeFileSync(planFile, JSON.stringify(plan(ENTRIES.slice(0, 1))))

  async function run(argv: string[], env: Record<string, string> = {}) {
    const out: string[] = []
    const err: string[] = []
    const fetchFn = async () => {
      throw new Error('the command line reached the network in a test')
    }
    const code = await main(argv, { env, log: (line: string) => out.push(line), error: (line: string) => err.push(line), fetchFn })
    return { code, out, err }
  }

  it('runs as a command and stops with the usage when no plan is given', () => {
    // No credentials of any kind reach the child process.
    const result = spawnSync(process.execPath, ['scripts/apply-memberships.mjs'], { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } })
    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe('Usage: node scripts/apply-memberships.mjs <plan.json> [--apply]')
  }, 20_000)

  it('refuses unknown options and a plan file inside the repository', async () => {
    expect((await run([planFile, '--force'])).err).toEqual(['Unknown option --force. Usage: node scripts/apply-memberships.mjs <plan.json> [--apply]'])
    const inside = await run([join(ROOT, 'package.json')])
    expect(inside.code).toBe(1)
    expect(inside.err[0]).toMatch(/is inside the repository\. It holds people's names and emails, so move it outside the repository and run again\.$/)
  })

  it('names each missing variable, never prints a value, and reads nothing before they are all set', async () => {
    const { code, out, err } = await run([planFile, '--apply'], { SUPABASE_URL: 'https://sign-in.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'value-that-must-not-print' })
    expect(code).toBe(1)
    expect(out).toEqual([])
    expect(err).toEqual(['Missing environment variables: CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID). Set them and run again.'])
    expect(err.join(' ')).not.toContain('value-that-must-not-print')

    const one = await run([planFile], { SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', CLOUDFLARE_ACCOUNT_ID: 'z' })
    expect(one.err).toEqual(['Missing environment variable: CLOUDFLARE_API_TOKEN. Set it and run again.'])
  })

  it('checks the plan file before anything else', async () => {
    const broken = join(work, 'broken.json')
    writeFileSync(broken, JSON.stringify({ ...plan(), source: '' }))
    const { code, err } = await run([broken])
    expect(code).toBe(1)
    expect(err[0]).toBe(`The plan file ${broken} cannot be used: "source" must say where these changes come from; it becomes the reason in the audit log.`)
  })
})

// ── Edges: the same child twice, letter case, expiries that differ, ──
// ── duplicate sign-in accounts, secrets in errors, missing variables ──

describe('a family that names the same child twice', () => {
  const family = (children: string[], extra: Record<string, unknown> = {}) => ({
    kind: 'family',
    fullName: 'Yara Hollow',
    email: 'yara@example.org',
    membershipExpiry: '2027-06-17',
    children,
    ...extra,
  })
  const only = (entry: unknown, rows: Row[] = ROWS) => steps(build([entry], rows)[0])

  it('refuses the whole entry for a name written twice, however the letters or spaces differ', () => {
    expect(only(family(['Zeb Hollow', 'Zeb Hollow']))).toEqual([['refuse', 'entry 1: Zeb Hollow is listed twice in children']])
    expect(only(family(['Zeb Hollow', '  ZEB hollow  ']))).toEqual([['refuse', 'entry 1: ZEB hollow is listed twice in children']])
  })

  it('makes no guardian account and no child profile for a refused entry', () => {
    const [group] = build([family(['Zeb Hollow', 'zeb hollow', 'Ida Hollow'])])
    expect(group.ops.map((op) => op.type)).toEqual(['refuse'])
  })

  it('refuses a child already on the account when the plan writes that child twice', () => {
    expect(only(family(['Dov Fernwood', 'dov fernwood'], { memberId: 'mem-cleo', fullName: 'Cleo Fernwood', email: 'cleo@example.org' }))).toEqual([
      ['refuse', 'entry 1: dov fernwood is listed twice in children'],
    ])
  })

  it('refuses a linked row named twice, and one name linked to two rows', () => {
    const link = (items: Array<{ memberId: string; fullName: string }>) =>
      only(family(['Esme Fernwood', 'Esme F'], { linkExisting: items }))
    expect(link([{ memberId: 'mem-esme', fullName: 'Esme Fernwood' }, { memberId: 'mem-esme', fullName: 'Esme F' }])).toEqual([
      ['refuse', 'entry 1: linkExisting names the row mem-esme twice'],
    ])
    expect(link([{ memberId: 'mem-esme', fullName: 'Esme Fernwood' }, { memberId: 'mem-other', fullName: 'esme fernwood' }])).toEqual([
      ['refuse', 'entry 1: linkExisting names esme fernwood twice'],
    ])
  })

  it('does not refuse two different children who share a surname or a first name', () => {
    const ops = steps(build([family(['Zeb Hollow', 'Zeb Holloway'])])[0]).map(([type]) => type)
    expect(ops.filter((type) => type === 'insert-child')).toHaveLength(2)
  })
})

describe('an email that differs from a row only by letter case or spaces', () => {
  const only = (entry: unknown, rows: Row[] = ROWS) => build([entry], rows)[0]

  it('add: finds the row, changes its membership, and makes no second account or row', () => {
    const group = only({ kind: 'add', fullName: 'Lark Ashdown', email: '  LARK@Example.ORG ', membershipExpiry: '2027-06-18' })
    expect(group.person).toBe('Lark Ashdown <lark@example.org>')
    expect(group.ops.map((op) => op.type)).toEqual(['skip', 'set-membership'])
    expect(group.ops[1]).toMatchObject({ memberId: 'mem-lark' })
    expect(group.ops.some((op) => op.type === 'create-sign-in' || op.type === 'insert-member')).toBe(false)
  })

  it('add: a stored email with capitals and an entry with others is the same person', () => {
    const group = only({ kind: 'add', fullName: 'Ben Thistle', email: 'BEN.THISTLE@EXAMPLE.ORG', membershipExpiry: '2027-06-18' })
    expect(group.ops.map((op) => op.type)).toEqual(['skip', 'set-membership'])
    expect(group.ops[1]).toMatchObject({ memberId: 'mem-ben' })
  })

  it('family: the guardian is found by an email in other capitals, and a named row is matched the same way', () => {
    const byEmail = only({ kind: 'family', fullName: 'Lark Ashdown', email: 'LARK@example.org', membershipExpiry: '2027-06-17', children: [] })
    expect(byEmail.ops.map((op) => op.type)).toEqual(['skip', 'rename', 'set-membership'])
    expect(byEmail.ops[1]).toMatchObject({ memberId: 'mem-lark' })
    const byId = only({ kind: 'family', memberId: 'mem-ben', fullName: 'Ben Thistle', email: 'ben.THISTLE@example.org', membershipExpiry: '2027-06-17', children: [] })
    expect(byId.ops.some((op) => op.type === 'refuse')).toBe(false)
  })

  it('update: an email that differs only by case is already the row\'s, so nothing is changed on the sign-in account', () => {
    const group = only({ kind: 'update', memberId: 'mem-ben', email: 'ben.thistle@example.org' })
    expect(steps(group)).toEqual([['skip', 'email is already ben.thistle@example.org']])
  })

  it('two entries for one email in different capitals are one person', () => {
    const groups = build([
      { kind: 'add', fullName: 'Ada Larkspur', email: 'ada@example.org', membershipExpiry: '2027-06-18' },
      { kind: 'update', memberId: 'mem-lark', email: ' ADA@Example.org ' },
    ])
    expect(steps(groups[1])).toEqual([['refuse', 'entry 2: entry 1 already names ada@example.org']])
  })

  it('the rows are read by the lower-cased, trimmed email', async () => {
    const db = readOnlyDb(ROWS)
    const snapshot = await loadSnapshot(db, plan([{ kind: 'add', fullName: 'Lark Ashdown', email: '  LARK@Example.ORG', membershipExpiry: '2027-06-18' }, { kind: 'add', fullName: 'Ben Thistle', email: 'ben.thistle@example.org', membershipExpiry: '2027-06-18' }]))
    expect(snapshot.members.map((r: Row) => r.id).sort()).toEqual(['admin-1', 'mem-ben', 'mem-lark'])
    expect(db.statements[1].params).toEqual(['lark@example.org', 'ben.thistle@example.org'])
  })
})

describe('a guardian whose own expiry is later than the plan\'s', () => {
  const GIL = row({ id: 'mem-gil', email: 'gil@example.org', full_name: 'Gil Longterm', membership_status: 'active', membership_expiry: '2028-12-31', membership_type: 'family', created_at: '2025-02-01 12:00:00' })
  const KIDS = [
    // Ends after the plan's date: its own date stays.
    row({ id: 'child-gil-a', email: 'gil@example.org', full_name: 'Ana Longterm', guardian_id: 'mem-gil', membership_status: 'active', membership_expiry: '2028-06-01', membership_type: 'family', created_at: '2025-03-01 12:00:00' }),
    // Ends before the plan's date: raised to it.
    row({ id: 'child-gil-b', email: 'gil@example.org', full_name: 'Bea Longterm', guardian_id: 'mem-gil', membership_status: 'active', membership_expiry: '2027-01-01', membership_type: 'family', created_at: '2025-03-02 12:00:00' }),
  ]
  const entry = { kind: 'family', fullName: 'Gil Longterm', email: 'gil@example.org', membershipExpiry: '2027-06-17', children: ['Ana Longterm', 'Bea Longterm', 'Cy Longterm'] }

  it('writes the plan\'s date, not the later one it holds, and says so in a warning', () => {
    const [group] = build([entry], [ADMIN, GIL, ...KIDS])
    const membership = group.ops.find((op) => op.type === 'set-membership')!
    expect(membership.to).toEqual({ status: 'active', expiry: '2027-06-17', type: 'family' })
    expect(membership.text).toBe('membership of Gil Longterm: family, active to Thu, Jun 17, 2027 (was family, active to Sun, Dec 31, 2028)')
    expect(membership.details).toEqual(['warning: this ends the membership earlier than the date it holds now, Sun, Dec 31, 2028'])
  })

  it('covers the children by the plan\'s date, keeping a child\'s own later date', () => {
    const [group] = build([entry], [ADMIN, GIL, ...KIDS])
    expect(steps(group).slice(3)).toEqual([
      ['skip', 'child Ana Longterm is already on this account'],
      ['skip', 'child Bea Longterm is already on this account'],
      ['insert-child', 'child profile Cy Longterm'],
      ['skip', 'Ana Longterm is already covered: family, active to Thu, Jun 1, 2028'],
      ['cover-child', 'family coverage for Bea Longterm: family, active to Thu, Jun 17, 2027 (was family, active to Fri, Jan 1, 2027)'],
      ['cover-child', 'family coverage for Cy Longterm: family, active to Thu, Jun 17, 2027 (was no membership)'],
    ])
  })

  it('a later plan date is no warning', () => {
    const [group] = build([{ ...entry, membershipExpiry: '2029-03-01' }], [ADMIN, GIL, ...KIDS])
    expect(group.ops.find((op) => op.type === 'set-membership')!.details).toBeUndefined()
  })
})

describe('a linked child whose own expiry differs from the guardian\'s', () => {
  const LINKS = [
    row({ id: 'mem-la', email: 'la@example.org', full_name: 'Earlier, Ada', membership_status: 'active', membership_expiry: '2026-12-31', membership_type: 'scholastic', created_at: '2025-01-01 12:00:00' }),
    row({ id: 'mem-lb', email: 'lb@example.org', full_name: 'Later, Bo', membership_status: 'expired', membership_expiry: '2028-05-01', membership_type: 'adult', created_at: '2025-01-02 12:00:00' }),
    row({ id: 'mem-lc', email: 'lc@example.org', full_name: 'Never, Cy', created_at: '2025-01-03 12:00:00' }),
    row({ id: 'mem-ld', email: 'ld@example.org', full_name: 'Same, Di', membership_status: 'active', membership_expiry: '2027-06-17', membership_type: 'scholastic', created_at: '2025-01-04 12:00:00' }),
  ]
  const entry = {
    kind: 'family',
    fullName: 'Gwen Hollow',
    email: 'gwen@example.org',
    membershipExpiry: '2027-06-17',
    children: ['Ada Earlier', 'Bo Later', 'Cy Never', 'Di Same'],
    linkExisting: [
      { memberId: 'mem-la', fullName: 'Ada Earlier' },
      { memberId: 'mem-lb', fullName: 'Bo Later' },
      { memberId: 'mem-lc', fullName: 'Cy Never' },
      { memberId: 'mem-ld', fullName: 'Di Same' },
    ],
  }

  it('keeps a later expiry (even on an expired row), raises an earlier one, and changes only the type when the dates agree', () => {
    const [group] = build([entry], [ADMIN, ...LINKS])
    const covers = group.ops.filter((op) => op.type === 'cover-child')
    expect(covers.map((op) => [op.childId, op.to])).toEqual([
      ['mem-la', { status: 'active', expiry: '2027-06-17', type: 'family' }],
      ['mem-lb', { status: 'active', expiry: '2028-05-01', type: 'family' }],
      ['mem-lc', { status: 'active', expiry: '2027-06-17', type: 'family' }],
    ])
    // Di Same is the fourth by when the row was added: past the first three.
    expect(steps(group).at(-1)).toEqual(['skip', 'Same, Di is not covered: a family membership covers the first 3 children by when they were added, and Same, Di is number 4'])
  })
})

describe('an update on an account that already carries the new email', () => {
  it('the dry run says only the row changes; another account\'s email is a failure', async () => {
    const db = readOnlyDb(ROWS)
    const groups = build([{ kind: 'update', memberId: 'mem-kit', email: 'kit@example.org' }])
    const mine = { id: 'mem-kit', email: 'Kit@Example.org', signedIn: true }
    const same = async (lines: string[], holder: typeof mine | null) =>
      execute(groups, {
        auth: { findUserByEmail: async () => holder, createUser: async (): Promise<never> => Promise.reject(new Error('no write')), updateEmail: async (): Promise<never> => Promise.reject(new Error('no write')) },
        d1: db,
        apply: false,
        log: (line: string) => lines.push(line),
      })
    const ok: string[] = []
    expect((await same(ok, mine)).exitCode).toBe(0)
    expect(ok).toContain('   EMAIL   kit.placeholder@lca.invalid to kit@example.org (mem-kit); the sign-in account already uses it, so only the row changes')

    const clash: string[] = []
    expect((await same(clash, { ...mine, id: 'someone-else' })).exitCode).toBe(1)
    expect(clash.some((line) => line.startsWith('   FAIL') && line.endsWith('another sign-in account (someone-else) already uses kit@example.org'))).toBe(true)
  })
})

describe('the sign-in service adapter, a taken email', () => {
  type User = { id: string; email: string; last_sign_in_at?: string | null }
  function client(listed: User[], taken: Record<string, string | undefined> = {}) {
    const users = [...listed]
    const calls: string[] = []
    let hidden: User[] = []
    return {
      calls,
      // Accounts the service holds but a list taken before they were made does not show.
      appearAfterCreateAttempt(user: User) {
        hidden = [user]
      },
      auth: {
        admin: {
          async listUsers(params: { page: number; perPage: number }) {
            calls.push(`list ${params.page}`)
            return { data: { users: params.page === 1 ? users : [] }, error: null }
          },
          async createUser(attributes: { email: string }) {
            calls.push(`create ${attributes.email}`)
            const message = taken[attributes.email]
            if (message !== undefined) {
              users.push(...hidden)
              hidden = []
              return { data: { user: null }, error: { message, code: message === 'coded' ? 'email_exists' : undefined } }
            }
            const user = { id: `new-${calls.length}`, email: attributes.email }
            return { data: { user }, error: null }
          },
          async updateUserById() {
            return { data: { user: {} }, error: null }
          },
        },
      },
    }
  }

  it('reads the list afresh after a duplicate, so an account made since the first read is found', async () => {
    const fake = client([{ id: 'a0', email: 'first@example.org' }], { 'late@example.org': 'coded' })
    fake.appearAfterCreateAttempt({ id: 'a-late', email: 'Late@Example.org', last_sign_in_at: null })
    const auth = supabaseAuth(fake)
    expect(await auth.findUserByEmail('late@example.org')).toBeNull() // listed once, not there yet
    expect(await auth.createUser({ email: 'late@example.org', fullName: 'Late Comer' })).toEqual({ duplicate: true })
    expect(await auth.findUserByEmail('late@example.org')).toEqual({ id: 'a-late', email: 'Late@Example.org', signedIn: false })
    expect(fake.calls).toEqual(['list 1', 'create late@example.org', 'list 1'])
  })

  it('takes "already registered" from the message when the error carries no code', async () => {
    const fake = client([{ id: 'a1', email: 'one@example.org' }], { 'one@example.org': 'A user with this email address has already been registered' })
    const auth = supabaseAuth(fake)
    expect(await auth.createUser({ email: 'one@example.org', fullName: 'One' })).toEqual({ duplicate: true })
    expect(await auth.findUserByEmail('ONE@example.org')).toMatchObject({ id: 'a1' })
  })

  it('an account it made is found without reading the list again, once the list has been read', async () => {
    const fake = client([])
    const auth = supabaseAuth(fake)
    expect(await auth.findUserByEmail('fresh@example.org')).toBeNull()
    const made = await auth.createUser({ email: 'Fresh@Example.org', fullName: 'Fresh Face' })
    expect(await auth.findUserByEmail('fresh@example.org')).toEqual({ id: (made as { id: string }).id, email: 'Fresh@Example.org', signedIn: false })
    expect(fake.calls).toEqual(['list 1', 'create Fresh@Example.org'])
  })
})

const SECRET = 'tok-0123456789abcdef-secret'
const ACCOUNT_ID = 'acct-fedcba9876543210'
const SERVICE_KEY = 'svc-role-key-value-1234'

/** An error as an HTTP library raises it: a clean message, with the credentials in its other fields. */
class ServiceFailure extends Error {
  token = SECRET
  config = { headers: { Authorization: `Bearer ${SECRET}`, apikey: SERVICE_KEY }, url: `https://api.example.invalid/accounts/${ACCOUNT_ID}` }
  response = { status: 401, data: { echoed: SECRET } }
  declare cause: unknown
  constructor(message: string) {
    super(message)
    this.name = 'ServiceFailure'
    this.cause = new Error(`inner ${SECRET}`)
  }
}

describe('nothing printed holds a credential', () => {
  /** Reads from the rows; every write fails with an error that carries the token. */
  function leakyDb(rows: Row[], failOn: RegExp = /./) {
    const base = readOnlyDb(rows)
    return {
      async query(sql: string, params: unknown[] = []) {
        if (/^\s*SELECT\b/i.test(sql)) return base.query(sql, params)
        if (failOn.test(sql)) throw new ServiceFailure('the database refused the write')
        return { results: [], changes: 1 }
      },
    }
  }
  const leakyAuth = {
    findUserByEmail: async (): Promise<never> => Promise.reject(new ServiceFailure('the sign-in service did not answer')),
    createUser: async (): Promise<never> => Promise.reject(new ServiceFailure('the sign-in service refused the account')),
    updateEmail: async (): Promise<never> => Promise.reject(new ServiceFailure('the sign-in service refused the email')),
  }
  const clean = (lines: string[]) => {
    const text = lines.join('\n')
    for (const secret of [SECRET, ACCOUNT_ID, SERVICE_KEY]) expect(text).not.toContain(secret)
    return text
  }

  it('when the sign-in service throws on a real run, the line has the message only', async () => {
    const lines: string[] = []
    const result = await execute(build(ENTRIES.slice(0, 1)), { auth: leakyAuth, d1: leakyDb(ROWS), apply: true, log: (l: string) => lines.push(l) })
    expect(result.exitCode).toBe(1)
    expect(clean(lines)).toContain('FAIL    sign-in account for ada@example.org: the sign-in service refused the account')
  })

  it('when the sign-in service throws on a dry run', async () => {
    const lines: string[] = []
    await execute(build(ENTRIES.slice(0, 1)), { auth: leakyAuth, d1: leakyDb(ROWS), apply: false, log: (l: string) => lines.push(l) })
    expect(clean(lines)).toContain('the sign-in service did not answer')
  })

  it('when the sign-in service throws while changing an email', async () => {
    const lines: string[] = []
    const auth = { ...leakyAuth, findUserByEmail: async () => null }
    await execute(build([ENTRIES[4]]), { auth, d1: leakyDb(ROWS), apply: true, log: (l: string) => lines.push(l) })
    expect(clean(lines)).toContain('the sign-in service refused the email')
  })

  it('when the database throws on a write', async () => {
    const lines: string[] = []
    const entry = { kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown' }
    const result = await execute(build([entry]), { auth: leakyAuth, d1: leakyDb(ROWS), apply: true, log: (l: string) => lines.push(l) })
    expect(result.exitCode).toBe(1)
    expect(clean(lines)).toContain('the database refused the write')
  })

  it('when only the audit row fails: the change is reported as made and the error shows its message only', async () => {
    const lines: string[] = []
    const entry = { kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown' }
    const result = await execute(build([entry]), { auth: leakyAuth, d1: leakyDb(ROWS, /admin_audit_log/), apply: true, log: (l: string) => lines.push(l) })
    expect(result.exitCode).toBe(1)
    expect(clean(lines)).toContain('the change was made, but its audit log row was not written (the database refused the write)')
  })

  it('when something that is not an Error is thrown, its fields are not printed either', async () => {
    const lines: string[] = []
    const d1 = {
      async query(sql: string, params: unknown[] = []) {
        if (/^\s*SELECT\b/i.test(sql)) return readOnlyDb(ROWS).query(sql, params)
        throw { message: 'a plain object', token: SECRET }
      },
    }
    await execute(build([{ kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown' }]), { auth: leakyAuth, d1, apply: true, log: (l: string) => lines.push(l) })
    clean(lines)
  })

  it('the database adapter scrubs the token and account id out of a message that holds them, every time', async () => {
    const down = async () => {
      const failure = new ServiceFailure(`request to https://api.example.invalid/accounts/${ACCOUNT_ID} failed with Bearer ${SECRET}; retry ${SECRET}`)
      throw failure
    }
    const failure = (await d1Http(down, SECRET, ACCOUNT_ID).query('SELECT 1').catch((err: Error) => err)) as Error
    expect(failure.message).toBe('the database could not be reached: request to https://api.example.invalid/accounts/[account] failed with Bearer [token]; retry [token]')
    expect(failure.message).not.toContain(SECRET)
    expect(failure.message).not.toContain(ACCOUNT_ID)
  })

  it('the command line prints no credential when the database cannot be reached', async () => {
    const work = mkdtempSync(join(tmpdir(), 'apply-memberships-secret-'))
    try {
      const file = join(work, 'plan.json')
      writeFileSync(file, JSON.stringify(plan(ENTRIES.slice(0, 1))))
      const out: string[] = []
      const err: string[] = []
      const fetchFn = async () => {
        throw new ServiceFailure(`socket hang up for ${ACCOUNT_ID} with Bearer ${SECRET}`)
      }
      const code = await main([file, '--apply'], {
        env: { SUPABASE_URL: 'https://sign-in.example.invalid', SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, CLOUDFLARE_API_TOKEN: SECRET, CF_ACCOUNT_ID: ACCOUNT_ID },
        log: (line: string) => out.push(line),
        error: (line: string) => err.push(line),
        fetchFn,
      })
      expect(code).toBe(1)
      expect(err).toEqual(['Stopped before any change: the database could not be reached: socket hang up for [account] with Bearer [token]'])
      clean([...out, ...err])
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('--apply with a variable missing', () => {
  const work = mkdtempSync(join(tmpdir(), 'apply-memberships-env-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  const planFile = join(work, 'plan.json')
  writeFileSync(planFile, JSON.stringify(plan(ENTRIES.slice(0, 1))))
  const FULL = {
    SUPABASE_URL: 'https://sign-in.example.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'service-value-for-the-test',
    CLOUDFLARE_API_TOKEN: 'token-value-for-the-test',
    CF_ACCOUNT_ID: 'account-value-for-the-test',
  }

  async function apply(env: Record<string, string>, argv: string[] = [planFile, '--apply']) {
    const out: string[] = []
    const err: string[] = []
    const requests: Array<{ url: string; sql: string }> = []
    const fetchFn = async (url: string, init: { body: string }) => {
      requests.push({ url, sql: JSON.parse(init.body).sql })
      throw new Error('the network is not available in this test')
    }
    const code = await main(argv, { env, log: (l: string) => out.push(l), error: (l: string) => err.push(l), fetchFn: fetchFn as never })
    return { code, out, err, requests }
  }

  it.each([
    ['SUPABASE_URL', 'SUPABASE_URL'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_TOKEN'],
    ['CF_ACCOUNT_ID', 'CF_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID)'],
  ])('refuses when %s is missing: exit 1, says which, reaches no service, writes nothing', async (name, shown) => {
    const env: Record<string, string> = { ...FULL }
    delete env[name]
    const { code, out, err, requests } = await apply(env)
    expect(code).toBe(1)
    expect(err).toEqual([`Missing environment variable: ${shown}. Set it and run again.`])
    expect(out).toEqual([])
    expect(requests).toEqual([])
    for (const value of Object.values(FULL)) expect([...out, ...err].join('\n')).not.toContain(value)
  })

  it('counts an empty value as missing, and names every missing one', async () => {
    const { code, err, requests } = await apply({ ...FULL, SUPABASE_URL: '', CLOUDFLARE_API_TOKEN: '', CF_ACCOUNT_ID: '' })
    expect(code).toBe(1)
    expect(err).toEqual(['Missing environment variables: SUPABASE_URL, CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID). Set them and run again.'])
    expect(requests).toEqual([])
  })

  it('refuses with nothing set at all, with or without --apply', async () => {
    for (const argv of [[planFile, '--apply'], [planFile]]) {
      const { code, err, requests } = await apply({}, argv)
      expect(code).toBe(1)
      expect(err[0]).toMatch(/^Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID/)
      expect(requests).toEqual([])
    }
  })

  it('accepts CLOUDFLARE_ACCOUNT_ID in place of CF_ACCOUNT_ID, and then the first thing it does is read', async () => {
    const env: Record<string, string> = { ...FULL, CLOUDFLARE_ACCOUNT_ID: 'other-account-value' }
    delete env.CF_ACCOUNT_ID
    const { err, requests } = await apply(env)
    expect(err[0]).toMatch(/^Stopped before any change: /)
    expect(requests.length).toBeGreaterThan(0)
    expect(requests.every((r) => /^\s*SELECT\b/i.test(r.sql) && r.url.includes('/accounts/other-account-value/'))).toBe(true)
  })

  it('as a command: exit 1, the names on stderr, nothing on stdout, with no credentials in the environment', () => {
    const result = spawnSync(process.execPath, ['scripts/apply-memberships.mjs', planFile, '--apply'], { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr.trim()).toBe('Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID). Set them and run again.')
  }, 20_000)
})

// ── Text for people, a family taking over a row, the audit log actions ──

describe('text for people that the script never acts on', () => {
  it('takes "decided" on every kind of entry, and prints it with note and pending', async () => {
    const entries = [
      { kind: 'add', fullName: 'Ada Larkspur', email: 'ada@example.org', membershipExpiry: '2027-06-18', decided: 'the adult rate, as agreed' },
      {
        kind: 'family',
        fullName: 'Ivo Brambleton',
        email: 'ivo@example.org',
        membershipExpiry: '2027-07-26',
        children: ['Juno Brambleton'],
        note: 'paid in cash',
        pending: 'a second child may follow',
        decided: 'Juno only, for now',
      },
      { kind: 'update', memberId: 'mem-lark', membershipExpiry: '2027-06-19', membershipStatus: 'active', decided: 'the later expiry stands' },
    ]
    const groups = build(entries)
    expect(groups.flatMap((g) => g.ops).filter((op) => op.type === 'refuse')).toEqual([])
    expect(groups.map((g) => g.notes)).toEqual([
      ['decided: the adult rate, as agreed'],
      ['note: paid in cash', 'pending: a second child may follow', 'decided: Juno only, for now'],
      ['decided: the later expiry stands'],
    ])
    const lines: string[] = []
    await execute(groups, { auth: noAccounts, d1: readOnlyDb(ROWS), apply: false, log: (line: string) => lines.push(line) })
    const ivo = lines.indexOf('2. FAMILY Ivo Brambleton <ivo@example.org>')
    expect(lines.slice(ivo + 1, ivo + 4)).toEqual(['   note: paid in cash', '   pending: a second child may follow', '   decided: Juno only, for now'])
  })

  it('refuses a "decided" that is not text, as it refuses such a note', () => {
    const [group] = build([{ kind: 'add', fullName: 'Ada Larkspur', email: 'ada@example.org', membershipExpiry: '2027-06-18', decided: { by: 'the board' } }])
    expect(steps(group)).toEqual([['refuse', 'entry 1: decided must be text']])
  })

  it("prints the plan's decidedByK once, under the Source line, and stops on one that is not text", async () => {
    const work = mkdtempSync(join(tmpdir(), 'apply-memberships-decided-'))
    try {
      const file = join(work, 'plan.json')
      writeFileSync(file, JSON.stringify(plan(ENTRIES.slice(0, 1), { decidedByK: 'Tue, Nov 3, 2026: every individual membership is adult.' })))
      const out: string[] = []
      const err: string[] = []
      const fetchFn = async () => {
        throw new Error('the network is not available in this test')
      }
      const env = {
        SUPABASE_URL: 'https://sign-in.example.invalid',
        SUPABASE_SERVICE_ROLE_KEY: 'service-value-for-the-test',
        CLOUDFLARE_API_TOKEN: 'token-value-for-the-test',
        CF_ACCOUNT_ID: 'account-value-for-the-test',
      }
      await main([file], { env, log: (line: string) => out.push(line), error: (line: string) => err.push(line), fetchFn })
      expect(out.slice(1, 3)).toEqual([`Source: ${SOURCE}`, 'Decided by K: Tue, Nov 3, 2026: every individual membership is adult.'])
      expect(out.filter((line) => line.startsWith('Decided by K:'))).toHaveLength(1)
      expect(err).toEqual(['Stopped before any change: the database could not be reached: the network is not available in this test'])
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
    expect(() => checkPlan(plan(ENTRIES, { decidedByK: ['every individual membership is adult'] }))).toThrow('"decidedByK" must be text.')
    expect(() => checkPlan(plan(ENTRIES, { decidedByK: 'every individual membership is adult' }))).not.toThrow()
  })
})

describe('a family that takes over a row under another name', () => {
  // The row a parent's email holds, made when their child was signed up
  // under it: the child's name, US Chess ID and scholastic membership.
  const LUCA = row({ id: 'mem-luca', email: 'rowan@example.org', full_name: 'Marsh, Luca', uscf_id: '30001234', membership_status: 'active', membership_expiry: '2027-02-28', membership_type: 'scholastic' })
  const family = (extra: Record<string, unknown> = {}) => ({
    kind: 'family',
    memberId: 'mem-luca',
    fullName: 'Rowan Marsh',
    email: 'rowan@example.org',
    membershipExpiry: '2027-06-17',
    children: ['Luca Marsh'],
    ...extra,
  })
  const HINT = 'add "renameKeepsEntries": true to the entry only if this row is Rowan Marsh\'s own under another spelling, and otherwise settle it by hand'
  const REFUSAL = `the row mem-luca ("Marsh, Luca") holds US Chess ID 30001234, which would go under the name "Rowan Marsh"; ${HINT}`

  it('refuses a row that holds a US Chess ID, and plans nothing else for that person', () => {
    expect(steps(build([family()], [ADMIN, LUCA])[0])).toEqual([['refuse', REFUSAL]])
  })

  it('refuses a row that holds tournament entries, whether named by id or found by its email', () => {
    const noId = { ...LUCA, uscf_id: null }
    const byEmail = { kind: 'family', fullName: 'Rowan Marsh', email: 'rowan@example.org', membershipExpiry: '2027-06-17', children: ['Luca Marsh'] }
    for (const entry of [family(), byEmail]) {
      expect(steps(build([entry], [ADMIN, noId], TODAY, { 'mem-luca': 2 })[0])).toEqual([
        ['refuse', `the row mem-luca ("Marsh, Luca") holds 2 tournament entries, which would go under the name "Rowan Marsh"; ${HINT}`],
      ])
    }
  })

  it('with "renameKeepsEntries": true, renames the row and says what stays on it, and the family follows', () => {
    const [group] = build([family({ renameKeepsEntries: true })], [ADMIN, LUCA], TODAY, { 'mem-luca': 2 })
    expect(steps(group)).toEqual([
      ['skip', 'rowan@example.org has a sign-in account already (the member row mem-luca), so none is made'],
      ['rename', '"Marsh, Luca" to "Rowan Marsh" (mem-luca); US Chess ID 30001234 and 2 tournament entries stay on the row (renameKeepsEntries)'],
      ['set-membership', 'membership of Rowan Marsh: family, active to Thu, Jun 17, 2027 (was scholastic, active to Sun, Feb 28, 2027)'],
      ['insert-child', 'child profile Luca Marsh'],
      ['cover-child', 'family coverage for Luca Marsh: family, active to Thu, Jun 17, 2027 (was no membership)'],
    ])
    expect(group.ops[1]).toMatchObject({ memberId: 'mem-luca', guard: true, keeps: true })
  })

  it('renames a row that holds nothing, and says so; renameKeepsEntries false is the same as leaving it out', () => {
    const empty = { ...LUCA, uscf_id: null }
    for (const entry of [family(), family({ renameKeepsEntries: false })]) {
      const [group] = build([entry], [ADMIN, empty])
      expect(steps(group)[1]).toEqual(['rename', '"Marsh, Luca" to "Rowan Marsh" (mem-luca); the row holds no US Chess ID and no tournament entries'])
      expect(group.ops[1]).toMatchObject({ guard: true, keeps: false })
    }
    expect(steps(build([family({ renameKeepsEntries: false })], [ADMIN, LUCA])[0])).toEqual([['refuse', REFUSAL]])
  })

  it("asks nothing of a row already under the guardian's name, whatever it holds", () => {
    const [group] = build([family()], [ADMIN, { ...LUCA, full_name: 'Rowan Marsh' }], TODAY, { 'mem-luca': 3 })
    expect(steps(group)[1]).toEqual(['skip', 'name is already "Rowan Marsh"'])
    expect(group.ops.some((op) => op.type === 'refuse')).toBe(false)
  })

  it('takes renameKeepsEntries only as true or false, and only on family entries', () => {
    expect(steps(build([family({ renameKeepsEntries: 'yes' })], [ADMIN, LUCA])[0])).toEqual([['refuse', 'entry 1: renameKeepsEntries must be true or false']])
    expect(steps(build([{ kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown', renameKeepsEntries: true }])[0])).toEqual([
      ['refuse', 'entry 1: "renameKeepsEntries" is not a field of update entries'],
    ])
  })

  it('an update renames its own row without asking, and the line says what stays on it', () => {
    const update = { kind: 'update', memberId: 'mem-luca', fullName: 'Luca Marsh' }
    const [group] = build([update], [ADMIN, LUCA], TODAY, { 'mem-luca': 1 })
    expect(steps(group)).toEqual([['rename', '"Marsh, Luca" to "Luca Marsh" (mem-luca); US Chess ID 30001234 and 1 tournament entry stay on the row']])
    expect(group.ops[0]).toMatchObject({ guard: false, keeps: false })
    const [entryOnly] = build([update], [ADMIN, { ...LUCA, uscf_id: null }], TODAY, { 'mem-luca': 1 })
    expect(entryOnly.ops[0].text).toBe('"Marsh, Luca" to "Luca Marsh" (mem-luca); 1 tournament entry stays on the row')
  })

  it('the dry run prints the refusal, and a RENAME line with what stays on the row', async () => {
    const OLA = row({ id: 'mem-ola', email: 'ola@example.org', full_name: 'Marsh, Ola', uscf_id: '30005678' })
    const spellingFix = { kind: 'family', memberId: 'mem-ola', fullName: 'Ola Marsh', email: 'ola@example.org', membershipExpiry: '2027-06-17', children: [], renameKeepsEntries: true }
    const groups = build([family(), spellingFix], [ADMIN, LUCA, OLA], TODAY, { 'mem-ola': 1 })
    const lines: string[] = []
    const result = await execute(groups, { auth: noAccounts, d1: readOnlyDb([ADMIN, LUCA, OLA], { 'mem-ola': 1 }), apply: false, log: (line: string) => lines.push(line) })
    expect(lines).toContain(`   REFUSE  ${REFUSAL}`)
    expect(lines).toContain('   RENAME  "Marsh, Ola" to "Ola Marsh" (mem-ola); US Chess ID 30005678 and 1 tournament entry stay on the row (renameKeepsEntries)')
    expect(result.failedPeople).toEqual(['Rowan Marsh <rowan@example.org>'])
  })

  it('the real run reads the row again: one that now holds an entry stops that person, with nothing written', async () => {
    const empty = { ...LUCA, uscf_id: null }
    const groups = build([family()], [ADMIN, empty])
    expect(groups[0].ops[1]).toMatchObject({ type: 'rename', guard: true, keeps: false })
    // An entry arrives between the read and the run.
    const db = readOnlyDb([ADMIN, empty], { 'mem-luca': 1 })
    const lines: string[] = []
    const result = await execute(groups, { auth: noAccounts, d1: db, apply: true, log: (line: string) => lines.push(line) })
    expect(result.exitCode).toBe(1)
    expect(lines.filter((line) => line.startsWith('   FAIL'))).toEqual([
      '   FAIL    "Marsh, Luca" to "Rowan Marsh" (mem-luca); the row holds no US Chess ID and no tournament entries: nothing was written: ' +
        `the row mem-luca ("Marsh, Luca") now holds 1 tournament entry, which would go under the name "Rowan Marsh"; ${HINT}`,
    ])
    expect(db.statements.every(({ sql }) => /^\s*SELECT\b/.test(sql))).toBe(true)
  })
})

describe('the audit log actions', () => {
  it('writes only actions that the AdminAction union in functions/utils/admin/audit.ts names', () => {
    const audit = readFileSync(join(ROOT, 'functions/utils/admin/audit.ts'), 'utf8')
    const union = /export type AdminAction =([\s\S]*?)\n\n/.exec(audit)?.[1] ?? ''
    const named = new Set([...union.matchAll(/\|\s*'([a-z_]+)'/g)].map((m) => m[1]))
    expect(named.has('membership_override')).toBe(true)

    const script = readFileSync(join(ROOT, 'scripts/apply-memberships.mjs'), 'utf8')
    const calls = script.match(/\bwriteAudit\(/g) ?? []
    const written = [...script.matchAll(/\bwriteAudit\(\s*d1,\s*audit,\s*'([a-z_]+)'/g)].map((m) => m[1])
    // Every call names its action in quotes; the one other match is the function itself.
    expect(written).toHaveLength(calls.length - 1)
    expect([...new Set(written)].sort()).toEqual(['email_change', 'guardian_link', 'membership_override', 'name_change'])
    for (const action of written) expect(named.has(action), `${action} is not in the AdminAction union`).toBe(true)
    // The list a kept row's action is checked against is the same four.
    expect([...AUDIT_ACTIONS].sort()).toEqual([...new Set(written)].sort())
  })
})

// ── The people to tell when an entry stops part way, and an audit row that fails ──

describe('the people to tell when an entry does not finish', () => {
  it('the dry run names a sign-in account it would make for an entry it would not finish on the same line, with what was refused', async () => {
    const entries = [
      { kind: 'add', fullName: 'Ada Larkspur', email: 'ada@example.org', membershipExpiry: '2027-06-18' },
      // A new guardian whose link is refused: the account and the row are still made.
      {
        kind: 'family',
        fullName: 'Yara Hollow',
        email: 'yara@example.org',
        membershipExpiry: '2027-06-17',
        children: ['Finn Fernwood', 'Zeb Hollow'],
        linkExisting: [{ memberId: 'mem-finn', fullName: 'Finn Fernwood' }],
      },
    ]
    const groups = build(entries)
    expect(steps(groups[1]).map(([type]) => type)).toEqual(['create-sign-in', 'insert-member', 'refuse', 'insert-child', 'cover-child'])
    const lines: string[] = []
    const result = await execute(groups, { auth: noAccounts, d1: readOnlyDb(ROWS), apply: false, log: (line: string) => lines.push(line) })
    expect(result.exitCode).toBe(1)
    const yara =
      'Yara Hollow <yara@example.org> (refused: child Finn Fernwood: the row mem-finn (Fernwood, Finn) is already a child of another account (mem-other), so it is left alone)'
    expect(result.newSignIns).toEqual(['Ada Larkspur <ada@example.org>', yara])
    expect(lines.at(-1)).toBe(`Sign-in accounts the real run would make: Ada Larkspur <ada@example.org>; ${yara}.`)
  })

  it('the dry run names an unused account that already carries the new email, as the real run does', async () => {
    const auth = {
      findUserByEmail: async (email: string) => (email === 'kit@example.org' ? { id: 'mem-kit', email, signedIn: false } : null),
      createUser: async (): Promise<never> => Promise.reject(new Error('a write in a dry run')),
      updateEmail: async (): Promise<never> => Promise.reject(new Error('a write in a dry run')),
    }
    const lines: string[] = []
    const result = await execute(build([{ kind: 'update', memberId: 'mem-kit', email: 'kit@example.org' }]), { auth, d1: readOnlyDb(ROWS), apply: false, log: (line: string) => lines.push(line) })
    expect(result.exitCode).toBe(0)
    expect(lines).toContain('   EMAIL   kit.placeholder@lca.invalid to kit@example.org (mem-kit); the sign-in account already uses it, so only the row changes')
    expect(lines.at(-1)).toBe('Sign-in accounts the real run would make: Quillfeather, Kit <kit@example.org> (unused sign-in account, new email).')
  })

  it('a real run that moves an unused account to a real email and then cannot change the row names the person, and says the account has it', async () => {
    const auth = {
      findUserByEmail: async (email: string) => (email === 'kit.placeholder@lca.invalid' ? { id: 'mem-kit', email, signedIn: false } : null),
      createUser: async (): Promise<never> => Promise.reject(new Error('no account is made here')),
      updateEmail: async () => undefined,
    }
    const base = readOnlyDb(ROWS)
    const d1 = {
      async query(sql: string, params: unknown[] = []) {
        if (/^\s*SELECT\b/i.test(sql)) return base.query(sql, params)
        return { results: [], changes: 0 } // the row changed after it was read
      },
    }
    const lines: string[] = []
    const result = await execute(build([ENTRIES[4]]), { auth, d1, apply: true, log: (line: string) => lines.push(line) })
    expect(result.exitCode).toBe(1)
    expect(lines).toContain(
      '   FAIL    kit.placeholder@lca.invalid to kit@example.org (mem-kit), on the sign-in account first and then on the row: ' +
        'the sign-in account now has kit@example.org, but the row was not changed, because it changed after it was read; run the script again',
    )
    const kit =
      'Quillfeather, Kit <kit@example.org> (unused sign-in account, new email; the rest failed: ' +
      'the sign-in account now has kit@example.org, but the row was not changed, because it changed after it was read; run the script again)'
    expect(result.newSignIns).toEqual([kit])
    expect(lines).not.toContain('No new sign-in accounts.')
    expect(lines.slice(-2)).toEqual([
      `New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): ${kit}.`,
      'Keep this list: the run that finishes an entry marked "the rest failed" or "refused" may say only that the person has a sign-in account already, without naming them here again.',
    ])
  })
})

describe('an audit log row that cannot be written at first', () => {
  /** Reads from the rows; audit inserts fail `failures` times, then are kept, and the read by id finds what was kept. */
  function auditDb(failures: number) {
    const base = readOnlyDb(ROWS)
    const statements: Array<{ sql: string; params: unknown[] }> = []
    const kept = new Set<string>()
    let left = failures
    return {
      statements,
      async query(sql: string, params: unknown[] = []) {
        statements.push({ sql, params })
        if (/FROM admin_audit_log WHERE id = \?/.test(sql)) return { results: kept.has(String(params[0])) ? [{ id: params[0] }] : [], changes: null }
        if (/^\s*SELECT\b/i.test(sql)) return base.query(sql, params)
        if (/INTO admin_audit_log/.test(sql)) {
          if (left-- > 0) throw new Error('the audit table did not answer')
          kept.add(String(params[0]))
        }
        return { results: [], changes: 1 }
      },
    }
  }
  const auditStatements = (db: ReturnType<typeof auditDb>) => db.statements.filter(({ sql }) => /admin_audit_log/.test(sql))

  it('tries once more under the same id, ignoring a row already there, then finds it by that id', async () => {
    const db = auditDb(1)
    const lines: string[] = []
    const result = await execute(build([{ kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown' }]), { auth: noAccounts, d1: db, apply: true, log: (line: string) => lines.push(line) })
    expect(result.exitCode).toBe(0)
    expect(result.missingAudit).toEqual([])
    const audit = auditStatements(db)
    expect(audit.map(({ sql }) => sql.split(' (')[0])).toEqual([
      'INSERT INTO admin_audit_log',
      'INSERT OR IGNORE INTO admin_audit_log',
      'SELECT id FROM admin_audit_log WHERE id = ? AND action = ? AND target_member_id = ?',
    ])
    expect(audit[1].params).toEqual(audit[0].params)
    expect(audit[2].params).toEqual([audit[0].params[0], 'name_change', 'mem-lark'])
    expect(lines.some((line) => line.startsWith('   FAIL'))).toBe(false)
  })

  it('a row still missing: the FAIL line says the next run writes it, the result carries the row to keep, and the statement under it holds the row, quoted', async () => {
    const db = auditDb(2)
    const groups = buildPlan(plan([{ kind: 'update', memberId: 'mem-lark', fullName: "Lark O'Shea" }], { source: "The club's table payments" }), { members: ROWS, registrationCounts: {} }, TODAY) as Group[]
    const lines: string[] = []
    const result = await execute(groups, { auth: noAccounts, d1: db, apply: true, log: (line: string) => lines.push(line) })
    expect(result.exitCode).toBe(1)
    const fail = lines.findIndex((line) => line.startsWith('   FAIL'))
    expect(lines[fail]).toBe(
      `   FAIL    "Ashdown, Lark" to "Lark O'Shea" (mem-lark); the row holds no US Chess ID and no tournament entries: ` +
        'the change was made, but its audit log row was not written (the audit table did not answer); ' +
        'the next run with --apply writes it, or insert it by hand with the statement below',
    )
    const [statement] = result.missingAudit
    expect(lines[fail + 1]).toBe(`           ${statement}`)
    // The same id both tries used, and the time the change was made.
    const id = String(auditStatements(db)[0].params[0])
    const madeAt = /'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'\);$/.exec(statement)?.[1]
    expect(madeAt).toBeDefined()
    expect(Math.abs(Date.parse(`${madeAt!.replace(' ', 'T')}Z`) - Date.now())).toBeLessThan(60_000)
    expect(statement).toBe(
      'INSERT OR IGNORE INTO admin_audit_log (id, actor_id, actor_email, action, target_member_id, target_label, detail, created_at) VALUES (' +
        `'${id}', 'admin-1', 'Admin@Example.org', 'name_change', 'mem-lark', 'Lark O''Shea <lark@example.org>', ` +
        `'{"from":"Ashdown, Lark","to":"Lark O''Shea","reason":"The club''s table payments"}', '${madeAt}');`,
    )
    // The same row, as data, for the command line to keep beside the plan.
    expect(result.missingAuditRows).toEqual([
      {
        id,
        actorId: 'admin-1',
        actorEmail: 'Admin@Example.org',
        action: 'name_change',
        targetId: 'mem-lark',
        targetLabel: "Lark O'Shea <lark@example.org>",
        detail: JSON.stringify({ from: 'Ashdown, Lark', to: "Lark O'Shea", reason: "The club's table payments" }),
        madeAt,
      },
    ])
    expect(lines).toContain(
      'Audit log rows not written: 1. Their changes are in place; the next run with --apply writes these rows, ' +
        'or insert each one by hand with the statement printed under its FAIL line. Running a statement twice adds nothing.',
    )
    expect(lines).toContain(`Failed or refused: Lark O'Shea <lark@example.org>. Fix the cause and run the script again; whatever already holds is skipped.`)
  })

  it('a read by id that fails too is reported as missing, with the same statement', async () => {
    const base = auditDb(2)
    const d1 = {
      async query(sql: string, params: unknown[] = []) {
        if (/FROM admin_audit_log/.test(sql)) throw new Error('the database did not answer')
        return base.query(sql, params)
      },
    }
    const lines: string[] = []
    const result = await execute(build([{ kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown' }]), { auth: noAccounts, d1, apply: true, log: (line: string) => lines.push(line) })
    expect(result.exitCode).toBe(1)
    expect(result.missingAudit).toHaveLength(1)
    expect(result.missingAudit[0]).toMatch(/^INSERT OR IGNORE INTO admin_audit_log \(/)
  })
})

// ── An update's expiry without a status, a guardian that has become a ──
// ── child, and two entries that reach one row ────────────────────────────

describe('an update that names an expiry and no status', () => {
  const only = (entry: unknown, rows: Row[] = ROWS) => build([entry], rows)[0]

  it('sets the status from the date, as the admin membership endpoint does: active from today on, expired before', () => {
    // Lark's row is expired; a later date makes it active, and so does today.
    const later = only({ kind: 'update', memberId: 'mem-lark', membershipExpiry: '2027-06-19' })
    expect(steps(later)).toEqual([['set-membership', 'membership of Ashdown, Lark: adult, active to Sat, Jun 19, 2027 (was adult, expired Tue, Mar 31, 2026)']])
    expect(later.ops[0].to).toEqual({ status: 'active', expiry: '2027-06-19' })
    expect(only({ kind: 'update', memberId: 'mem-lark', membershipExpiry: TODAY }).ops[0].to).toEqual({ status: 'active', expiry: TODAY })
    // Kit's row is active; a date before today makes it expired, and is not refused.
    const earlier = only({ kind: 'update', memberId: 'mem-kit', membershipExpiry: '2026-11-02' })
    expect(steps(earlier)).toEqual([['set-membership', 'membership of Quillfeather, Kit: adult, expired Mon, Nov 2, 2026 (was adult, active to Thu, Dec 31, 2099)']])
    expect(earlier.ops[0].to).toEqual({ status: 'expired', expiry: '2026-11-02' })
  })

  it('a status given with the date still wins, so "none" can be set by hand', () => {
    expect(only({ kind: 'update', memberId: 'mem-lark', membershipExpiry: '2027-06-19', membershipStatus: 'none' }).ops[0].to).toEqual({ status: 'none', expiry: '2027-06-19' })
  })

  it('is a skip when the row already holds what the date works out to', () => {
    const rows = ROWS.map((r) => (r.id === 'mem-lark' ? { ...r, membership_status: 'active', membership_expiry: '2027-06-19' } : r))
    expect(steps(only({ kind: 'update', memberId: 'mem-lark', membershipExpiry: '2027-06-19' }, rows))).toEqual([
      ['skip', 'membership of Ashdown, Lark is already adult, active to Sat, Jun 19, 2027'],
    ])
  })
})

describe('a guardian that is a child, or a walk-in guest, by the time of the run', () => {
  // Gia's row already holds what the entry asks, so the first write is the child's.
  const GIA = row({ id: 'mem-gia', email: 'gia@example.org', full_name: 'Gia Fernwood', membership_status: 'active', membership_expiry: '2027-06-17', membership_type: 'family' })
  const ESME = ROWS.find((r) => r.id === 'mem-esme')!
  const family = (children: string[], linkExisting?: Array<{ memberId: string; fullName: string }>) => ({
    kind: 'family',
    memberId: 'mem-gia',
    fullName: 'Gia Fernwood',
    email: 'gia@example.org',
    membershipExpiry: '2027-06-17',
    children,
    ...(linkExisting ? { linkExisting } : {}),
  })

  it.each([
    ['a child of another account', { guardian_id: 'mem-other' }, "the guardian's row mem-gia is a child of another account (mem-other), and a child cannot have children"],
    ['a walk-in guest row', { role: 'guest' }, "the guardian's row mem-gia is a walk-in guest row, which has no account to hold children"],
  ])('refuses a new child profile and a link once the guardian is %s, as /api/me/children does, and writes nothing', async (_what, change, why) => {
    const cases = [
      { entry: family(['Hal Fernwood']), line: 'child profile Hal Fernwood' },
      { entry: family(['Esme Fernwood'], [{ memberId: 'mem-esme', fullName: 'Esme Fernwood' }]), line: 'Fernwood, Esme (mem-esme) as a child of this account' },
    ]
    for (const { entry, line } of cases) {
      // Planned from rows in which Gia could hold children.
      const groups = build([entry], [ADMIN, GIA, ESME])
      expect(groups[0].ops.some((op) => op.type === 'refuse')).toBe(false)
      expect(groups[0].ops.map((op) => op.type)).toContain(entry.linkExisting ? 'link-child' : 'insert-child')
      const db = readOnlyDb([ADMIN, { ...GIA, ...change }, ESME])
      const lines: string[] = []
      const result = await execute(groups, { auth: noAccounts, d1: db, apply: true, log: (l: string) => lines.push(l) })
      expect(result.exitCode).toBe(1)
      expect(lines.filter((l) => l.startsWith('   FAIL'))).toEqual([`   FAIL    ${line}: nothing was written: ${why}`])
      expect(db.statements.every(({ sql }) => /^\s*SELECT\b/.test(sql))).toBe(true)
    }
  })
})

describe('two entries that reach one row', () => {
  const linking = (fullName: string, email: string) => ({
    kind: 'family',
    fullName,
    email,
    membershipExpiry: '2027-06-17',
    children: ['Esme Fernwood'],
    linkExisting: [{ memberId: 'mem-esme', fullName: 'Esme Fernwood' }],
  })

  it('refuses a second family that links a row the first links, and an entry that names a linked row by id', () => {
    const groups = build([linking('Yara Hollow', 'yara@example.org'), linking('Zed Hollow', 'zed@example.org'), { kind: 'update', memberId: 'mem-esme', fullName: 'Esme Fernwood' }])
    expect(groups[0].ops.map((op) => op.type)).toContain('link-child')
    expect(steps(groups[1])).toEqual([['refuse', 'entry 2: entry 1 already names the row mem-esme']])
    expect(steps(groups[2])).toEqual([['refuse', 'entry 3: entry 1 already names the row mem-esme']])
  })

  it('refuses an entry whose email finds a row another entry names by id, either way round', () => {
    const groups = build([
      { kind: 'update', memberId: 'mem-ben', fullName: 'Ben Thistle' },
      { kind: 'add', fullName: 'Ben Thistle', email: 'BEN.THISTLE@example.org', membershipExpiry: '2027-06-18' },
      { kind: 'add', fullName: 'Lark Ashdown', email: 'lark@example.org', membershipExpiry: '2027-06-18' },
      { kind: 'family', memberId: 'mem-lark', fullName: 'Lark Ashdown', email: 'lark@example.org', membershipExpiry: '2027-06-17', children: [] },
    ])
    expect(steps(groups[1])).toEqual([['refuse', 'entry 2: entry 1 already names the row mem-ben']])
    expect(steps(groups[3])).toEqual([['refuse', 'entry 4: entry 3 already names lark@example.org']])
  })

  it('an entry refused as a second one holds nothing back from the entries after it', () => {
    const groups = build([
      { kind: 'update', memberId: 'mem-ben', fullName: 'Ben Thistle' },
      // Refused for Ben's row; it also reaches pia@example.org and Pia's row.
      { kind: 'update', memberId: 'mem-ben', email: 'pia@example.org' },
      { kind: 'update', memberId: 'mem-pia', fullName: 'Pia Sundown-Reyes' },
    ])
    expect(steps(groups[1])).toEqual([['refuse', 'entry 2: entry 1 already names the row mem-ben']])
    expect(steps(groups[2])).toEqual([['rename', '"Pia Sundown" to "Pia Sundown-Reyes" (mem-pia); the row holds no US Chess ID and no tournament entries']])
  })

  it("refuses a second family that names a child row already on the first family's account, and so does each later run", () => {
    const cleo = { kind: 'family', memberId: 'mem-cleo', fullName: 'Cleo Fernwood', email: 'cleo@example.org', membershipExpiry: '2027-06-17', children: ['Dov Fernwood'] }
    const yara = { kind: 'family', fullName: 'Yara Hollow', email: 'yara@example.org', membershipExpiry: '2027-06-17', children: ['Dov Fernwood'], linkExisting: [{ memberId: 'child-dov', fullName: 'Dov Fernwood' }] }
    const held = 'entry 1 already holds the row child-dov (Dov Fernwood), a child on the account mem-cleo'
    const groups = build([cleo, yara, { kind: 'update', memberId: 'child-dov', membershipExpiry: '2027-01-31' }])
    // The first family covers Dov whether or not it names him.
    expect(groups[0].ops.map((op) => op.type)).toContain('cover-child')
    expect(steps(groups[1])).toEqual([['refuse', `entry 2: ${held}`]])
    expect(steps(groups[2])).toEqual([['refuse', `entry 3: ${held}`]])
    // A guardian found by email holds its children the same way.
    const byEmail = build([{ ...cleo, memberId: undefined, children: [] }, yara])
    expect(steps(byEmail[1])).toEqual([['refuse', `entry 2: ${held}`]])
    // The other way round: the first links a row that the second already holds as its own child.
    const otto = { kind: 'family', fullName: 'Otto Otherway', email: 'other@example.org', membershipExpiry: '2027-06-17', children: ['Fernwood, Finn'] }
    const linker = { ...yara, children: ['Finn Fernwood'], linkExisting: [{ memberId: 'mem-finn', fullName: 'Finn Fernwood' }] }
    expect(steps(build([linker, otto])[1])).toEqual([['refuse', "entry 2: entry 1 already names the row mem-finn, which is a child on this entry's account mem-other"]])
    // Planned again after the first family's changes are made, the second is refused for the same reason.
    const after = applyInMemory(ROWS, [groups[0]])
    const again = build([cleo, yara], after)
    expect(again[0].ops.every((op) => op.type === 'skip')).toBe(true)
    expect(steps(again[1])).toEqual([['refuse', `entry 2: ${held}`]])
    // A family's children reach nothing of another family's.
    expect(build([cleo, { ...yara, children: ['Ida Hollow'], linkExisting: undefined }])[1].ops.some((op) => op.type === 'refuse')).toBe(false)
  })
})

// ── The Node the script runs on ──────────────────────────────────────

describe('the Node the script runs on', () => {
  const TOO_OLD = (version: string) =>
    `This script needs Node 22.18 or later (23.6 or later on Node 23), which loads the TypeScript file it imports from domain/, and this is Node ${version}.`

  it('is one that loads a .ts file as it is: 22.18 or later, and 23.6 or later on Node 23', () => {
    for (const version of ['22.18.0', '22.22.0', '23.6.0', '24.0.0', '25.1.0', 'v22.18.1']) expect(nodeVersionProblem(version), version).toBeNull()
    for (const version of ['22.17.1', '22.6.0', '23.5.0', '21.7.3', '20.20.0', '18.20.4']) expect(nodeVersionProblem(version), version).toBe(TOO_OLD(version))
    expect(nodeVersionProblem(undefined)).toBe(TOO_OLD('of no known version'))
  })

  it('the command line says so in one sentence before anything else, and exits 1', async () => {
    const out: string[] = []
    const err: string[] = []
    const fetchFn = async () => {
      throw new Error('the command line reached the network in a test')
    }
    const code = await main(['plan.json', '--force'], { env: {}, log: (l: string) => out.push(l), error: (l: string) => err.push(l), fetchFn, nodeVersion: '20.20.0' })
    expect(code).toBe(1)
    expect(err).toEqual([TOO_OLD('20.20.0')])
    expect(out).toEqual([])
  })
})

// ── A real database: node:sqlite with the migrations applied ─────────

type Statement = { sql: string; params: unknown[] }
const isRead = (sql: string) => /^\s*SELECT\b/i.test(sql)
const ADMIN_COLUMNS = { id: 'admin-1', email: 'Admin@Example.org', full_name: 'Avery Admin', role: 'lca_admin', membership_status: 'active', membership_expiry: '2027-12-31', membership_type: 'adult' }
const LARK_COLUMNS = { id: 'mem-lark', email: 'lark@example.org', full_name: 'Ashdown, Lark', membership_status: 'expired', membership_expiry: '2026-03-31', membership_type: 'adult' }

/** A migrated database holding the admin and then the member rows given, in that order. */
function seededDb(...rows: Array<Record<string, string | null>>): DatabaseSync {
  const db = openMigratedDb()
  for (const columns of [ADMIN_COLUMNS, ...rows]) {
    const names = Object.keys(columns)
    db.prepare(`INSERT INTO members (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`).run(...names.map((name) => columns[name]))
  }
  return db
}

/** The script's database adapter straight over SQLite, as the harness's is over D1. */
function sqliteD1(db: DatabaseSync) {
  const statements: Statement[] = []
  return {
    statements,
    async query(sql: string, params: unknown[] = []) {
      statements.push({ sql, params })
      const stmt = db.prepare(sql)
      const args = params as Array<string | number | null>
      if (isRead(sql)) return { results: stmt.all(...args) as Record<string, unknown>[], changes: null }
      return { results: [], changes: Number(stmt.run(...args).changes) }
    },
  }
}

/**
 * The database's HTTP API over SQLite, for d1Http: one statement a request,
 * answered as the API answers. With meta: false the answers carry no
 * meta.changes. `before` runs ahead of each statement and may throw to fail it.
 */
function sqliteApi(db: DatabaseSync, { meta = true, before }: { meta?: boolean; before?: (sql: string, params: unknown[]) => void } = {}) {
  const statements: Statement[] = []
  const fetchFn = async (_url: string, init: { body: string }) => {
    const { sql, params } = JSON.parse(init.body) as Statement
    statements.push({ sql, params })
    before?.(sql, params)
    const stmt = db.prepare(sql)
    const args = params as Array<string | number | null>
    let answer: Record<string, unknown>
    if (isRead(sql)) {
      answer = { success: true, results: stmt.all(...args) }
    } else {
      const { changes } = stmt.run(...args)
      answer = { success: true, results: [], ...(meta ? { meta: { changes: Number(changes) } } : {}) }
    }
    return new Response(JSON.stringify({ success: true, result: [answer] }), { status: 200 })
  }
  return { statements, fetchFn }
}

/** The sign-in service in memory. */
function memoryAuth() {
  const accounts = new Map<string, { id: string; email: string; signedIn: boolean }>()
  let made = 0
  return {
    accounts,
    async findUserByEmail(email: string) {
      return accounts.get(email.toLowerCase()) ?? null
    },
    async createUser({ email }: { email: string; fullName: string }) {
      if (accounts.has(email.toLowerCase())) return { duplicate: true as const }
      const id = `auth-made-${++made}`
      accounts.set(email.toLowerCase(), { id, email, signedIn: false })
      return { id }
    },
    async updateEmail(): Promise<never> {
      throw new Error('no email changes in these tests')
    },
  }
}

const one = <T>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) => ({ ...(db.prepare(sql).get(...args) as T) })

describe('a database whose answers leave out meta.changes', () => {
  // The expiry alone: the status is worked out from it.
  const LARK_PLAN = plan([{ kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown', membershipExpiry: '2027-06-19' }])
  const RENAMED = '"Ashdown, Lark" to "Lark Ashdown" (mem-lark); the row holds no US Chess ID and no tournament entries'

  async function apply(db: DatabaseSync, options: { meta?: boolean; before?: (sql: string) => void } = {}) {
    const api = sqliteApi(db, options)
    const d1 = d1Http(api.fetchFn, 'token-value-for-the-test', 'account-value-for-the-test')
    const lines: string[] = []
    const result = await execute(buildPlan(LARK_PLAN, await loadSnapshot(d1, LARK_PLAN), TODAY), { auth: noAccounts, d1, apply: true, log: (l: string) => lines.push(l) })
    /** The statement sent just after the first one that starts with `start`. */
    const after = (start: string) => api.statements[api.statements.findIndex(({ sql }) => sql.startsWith(start)) + 1]?.sql ?? ''
    return { lines, result, after }
  }

  it('reads each guarded write back to learn whether it changed the row, and goes on when it did', async () => {
    const db = seededDb(LARK_COLUMNS)
    const { lines, result, after } = await apply(db, { meta: false })
    expect(result.exitCode).toBe(0)
    expect(lines).toContain(`   RENAME  ${RENAMED}`)
    expect(lines).toContain('   UPDATE  membership of Lark Ashdown: adult, active to Sat, Jun 19, 2027 (was adult, expired Tue, Mar 31, 2026)')
    // With no count of changes, the rename is followed by a read of its row.
    expect(after('UPDATE members SET full_name')).toMatch(/^SELECT rowid AS row_order, .* FROM members WHERE id = \?$/)
    expect(one(db, 'SELECT full_name, membership_status, membership_expiry FROM members WHERE id = ?', 'mem-lark')).toEqual({ full_name: 'Lark Ashdown', membership_status: 'active', membership_expiry: '2027-06-19' })
    expect(db.prepare("SELECT action FROM admin_audit_log WHERE target_member_id = 'mem-lark' ORDER BY rowid").all().map((r) => r.action)).toEqual(['name_change', 'membership_override'])
  })

  it('with the count of changes there, it takes the count and reads nothing back', async () => {
    const { result, after } = await apply(seededDb(LARK_COLUMNS))
    expect(result.exitCode).toBe(0)
    expect(after('UPDATE members SET full_name')).toMatch(/^INSERT INTO admin_audit_log /)
  })

  it('stops the person when the read-back shows the row changed after it was read, and writes no audit row for it', async () => {
    const db = seededDb(LARK_COLUMNS)
    // Someone renames the row just before the script's guarded rename reaches it.
    const before = (sql: string) => {
      if (sql.startsWith('UPDATE members SET full_name')) db.prepare("UPDATE members SET full_name = 'Lark Someone' WHERE id = 'mem-lark'").run()
    }
    const { lines, result } = await apply(db, { meta: false, before })
    expect(result.exitCode).toBe(1)
    expect(lines.filter((l) => l.startsWith('   FAIL'))).toEqual([`   FAIL    ${RENAMED}: nothing was written: the row changed after it was read; run the script again`])
    expect(one(db, 'SELECT full_name, membership_status FROM members WHERE id = ?', 'mem-lark')).toEqual({ full_name: 'Lark Someone', membership_status: 'expired' })
    expect(one(db, 'SELECT COUNT(*) AS n FROM admin_audit_log')).toEqual({ n: 0 })
  })
})

describe('the one list of new sign-in accounts, on a real run', () => {
  it('names a person whose account was made though part of the entry was refused, saying what; a later run says the account is there', async () => {
    const db = seededDb(
      { id: 'mem-other', email: 'other@example.org', full_name: 'Otto Otherway' },
      { id: 'mem-finn', email: 'finn@example.org', full_name: 'Fernwood, Finn', guardian_id: 'mem-other' },
    )
    const d1 = sqliteD1(db)
    const auth = memoryAuth()
    const yaraPlan = plan([
      {
        kind: 'family',
        fullName: 'Yara Hollow',
        email: 'yara@example.org',
        membershipExpiry: '2027-06-17',
        children: ['Finn Fernwood', 'Zeb Hollow'],
        linkExisting: [{ memberId: 'mem-finn', fullName: 'Finn Fernwood' }],
      },
    ])
    const run = async () => {
      const lines: string[] = []
      const result = await execute(buildPlan(yaraPlan, await loadSnapshot(d1, yaraPlan), TODAY), { auth, d1, apply: true, log: (l: string) => lines.push(l) })
      return { lines, result }
    }

    const first = await run()
    expect(first.result.exitCode).toBe(1)
    const named =
      'Yara Hollow <yara@example.org> (account made; refused: child Finn Fernwood: ' +
      'the row mem-finn (Fernwood, Finn) is already a child of another account (mem-other), so it is left alone)'
    expect(first.result.newSignIns).toEqual([named])
    expect(first.lines.slice(-2)).toEqual([
      `New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): ${named}.`,
      'Keep this list: the run that finishes an entry marked "the rest failed" or "refused" may say only that the person has a sign-in account already, without naming them here again.',
    ])
    // The rest of the entry went through: the guardian's row, and Zeb made and covered.
    const yara = auth.accounts.get('yara@example.org')!.id
    expect(db.prepare('SELECT full_name, membership_status FROM members WHERE guardian_id = ?').all(yara).map((r) => [r.full_name, r.membership_status])).toEqual([['Zeb Hollow', 'active']])

    // The next run finds her row, says she has an account, and names nobody.
    const second = await run()
    expect(second.lines).toContain(`   SKIP    yara@example.org has a sign-in account already (the member row ${yara}), so none is made`)
    expect(second.result.newSignIns).toEqual([])
    expect(second.lines.at(-1)).toBe('No new sign-in accounts.')
  })
})

// ── Audit log rows an earlier run could not write ────────────────────

describe('audit log rows kept from an earlier run', () => {
  const KEPT = {
    id: 'aud-kept-1',
    actorId: 'admin-1',
    actorEmail: 'Admin@Example.org',
    action: 'membership_override',
    targetId: 'mem-lark',
    targetLabel: 'Ashdown, Lark <lark@example.org>',
    detail: JSON.stringify({ from: { status: 'expired', expiry: '2026-03-31', type: 'adult' }, to: { status: 'active', expiry: '2027-06-19', type: 'adult' }, reason: SOURCE }),
    // 7:30 PM on Tuesday in Louisiana, already Wednesday in UTC.
    madeAt: '2026-11-04 01:30:00',
  }
  // As a run after the change finds Lark: the change in place.
  const DONE = ROWS.map((r) => (r.id === 'mem-lark' ? { ...r, membership_status: 'active', membership_expiry: '2027-06-19' } : r))
  const LARK = { kind: 'update', memberId: 'mem-lark', membershipExpiry: '2027-06-19', membershipStatus: 'active' }
  const withKept = (missingAudit: unknown[], audit: unknown[] = []) => buildPlan(plan([LARK]), { members: DONE, registrationCounts: {}, missingAudit, audit }, TODAY) as Group[]
  const kinds = (groups: Group[]) => groups.map((g) => g.kind)

  it('come first, in a group of their own, each an operation that writes it, said in words with the day its change was made', () => {
    const groups = withKept([KEPT])
    expect(groups[0]).toMatchObject({ index: 0, kind: 'audit', person: 'Audit log rows an earlier run could not write' })
    expect(steps(groups[0])).toEqual([
      ['audit', 'membership of Ashdown, Lark <lark@example.org>: adult, active to Sat, Jun 19, 2027 (was adult, expired Tue, Mar 31, 2026); the change was made Tue, Nov 3, 2026'],
    ])
    expect(groups[0].ops[0]).toMatchObject({ row: KEPT })
    expect(steps(groups[1])).toEqual([['skip', 'membership of Ashdown, Lark is already adult, active to Sat, Jun 19, 2027']])
    expect(kinds(withKept([]))).toEqual(['update'])
  })

  it('are left out once the table has them, under their id or as the same change, and a row kept twice is written once', () => {
    expect(kinds(withKept([KEPT], [{ id: KEPT.id, target_member_id: 'mem-lark', action: 'membership_override', detail: '{}' }]))).toEqual(['update'])
    // Written by hand under another id: the same member, action, reason, from and to, the keys in another order.
    const detail = { to: { type: 'adult', expiry: '2027-06-19', status: 'active' }, reason: SOURCE, from: { status: 'expired', type: 'adult', expiry: '2026-03-31' } }
    const byHand = { id: 'aud-by-hand', target_member_id: 'mem-lark', action: 'membership_override', detail: JSON.stringify(detail) }
    expect(kinds(withKept([KEPT], [byHand]))).toEqual(['update'])
    // Another reason, another date, another member or another action is another row.
    for (const other of [
      { ...byHand, detail: JSON.stringify({ ...detail, reason: 'Changed on the admin page' }) },
      { ...byHand, detail: JSON.stringify({ ...detail, to: { ...detail.to, expiry: '2027-06-20' } }) },
      { ...byHand, target_member_id: 'mem-kit' },
      { ...byHand, action: 'name_change' },
    ]) {
      expect(kinds(withKept([KEPT], [other]))).toEqual(['audit', 'update'])
    }
    expect(withKept([KEPT, { ...KEPT }])[0].ops).toHaveLength(1)
  })

  it('says each kind of row in words', () => {
    const kept = (action: string, detail: object) => ({ ...KEPT, id: `aud-${action}`, action, detail: JSON.stringify({ ...detail, reason: SOURCE }) })
    expect(steps(withKept([kept('name_change', { from: 'Ashdown, Lark', to: 'Lark Ashdown' }), kept('email_change', { from: 'old@example.org', to: 'lark@example.org' }), kept('guardian_link', { guardianId: 'mem-cleo' })])[0])).toEqual([
      ['audit', 'name of Ashdown, Lark <lark@example.org>: "Ashdown, Lark" to "Lark Ashdown"; the change was made Tue, Nov 3, 2026'],
      ['audit', 'email of Ashdown, Lark <lark@example.org>: old@example.org to lark@example.org; the change was made Tue, Nov 3, 2026'],
      ['audit', 'Ashdown, Lark <lark@example.org> linked as a child of the account mem-cleo; the change was made Tue, Nov 3, 2026'],
    ])
  })

  it('stop the whole run when one is not a row this script writes', () => {
    expect(() => withKept([{ ...KEPT, action: 'role_change' }])).toThrow('Audit log row 1 kept from an earlier run has the action "role_change", which this script does not write.')
    expect(() => withKept([{ ...KEPT, madeAt: 'Tue, Nov 3' }])).toThrow('has the time "Tue, Nov 3", not one written YYYY-MM-DD HH:MM:SS')
    expect(() => withKept([KEPT, { ...KEPT, id: 'aud-2', detail: '[]' }])).toThrow('Audit log row 2 kept from an earlier run has a detail that is not a JSON object.')
    expect(() => withKept([{ ...KEPT, targetId: ' ' }])).toThrow(PlanError)
  })

  it('loadSnapshot reads the audit log rows of the kept rows\' members, and nothing of the audit log when none are kept', async () => {
    const db = readOnlyDb(ROWS)
    const snapshot = await loadSnapshot(db, plan([LARK]), { missingAudit: [KEPT, { ...KEPT, id: 'aud-kept-2' }] })
    expect(db.statements.at(-1)).toEqual({ sql: 'SELECT id, target_member_id, action, detail FROM admin_audit_log WHERE target_member_id IN (?)', params: ['mem-lark'] })
    expect(snapshot.missingAudit).toHaveLength(2)
    const plain = readOnlyDb(ROWS)
    expect(await loadSnapshot(plain, plan([LARK]))).toMatchObject({ audit: [], missingAudit: [] })
    expect(plain.statements.some(({ sql }) => /admin_audit_log/.test(sql))).toBe(false)
  })

  it('the dry run prints them under their own heading and counts them, and writes nothing', async () => {
    const db = readOnlyDb(DONE)
    const lines: string[] = []
    const result = await execute(withKept([KEPT]), { auth: noAccounts, d1: db, apply: false, log: (l: string) => lines.push(l) })
    expect(result.exitCode).toBe(0)
    expect(lines.slice(1, 4)).toEqual([
      '',
      'Audit log rows an earlier run could not write:',
      '   AUDIT   membership of Ashdown, Lark <lark@example.org>: adult, active to Sat, Jun 19, 2027 (was adult, expired Tue, Mar 31, 2026); the change was made Tue, Nov 3, 2026',
    ])
    expect(lines).toContain('Summary of the dry run, nothing written: would create 0, link 0, update 0, write 1 audit log row; skipped 1; failed 0.')
    expect(db.statements.every(({ sql }) => isRead(sql))).toBe(true)
  })

  it('a kept row that still cannot be written stays kept, and does not stop the next one', async () => {
    const db = sqliteD1(seededDb({ ...LARK_COLUMNS, membership_status: 'active', membership_expiry: '2027-06-19' }))
    const failing = {
      async query(sql: string, params: unknown[] = []) {
        if (/INTO admin_audit_log/.test(sql) && params[0] === 'aud-kept-1') throw new Error('the audit table did not answer')
        return db.query(sql, params)
      },
    }
    const second = { ...KEPT, id: 'aud-kept-2', action: 'name_change', detail: JSON.stringify({ from: 'Lark Ashdown', to: 'Ashdown, Lark', reason: SOURCE }) }
    const lines: string[] = []
    const result = await execute(withKept([KEPT, second]), { auth: noAccounts, d1: failing, apply: true, log: (l: string) => lines.push(l) })
    expect(result.exitCode).toBe(1)
    expect(lines).toContain(
      '   FAIL    membership of Ashdown, Lark <lark@example.org>: adult, active to Sat, Jun 19, 2027 (was adult, expired Tue, Mar 31, 2026); the change was made Tue, Nov 3, 2026: ' +
        'the audit log row was still not written (the audit table did not answer); it is kept for the next run with --apply, or insert it by hand with the statement below',
    )
    expect(result.missingAuditRows).toEqual([KEPT])
    expect(result.summary).toMatchObject({ audited: 1, failed: 1 })
    // The kept rows are no one's entry, so nobody is named as failed.
    expect(result.failedPeople).toEqual([])
  })
})

describe('the file of kept audit log rows', () => {
  const ROW = {
    id: 'aud-file-1',
    actorId: 'admin-1',
    actorEmail: 'Admin@Example.org',
    action: 'name_change',
    targetId: 'mem-lark',
    targetLabel: 'Lark Ashdown <lark@example.org>',
    detail: JSON.stringify({ from: 'Ashdown, Lark', to: 'Lark Ashdown', reason: SOURCE }),
    madeAt: '2026-11-03 18:00:00',
  }

  it('sits beside the plan, named after it', () => {
    expect(missingAuditPath('/plans/nov-3.json')).toBe('/plans/nov-3.missing-audit.json')
    expect(missingAuditPath('/plans/NOV-3.JSON')).toBe('/plans/NOV-3.missing-audit.json')
    expect(missingAuditPath('/plans/nov-3')).toBe('/plans/nov-3.missing-audit.json')
  })

  it('keeps one of each row, readable by its owner only, reads them back, and is removed once none is left', async () => {
    const work = mkdtempSync(join(tmpdir(), 'apply-memberships-kept-'))
    try {
      const file = join(work, 'plan.missing-audit.json')
      expect(await readMissingAudit(file)).toEqual([])
      await keepMissingAudit(file, [ROW, { ...ROW }])
      expect(await readMissingAudit(file)).toEqual([ROW])
      expect(statSync(file).mode & 0o777).toBe(0o600)
      await keepMissingAudit(file, [])
      expect(existsSync(file)).toBe(false)
      for (const [text, problem] of [
        ['{"not":"a list"}', 'it must hold a list of audit log rows'],
        [JSON.stringify([{ ...ROW, id: '' }]), 'row 1 has no id'],
        [JSON.stringify([ROW, { ...ROW, action: 'impersonation_start' }]), 'row 2 has the action "impersonation_start", which this script does not write'],
      ]) {
        writeFileSync(file, text)
        await expect(readMissingAudit(file)).rejects.toThrow(problem)
      }
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})

describe('the command line, from a run whose audit log row failed to the run that writes it', () => {
  const ENV = {
    SUPABASE_URL: 'https://sign-in.example.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'service-value-for-the-test',
    CLOUDFLARE_API_TOKEN: 'token-value-for-the-test',
    CF_ACCOUNT_ID: 'account-value-for-the-test',
  }

  async function setUp() {
    const work = mkdtempSync(join(tmpdir(), 'apply-memberships-cli-'))
    const planFile = join(work, 'plan.json')
    // A far expiry, since the command line takes today from the clock.
    writeFileSync(planFile, JSON.stringify(plan([{ kind: 'update', memberId: 'mem-lark', membershipExpiry: '2099-06-19', membershipStatus: 'active' }])))
    const db = seededDb(LARK_COLUMNS)
    const armed = { on: false }
    const api = sqliteApi(db, {
      before: (sql) => {
        if (armed.on && /INTO admin_audit_log/.test(sql)) throw new Error('the audit table did not answer')
      },
    })
    const cli = async (argv: string[]) => {
      const out: string[] = []
      const err: string[] = []
      const code = await main(argv, { env: ENV, log: (l: string) => out.push(l), error: (l: string) => err.push(l), fetchFn: api.fetchFn as never })
      return { code, out, err }
    }
    return { work, planFile, keptFile: join(work, 'plan.missing-audit.json'), db, armed, api, cli }
  }

  it('keeps the row beside the plan; the next run writes exactly that row and nothing else, and removes the file', async () => {
    const { work, planFile, keptFile, db, armed, api, cli } = await setUp()
    try {
      // The change is made; its audit log row fails both tries and is kept.
      armed.on = true
      const first = await cli([planFile, '--apply'])
      expect(first.code).toBe(1)
      expect(first.err).toEqual([])
      expect(one(db, 'SELECT membership_status, membership_expiry FROM members WHERE id = ?', 'mem-lark')).toEqual({ membership_status: 'active', membership_expiry: '2099-06-19' })
      expect(one(db, 'SELECT COUNT(*) AS n FROM admin_audit_log')).toEqual({ n: 0 })
      const kept = JSON.parse(readFileSync(keptFile, 'utf8'))
      expect(kept).toHaveLength(1)
      expect(kept[0]).toMatchObject({ actorId: 'admin-1', actorEmail: 'Admin@Example.org', action: 'membership_override', targetId: 'mem-lark', targetLabel: 'Ashdown, Lark <lark@example.org>' })
      expect(JSON.parse(kept[0].detail)).toEqual({
        from: { status: 'expired', expiry: '2026-03-31', type: 'adult' },
        to: { status: 'active', expiry: '2099-06-19', type: 'adult' },
        reason: SOURCE,
      })
      expect(first.out.at(-1)).toBe(`Kept for the next run with --apply: 1 audit log row, in ${keptFile}.`)

      // With the cause mended, a dry run shows the row and leaves the file as it is.
      armed.on = false
      const dry = await cli([planFile])
      expect(dry.code).toBe(0)
      expect(dry.out).toContain(`Audit log rows kept from an earlier run: 1, in ${keptFile}.`)
      expect(dry.out).toContain('Audit log rows an earlier run could not write:')
      expect(JSON.parse(readFileSync(keptFile, 'utf8'))).toEqual(kept)

      // The next real run writes that row, under its id and dated when the change was made, and nothing else.
      const before = api.statements.length
      const second = await cli([planFile, '--apply'])
      expect(second.code).toBe(0)
      const writes = api.statements.slice(before).filter(({ sql }) => !isRead(sql))
      expect(writes).toEqual([
        {
          sql: 'INSERT OR IGNORE INTO admin_audit_log (id, actor_id, actor_email, action, target_member_id, target_label, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          params: [kept[0].id, 'admin-1', 'Admin@Example.org', 'membership_override', 'mem-lark', 'Ashdown, Lark <lark@example.org>', kept[0].detail, kept[0].madeAt],
        },
      ])
      expect(db.prepare('SELECT id, actor_id, action, target_member_id, detail, created_at FROM admin_audit_log').all().map((r) => ({ ...r }))).toEqual([
        { id: kept[0].id, actor_id: 'admin-1', action: 'membership_override', target_member_id: 'mem-lark', detail: kept[0].detail, created_at: kept[0].madeAt },
      ])
      expect(second.out).toContain('Summary: created 0, linked 0, updated 0, skipped 1, failed 0, audit log rows written 1.')
      expect(existsSync(keptFile)).toBe(false)

      // A third run has nothing to do.
      const third = api.statements.length
      expect((await cli([planFile, '--apply'])).code).toBe(0)
      expect(api.statements.slice(third).filter(({ sql }) => !isRead(sql))).toEqual([])
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })

  it('keeps the row in the file the moment it fails, so a run stopped part way after it has already kept it', async () => {
    const { work, planFile, keptFile, db, armed, api, cli } = await setUp()
    try {
      armed.on = true
      // The run stops at its summary, after the change was made and its audit log row failed.
      const out: string[] = []
      const stopping = (line: string) => {
        if (line.startsWith('Summary')) throw new Error('the run was stopped')
        out.push(line)
      }
      await expect(main([planFile, '--apply'], { env: ENV, log: stopping, error: () => {}, fetchFn: api.fetchFn as never })).rejects.toThrow('the run was stopped')
      expect(out.some((line) => line.startsWith('   FAIL'))).toBe(true)
      const kept = JSON.parse(readFileSync(keptFile, 'utf8'))
      expect(kept).toHaveLength(1)
      expect(kept[0]).toMatchObject({ action: 'membership_override', targetId: 'mem-lark', actorId: 'admin-1' })
      expect(statSync(keptFile).mode & 0o777).toBe(0o600)
      // Written under a temporary name and then renamed, so nothing else is left beside the plan.
      expect(readdirSync(work).sort()).toEqual(['plan.json', 'plan.missing-audit.json'])
      expect(one(db, 'SELECT COUNT(*) AS n FROM admin_audit_log')).toEqual({ n: 0 })

      // The next run writes it from the file and removes the file.
      armed.on = false
      const next = await cli([planFile, '--apply'])
      expect(next.code).toBe(0)
      expect(db.prepare('SELECT id FROM admin_audit_log').all().map((r) => r.id)).toEqual([kept[0].id])
      expect(existsSync(keptFile)).toBe(false)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })

  it('a row kept while the run goes on is added to the rows kept from before, and the end of the run leaves only what is still missing', async () => {
    const { work, planFile, keptFile, db, armed, cli } = await setUp()
    try {
      armed.on = true
      await cli([planFile, '--apply'])
      const [first] = JSON.parse(readFileSync(keptFile, 'utf8'))
      // On the next run the kept row is written, and a new one fails. Until the run ends both are in the file.
      writeFileSync(planFile, JSON.stringify(plan([{ kind: 'update', memberId: 'mem-lark', fullName: 'Lark Ashdown' }])))
      const seen: string[][] = []
      const watching = (line: string) => {
        if (line.startsWith('Summary')) seen.push(JSON.parse(readFileSync(keptFile, 'utf8')).map((r: { id: string }) => r.id))
      }
      const api = sqliteApi(db, {
        before: (sql, params) => {
          if (/INTO admin_audit_log/.test(sql) && params[0] !== first.id) throw new Error('the audit table did not answer')
        },
      })
      expect(await main([planFile, '--apply'], { env: ENV, log: watching, error: () => {}, fetchFn: api.fetchFn as never })).toBe(1)
      expect(seen).toHaveLength(1)
      expect(seen[0]).toHaveLength(2)
      expect(seen[0][0]).toBe(first.id)
      // The end of the run keeps only the row still missing.
      expect(db.prepare('SELECT id FROM admin_audit_log').all().map((r) => r.id)).toEqual([first.id])
      const after = JSON.parse(readFileSync(keptFile, 'utf8'))
      expect(after.map((r: { id: string }) => r.id)).toEqual([seen[0][1]])
      expect(after[0]).toMatchObject({ action: 'name_change', targetId: 'mem-lark' })
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })

  it('drops a kept row the table already has, written by hand from its statement, and writes nothing', async () => {
    const { work, planFile, keptFile, db, armed, api, cli } = await setUp()
    try {
      armed.on = true
      const first = await cli([planFile, '--apply'])
      const statement = first.out.find((l) => l.trim().startsWith('INSERT OR IGNORE INTO admin_audit_log'))!.trim()
      armed.on = false
      db.exec(statement)
      const before = api.statements.length
      const second = await cli([planFile, '--apply'])
      expect(second.code).toBe(0)
      expect(api.statements.slice(before).filter(({ sql }) => !isRead(sql))).toEqual([])
      expect(second.out).not.toContain('Audit log rows an earlier run could not write:')
      expect(one(db, 'SELECT COUNT(*) AS n FROM admin_audit_log')).toEqual({ n: 1 })
      expect(existsSync(keptFile)).toBe(false)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })

  it('stops before reading production when the kept file is not a list of rows the script writes', async () => {
    const { work, planFile, keptFile, api, cli } = await setUp()
    try {
      writeFileSync(keptFile, '{"not":"a list"}')
      const { code, out, err } = await cli([planFile, '--apply'])
      expect(code).toBe(1)
      expect(out).toEqual([])
      expect(err).toEqual([
        `The file ${keptFile} cannot be used: it must hold a list of audit log rows. ` +
          'It holds audit log rows an earlier run could not write; put it right, or move it away once each row is written by hand.',
      ])
      expect(api.statements).toEqual([])
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })
})
