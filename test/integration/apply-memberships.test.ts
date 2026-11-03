// test/integration/apply-memberships.test.ts
//
// scripts/apply-memberships.mjs against the harness's database, through a small
// adapter over env.DB, with a stand-in for the sign-in service that keeps its
// accounts in memory and records every call. Checks the rows the script
// leaves (ids, emails, names, memberships, guardians, the children's email
// and club), the audit log rows, the printed lines, that a dry run and a
// second run write nothing, that a failure stops one person only and a run
// after the fix finishes the job without repeating anything, and that the
// script will not act in the name of anyone but an admin. Also that a family
// will not take over a row holding a US Chess ID or a tournament entry
// unless the entry says so, and that an unused sign-in account given a real
// email is on the list of people to tell. A person whose sign-in account was
// made, or given a real email, is named on that list even when their entry
// stops part way, with a note saying so, and the run that finishes the entry
// says they have a sign-in account already. An audit log row that fails is
// tried once more without being written twice; one that still fails comes
// back from the run as a row, which the next run writes, exactly that row and
// nothing else, and as a statement that writes it when run by hand. An
// update's expiry given without a status sets the status from the date, and a
// guardian that has become a child by the time of the run is refused a new
// child and a link, as /api/me/children refuses it. A second entry that
// reaches a child row a family already holds is refused on every run, so the
// two never undo each other. Every person here is invented.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { PlanError, buildPlan, execute, loadSnapshot } from '../../scripts/apply-memberships.mjs'

beforeEach(resetHarness)

const TODAY = '2026-11-03'
const SOURCE = 'Payments taken at the club table, entered by hand'

/** The script's database adapter over the test database. Notes every statement that is not a read. */
function database() {
  const writes: string[] = []
  return {
    writes,
    async query(sql: string, params: unknown[] = []) {
      if (!/^\s*SELECT\b/i.test(sql)) writes.push(sql.replace(/\s+/g, ' ').trim())
      const result = await env.DB.prepare(sql).bind(...params).all()
      return { results: result.results ?? [], changes: result.meta?.changes ?? null }
    },
  }
}

interface Account {
  id: string
  email: string
  signedIn: boolean
}

/** The sign-in service, in memory. */
function signInService(existing: Account[] = []) {
  const accounts = new Map(existing.map((account) => [account.email.toLowerCase(), { ...account }]))
  const calls: string[] = []
  const trouble: { updateEmail: string | null } = { updateEmail: null }
  return {
    accounts,
    calls,
    trouble,
    async findUserByEmail(email: string) {
      calls.push(`find ${email}`)
      return accounts.get(email.toLowerCase()) ?? null
    },
    async createUser({ email, fullName }: { email: string; fullName: string }) {
      calls.push(`create ${email} ${fullName}`)
      if (accounts.has(email.toLowerCase())) return { duplicate: true }
      const id = crypto.randomUUID()
      accounts.set(email.toLowerCase(), { id, email, signedIn: false })
      return { id }
    },
    async updateEmail(id: string, email: string) {
      calls.push(`email ${id} ${email}`)
      if (trouble.updateEmail) throw new Error(trouble.updateEmail)
      const held = [...accounts.entries()].find(([, account]) => account.id === id)
      if (!held) throw new Error(`no sign-in account has the id ${id}`)
      accounts.delete(held[0])
      accounts.set(email.toLowerCase(), { ...held[1], email })
    },
  }
}

type Auth = ReturnType<typeof signInService>
type Db = ReturnType<typeof database>

function planOf(adminId: string, entries: unknown[]) {
  return {
    source: SOURCE,
    actor: { memberId: adminId, email: `${adminId}@test.lca` },
    defaults: { individualType: 'adult', familyType: 'family' },
    entries,
  }
}

/** Reads the rows, plans from them and runs the plan, as the command does. */
async function run(plan: object, auth: Auth, db: Db, apply = true) {
  const lines: string[] = []
  const groups = buildPlan(plan, await loadSnapshot(db, plan), TODAY)
  const result = await execute(groups, { auth, d1: db, apply, log: (line: string) => lines.push(line) })
  return { groups, lines, result }
}

async function setColumns(id: string, columns: Record<string, string | null>) {
  const names = Object.keys(columns)
  await env.DB.prepare(`UPDATE members SET ${names.map((n) => `${n} = ?`).join(', ')} WHERE id = ?`)
    .bind(...names.map((n) => columns[n]), id)
    .run()
}

type MemberRow = {
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
}

async function member(id: string): Promise<MemberRow> {
  const row = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first<MemberRow>()
  if (!row) throw new Error(`no member ${id}`)
  return row
}

const membership = (row: MemberRow) => [row.membership_status, row.membership_expiry, row.membership_type]

type AuditRow = { action: string; actor_id: string; actor_email: string; target_member_id: string; target_label: string; detail: string }

async function auditRows(actorId: string): Promise<AuditRow[]> {
  const { results } = await env.DB.prepare(
    'SELECT action, actor_id, actor_email, target_member_id, target_label, detail FROM admin_audit_log WHERE actor_id = ? ORDER BY rowid',
  )
    .bind(actorId)
    .all<AuditRow>()
  return results ?? []
}

describe('apply-memberships against the database', () => {
  it('applies every kind of entry, writes the audit log, and a second run writes nothing', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const at = (name: string) => `${name}.${tag}@example.org`
    const admin = await seedAdmin()
    const club = await seedClub()

    const ben = await seedMember({ fullName: 'Thistle, Ben', email: `Ben.Thistle.${tag}@Example.org`, membershipStatus: 'expired' })
    await setColumns(ben, { membership_expiry: '2026-03-31', membership_type: 'adult' })
    const cleo = await seedMember({ fullName: 'Fernwood, Dov', email: at('cleo'), clubId: club })
    await setColumns(cleo, { membership_expiry: '2027-02-28', membership_type: 'scholastic', created_at: '2025-03-01 12:00:00' })
    const dov = `child-dov-${tag}`
    await env.DB.prepare(
      `INSERT INTO members (id, email, full_name, membership_status, role, club_id, guardian_id, created_at)
       VALUES (?, ?, 'Dov Fernwood', 'none', 'member', ?, ?, '2026-10-01 12:00:00')`,
    ).bind(dov, at('cleo'), club, cleo).run()
    const esme = await seedMember({ fullName: 'Fernwood, Esme', email: at('esme') })
    await setColumns(esme, { membership_expiry: '2028-02-29', membership_type: 'scholastic', created_at: '2025-01-10 12:00:00' })
    const other = await seedMember({ fullName: 'Otto Otherway' })
    const finn = await seedMember({ fullName: 'Fernwood, Finn', email: at('finn'), membershipStatus: 'none' })
    await setColumns(finn, { guardian_id: other })
    const kit = await seedMember({ fullName: 'Quillfeather, Kit', email: `kit.${tag}@lca.invalid` })
    await setColumns(kit, { membership_expiry: '2099-12-31', membership_type: 'adult' })
    const lark = await seedMember({ fullName: 'Ashdown, Lark', email: at('lark'), membershipStatus: 'expired' })
    await setColumns(lark, { membership_expiry: '2026-03-31', membership_type: 'adult' })

    const piaAccount = crypto.randomUUID()
    const quinnAccount = crypto.randomUUID()
    const auth = signInService([
      { id: ben, email: `ben.thistle.${tag}@example.org`, signedIn: true },
      { id: cleo, email: at('cleo'), signedIn: true },
      { id: kit, email: `kit.${tag}@lca.invalid`, signedIn: true },
      // Accounts with no row yet: one never used, one used before.
      { id: piaAccount, email: at('pia'), signedIn: false },
      { id: quinnAccount, email: at('quinn'), signedIn: true },
    ])
    const plan = planOf(admin, [
      { kind: 'add', fullName: 'Ada Larkspur', email: `Ada.${tag}@Example.org`, membershipExpiry: '2027-06-18', pending: 'the surname is to be confirmed' },
      { kind: 'add', fullName: 'Ben Thistle', email: at('ben.thistle'), membershipExpiry: '2027-06-18' },
      {
        kind: 'family',
        memberId: cleo,
        fullName: 'Cleo Fernwood',
        email: at('cleo'),
        membershipExpiry: '2027-06-17',
        children: ['Dov Fernwood', 'Esme Fernwood', 'Finn Fernwood', 'Gus Fernwood', 'Hattie Fernwood'],
        linkExisting: [
          { memberId: esme, fullName: 'Esme Fernwood' },
          { memberId: finn, fullName: 'Finn Fernwood' },
        ],
        note: 'the row holding this email carries a child\'s name',
      },
      { kind: 'family', fullName: 'Ivo Brambleton', email: at('ivo'), membershipExpiry: '2027-07-26', children: ['Juno Brambleton'] },
      { kind: 'update', memberId: kit, fullName: 'Quillfeather, Kit', email: at('kit'), membershipExpiry: '2027-06-18', membershipStatus: 'active' },
      { kind: 'update', memberId: lark, fullName: 'Lark Ashdown', email: at('lark'), membershipExpiry: '2027-06-19', membershipStatus: 'active' },
      { kind: 'add', fullName: 'Pia Sundown', email: at('pia'), membershipExpiry: '2027-06-16' },
      { kind: 'add', fullName: 'Quinn Harrow', email: at('quinn'), membershipExpiry: '2027-06-16' },
    ])

    // The dry run reads and prints, and writes nowhere.
    const db = database()
    const dry = await run(plan, auth, db, false)
    expect(db.writes).toEqual([])
    expect(auth.calls.every((call) => call.startsWith('find '))).toBe(true)
    expect(dry.lines).toContain(`   CREATE  sign-in account for ${at('pia')}: one already uses this email (${piaAccount}), so its id becomes the member id`)
    expect(dry.lines).toContain('Summary of the dry run, nothing written: would create 7, link 1, update 11; skipped 6; failed 1.')
    expect(await auditRows(admin)).toEqual([])

    // The real run.
    const first = await run(plan, auth, db)
    expect(first.result.exitCode).toBe(1) // Finn is refused; everyone else goes ahead
    expect(first.lines[0]).toBe('Writing the changes below.')

    const ada = auth.accounts.get(at('ada'))!
    const ivo = auth.accounts.get(at('ivo'))!
    expect(auth.calls.filter((call) => call.startsWith('create '))).toEqual([
      `create ${at('ada')} Ada Larkspur`,
      `create ${at('ivo')} Ivo Brambleton`,
      `create ${at('pia')} Pia Sundown`,
      `create ${at('quinn')} Quinn Harrow`,
    ])
    expect(auth.calls).toContain(`email ${kit} ${at('kit')}`)
    expect(auth.accounts.get(at('kit'))?.id).toBe(kit)

    // add: new rows take the sign-in account's id; the email is stored lower-cased.
    expect(await member(ada.id)).toMatchObject({ email: at('ada'), full_name: 'Ada Larkspur', role: 'member', membership_status: 'active', membership_expiry: '2027-06-18', membership_type: 'adult', guardian_id: null })
    expect(membership(await member(piaAccount))).toEqual(['active', '2027-06-16', 'adult'])
    expect(membership(await member(quinnAccount))).toEqual(['active', '2027-06-16', 'adult'])
    // add, found by email: the membership changes, the name and stored email do not.
    expect(await member(ben)).toMatchObject({ full_name: 'Thistle, Ben', email: `Ben.Thistle.${tag}@Example.org`, membership_status: 'active', membership_expiry: '2027-06-18', membership_type: 'adult' })

    // family, guardian named by id.
    expect(await member(cleo)).toMatchObject({ full_name: 'Cleo Fernwood', email: at('cleo'), club_id: club, membership_status: 'active', membership_expiry: '2027-06-17', membership_type: 'family' })
    const { results: cleoKids } = await env.DB.prepare(
      'SELECT * FROM members WHERE guardian_id = ? ORDER BY created_at ASC, rowid ASC',
    ).bind(cleo).all<MemberRow>()
    expect(cleoKids.map((k) => [k.full_name, k.email, k.club_id, ...membership(k)])).toEqual([
      ['Fernwood, Esme', at('esme'), null, 'active', '2028-02-29', 'family'],
      ['Dov Fernwood', at('cleo'), club, 'active', '2027-06-17', 'family'],
      ['Gus Fernwood', at('cleo'), club, 'active', '2027-06-17', 'family'],
      ['Hattie Fernwood', at('cleo'), club, 'none', null, null],
    ])
    for (const kid of cleoKids.slice(2)) expect(kid).toMatchObject({ id: expect.stringMatching(/^child-[0-9a-f-]{36}$/), role: 'member' })
    expect(await member(finn)).toMatchObject({ guardian_id: other, membership_status: 'none' })

    // family, new guardian.
    expect(await member(ivo.id)).toMatchObject({ full_name: 'Ivo Brambleton', email: at('ivo'), club_id: null, membership_status: 'active', membership_expiry: '2027-07-26', membership_type: 'family' })
    const juno = await env.DB.prepare('SELECT * FROM members WHERE guardian_id = ?').bind(ivo.id).first<MemberRow>()
    expect(juno).toMatchObject({ full_name: 'Juno Brambleton', email: at('ivo'), club_id: null, membership_status: 'active', membership_expiry: '2027-07-26', membership_type: 'family' })

    // update: the email on the account and the row, the earlier expiry as asked.
    expect(await member(kit)).toMatchObject({ full_name: 'Quillfeather, Kit', email: at('kit'), membership_status: 'active', membership_expiry: '2027-06-18' })
    expect(await member(lark)).toMatchObject({ full_name: 'Lark Ashdown', email: at('lark'), membership_status: 'active', membership_expiry: '2027-06-19' })

    // The audit log, in the admin's name, with the plan's source as the reason:
    // a membership for each new row, each change and each cover; Cleo's and
    // Lark's names; Kit's email; Esme's link. Making a child profile logs nothing.
    const audit = await auditRows(admin)
    const count = (action: string) => audit.filter((row) => row.action === action).length
    expect([count('membership_override'), count('name_change'), count('email_change'), count('guardian_link'), audit.length]).toEqual([12, 2, 1, 1, 16])
    expect(audit.every((row) => row.actor_email === `${admin}@test.lca` && JSON.parse(row.detail).reason === SOURCE)).toBe(true)
    const about = (target: string, action: string) => audit.find((row) => row.target_member_id === target && row.action === action)
    expect(about(ben, 'membership_override')).toMatchObject({ target_label: `Thistle, Ben <Ben.Thistle.${tag}@Example.org>` })
    expect(JSON.parse(about(ben, 'membership_override')!.detail)).toEqual({
      from: { status: 'expired', expiry: '2026-03-31', type: 'adult' },
      to: { status: 'active', expiry: '2027-06-18', type: 'adult' },
      reason: SOURCE,
    })
    expect(JSON.parse(about(esme, 'membership_override')!.detail)).toMatchObject({
      from: { status: 'active', expiry: '2028-02-29', type: 'scholastic' },
      to: { status: 'active', expiry: '2028-02-29', type: 'family' },
    })
    expect(about(ada.id, 'membership_override')).toMatchObject({ target_label: `Ada Larkspur <${at('ada')}>` })
    expect(JSON.parse(about(ada.id, 'membership_override')!.detail)).toEqual({
      from: { status: 'none', expiry: null, type: null },
      to: { status: 'active', expiry: '2027-06-18', type: 'adult' },
      reason: SOURCE,
    })
    expect(JSON.parse(about(cleo, 'name_change')!.detail)).toEqual({ from: 'Fernwood, Dov', to: 'Cleo Fernwood', reason: SOURCE })
    expect(about(kit, 'membership_override')).toMatchObject({ target_label: `Quillfeather, Kit <${at('kit')}>` })
    expect(about(kit, 'email_change')).toMatchObject({ target_label: `Quillfeather, Kit <${at('kit')}>` })
    expect(JSON.parse(about(kit, 'email_change')!.detail)).toEqual({ from: `kit.${tag}@lca.invalid`, to: at('kit'), reason: SOURCE })
    expect(about(esme, 'guardian_link')).toMatchObject({ target_label: `Fernwood, Esme <${at('esme')}>` })
    expect(JSON.parse(about(esme, 'guardian_link')!.detail)).toEqual({ guardianId: cleo, reason: SOURCE })
    expect(about(finn, 'membership_override')).toBeUndefined()
    expect(about(finn, 'guardian_link')).toBeUndefined()
    // A new child profile appears only through its cover; Hattie, the fourth, not at all.
    const madeKids = [...cleoKids.slice(2).map((k) => k.id), juno!.id]
    expect(audit.filter((row) => madeKids.includes(row.target_member_id)).map((row) => [row.target_label.split(' <')[0], row.action])).toEqual([
      ['Gus Fernwood', 'membership_override'],
      ['Juno Brambleton', 'membership_override'],
    ])

    // What it printed.
    expect(first.lines).toContain(`3. FAMILY Cleo Fernwood <${at('cleo')}>`)
    expect(first.lines).toContain("   note: the row holding this email carries a child's name")
    expect(first.lines).toContain(`   CREATE  sign-in account for ${at('ada')} (new, id ${ada.id})`)
    expect(first.lines).toContain(`   CREATE  member row for Ada Larkspur <${at('ada')}>: adult, active to Fri, Jun 18, 2027`)
    expect(first.lines).toContain(`   RENAME  "Fernwood, Dov" to "Cleo Fernwood" (${cleo}); the row holds no US Chess ID and no tournament entries`)
    expect(first.lines).toContain(`   LINK    Fernwood, Esme (${esme}) as a child of this account`)
    expect(first.lines).toContain(`   REFUSE  child Finn Fernwood: the row ${finn} (Fernwood, Finn) is already a child of another account (${other}), so it is left alone`)
    expect(first.lines).toContain('   COVER   family coverage for Gus Fernwood: family, active to Thu, Jun 17, 2027 (was no membership)')
    expect(first.lines).toContain(`   EMAIL   kit.${tag}@lca.invalid to ${at('kit')} (${kit}), on the sign-in account first and then on the row`)
    expect(first.lines).toContain('           warning: this ends the membership earlier than the date it holds now, Thu, Dec 31, 2099')
    expect(first.lines).toContain(`   SKIP    ${at('cleo')} has a sign-in account already (the member row ${cleo}), so none is made`)
    expect(first.lines).toContain('Summary: created 7, linked 1, updated 11, skipped 6, failed 1.')
    expect(first.lines.at(-1)).toBe(
      `New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): Ada Larkspur <${at('ada')}>; Ivo Brambleton <${at('ivo')}>; Pia Sundown <${at('pia')}>.`,
    )

    // A second run from fresh reads: only skips and the same refusal.
    const writesBefore = db.writes.length
    const callsBefore = auth.calls.length
    const second = await run(plan, auth, db)
    expect(second.groups.flatMap((g: { ops: Array<{ type: string }> }) => g.ops).filter((op: { type: string }) => op.type !== 'skip' && op.type !== 'refuse')).toEqual([])
    expect(db.writes.length).toBe(writesBefore)
    expect(auth.calls.slice(callsBefore)).toEqual([])
    expect(await auditRows(admin)).toHaveLength(16)
    // Each person the first run made an account for is said to have one now, so the two runs match up.
    for (const [email, id] of [[at('ada'), ada.id], [at('ivo'), ivo.id], [at('pia'), piaAccount]]) {
      expect(second.lines).toContain(`   SKIP    ${email} has a sign-in account already (the member row ${id}), so none is made`)
    }
    expect(second.lines).toContain('Summary: created 0, linked 0, updated 0, skipped 30, failed 1.')
    expect(second.lines.at(-1)).toBe('No new sign-in accounts.')

    // The first run's own operations again: every write reads its row first.
    const lines: string[] = []
    const again = await execute(first.groups, { auth, d1: db, apply: true, log: (line: string) => lines.push(line) })
    expect(db.writes.length).toBe(writesBefore)
    expect(auth.calls.slice(callsBefore)).toEqual([])
    expect(await auditRows(admin)).toHaveLength(16)
    expect(again.summary).toMatchObject({ created: 0, linked: 0, updated: 0, failed: 1 })
    expect(lines).toContain(`   SKIP    sign-in account for ${at('ada')}: the member row ${ada.id} already holds this email`)
    expect(lines).toContain('   SKIP    child Gus Fernwood is already on this account')
  })

  it('stops one person at a failure, carries on with the rest, and a run after the fix repeats nothing', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const at = (name: string) => `${name}.${tag}@example.org`
    const admin = await seedAdmin()
    const kit = await seedMember({ fullName: 'Quillfeather, Kit', email: `kit.${tag}@lca.invalid` })
    await setColumns(kit, { membership_expiry: '2099-12-31', membership_type: 'adult' })
    const lark = await seedMember({ fullName: 'Ashdown, Lark', email: at('lark'), membershipStatus: 'expired' })
    await setColumns(lark, { membership_expiry: '2026-03-31', membership_type: 'adult' })
    const auth = signInService([{ id: kit, email: `kit.${tag}@lca.invalid`, signedIn: true }])
    auth.trouble.updateEmail = 'the sign-in service did not answer'
    const plan = planOf(admin, [
      { kind: 'update', memberId: kit, email: at('kit'), membershipExpiry: '2027-06-18', membershipStatus: 'active' },
      { kind: 'update', memberId: lark, fullName: 'Lark Ashdown', membershipExpiry: '2027-06-19', membershipStatus: 'active' },
      { kind: 'add', fullName: 'Remy Okafor', email: at('remy'), membershipExpiry: '2027-06-18' },
    ])
    const db = database()

    const first = await run(plan, auth, db)
    expect(first.result.exitCode).toBe(1)
    expect(first.lines).toContain(
      `   FAIL    kit.${tag}@lca.invalid to ${at('kit')} (${kit}), on the sign-in account first and then on the row: the sign-in service did not answer`,
    )
    expect(first.lines).toContain(`Failed or refused: Quillfeather, Kit <${at('kit')}>. Fix the cause and run the script again; whatever already holds is skipped.`)
    // Kit's later operations never ran; the others did.
    expect(await member(kit)).toMatchObject({ email: `kit.${tag}@lca.invalid`, membership_expiry: '2099-12-31' })
    expect(await member(lark)).toMatchObject({ full_name: 'Lark Ashdown', membership_status: 'active', membership_expiry: '2027-06-19' })
    const remy = auth.accounts.get(at('remy'))!
    expect(membership(await member(remy.id))).toEqual(['active', '2027-06-18', 'adult'])
    expect(await auditRows(admin)).toHaveLength(3)

    auth.trouble.updateEmail = null
    const writesBefore = db.writes.length
    const fixed = await run(plan, auth, db)
    expect(fixed.result.exitCode).toBe(0)
    expect(await member(kit)).toMatchObject({ email: at('kit'), membership_status: 'active', membership_expiry: '2027-06-18' })
    expect(auth.accounts.get(at('kit'))?.id).toBe(kit)
    // Only Kit's two changes and their two audit rows were written.
    expect(db.writes.slice(writesBefore).map((sql) => sql.split(' ').slice(0, 3).join(' '))).toEqual([
      'UPDATE members SET',
      'INSERT INTO admin_audit_log',
      'UPDATE members SET',
      'INSERT INTO admin_audit_log',
    ])
    const audit = await auditRows(admin)
    expect(audit.map((row) => [row.action, row.target_member_id])).toEqual([
      ['name_change', lark],
      ['membership_override', lark],
      ['membership_override', remy.id],
      ['email_change', kit],
      ['membership_override', kit],
    ])
    expect(fixed.lines).toContain(`   SKIP    membership of Lark Ashdown is already adult, active to Sat, Jun 19, 2027`)
    expect(fixed.lines.at(-1)).toBe('No new sign-in accounts.')
  })

  it('changes only the row when the sign-in account already carries the new email', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const kit = await seedMember({ fullName: 'Kit Quillfeather', email: `kit.${tag}@lca.invalid` })
    const auth = signInService([{ id: kit, email: `kit.${tag}@example.org`, signedIn: true }])
    const db = database()
    const { lines, result } = await run(planOf(admin, [{ kind: 'update', memberId: kit, email: `kit.${tag}@example.org` }]), auth, db)
    expect(result.exitCode).toBe(0)
    expect(auth.calls.some((call) => call.startsWith('email '))).toBe(false)
    expect((await member(kit)).email).toBe(`kit.${tag}@example.org`)
    expect(lines).toContain(`   EMAIL   kit.${tag}@lca.invalid to kit.${tag}@example.org (${kit}); the sign-in account already used it, so only the row changed`)
  })

  it('refuses an email that another sign-in account already uses', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const kit = await seedMember({ fullName: 'Kit Quillfeather', email: `kit.${tag}@lca.invalid` })
    const auth = signInService([{ id: 'someone-else', email: `kit.${tag}@example.org`, signedIn: true }])
    const db = database()
    const { lines, result } = await run(planOf(admin, [{ kind: 'update', memberId: kit, email: `kit.${tag}@example.org` }]), auth, db)
    expect(result.exitCode).toBe(1)
    expect(lines.some((line) => line.startsWith('   FAIL') && line.endsWith(`another sign-in account (someone-else) already uses kit.${tag}@example.org`))).toBe(true)
    expect(db.writes).toEqual([])
    expect((await member(kit)).email).toBe(`kit.${tag}@lca.invalid`)
  })

  it('will not act in the name of a member who is not an admin', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const notAdmin = await seedMember({ role: 'club_rep' })
    const auth = signInService()
    const db = database()
    const plan = planOf(notAdmin, [{ kind: 'add', fullName: 'Ada Larkspur', email: `ada.${tag}@example.org`, membershipExpiry: '2027-06-18' }])
    await expect(run(plan, auth, db)).rejects.toThrow(PlanError)
    await expect(run(plan, auth, db)).rejects.toThrow(`is not an admin (role club_rep)`)
    expect(db.writes).toEqual([])
    expect(auth.calls).toEqual([])
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE lower(email) = ?').bind(`ada.${tag}@example.org`).first<{ n: number }>()).toEqual({ n: 0 })
  })
})

// ── Edges: the same child twice, letter case, expiries that differ, ──
// ── a taken sign-in email, and a database that fails part way ─────────

/** The database adapter, failing the statements `fail` names while `armed.on` is set. */
function flaky(db: Db, armed: { on: boolean }, fail: (sql: string, params: unknown[]) => boolean, message = 'the database did not answer') {
  return {
    writes: db.writes,
    async query(sql: string, params: unknown[] = []) {
      if (armed.on && fail(sql, params)) throw new Error(message)
      return db.query(sql, params)
    },
  }
}

/** The database adapter, running each statement `lose` names and then failing it, as when the answer is lost on the way back. */
function lossy(db: Db, lose: (sql: string, params: unknown[]) => boolean) {
  return {
    writes: db.writes,
    async query(sql: string, params: unknown[] = []) {
      const result = await db.query(sql, params)
      if (lose(sql, params)) throw new Error('the connection dropped before the answer came')
      return result
    },
  }
}

const isChildInsert = (sql: string, params: unknown[], name: string) => /INSERT INTO members/.test(sql) && /guardian_id/.test(sql) && params.includes(name)
const isMemberInsert = (sql: string, email: string, params: unknown[]) => /INSERT INTO members/.test(sql) && /membership_expiry/.test(sql) && params.includes(email)
const isCover = (sql: string, params: unknown[], childId: string) => /SET membership_status = 'active'/.test(sql) && params[1] === childId
const insertsOf = (db: Db) => db.writes.filter((sql) => sql.startsWith('INSERT INTO members'))

async function childrenOf(guardian: string) {
  const { results } = await env.DB.prepare('SELECT * FROM members WHERE guardian_id = ? ORDER BY created_at ASC, rowid ASC').bind(guardian).all<MemberRow>()
  return results ?? []
}

describe('a family that names the same child twice', () => {
  it('refuses that person alone: no account, no row, no audit, and the next person goes ahead', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const at = (name: string) => `${name}.${tag}@example.org`
    const admin = await seedAdmin()
    const auth = signInService()
    const db = database()
    const plan = planOf(admin, [
      { kind: 'family', fullName: 'Yara Hollow', email: at('yara'), membershipExpiry: '2027-06-17', children: ['Zeb Hollow', ' zeb HOLLOW', 'Ida Hollow'] },
      { kind: 'add', fullName: 'Remy Okafor', email: at('remy'), membershipExpiry: '2027-06-18' },
    ])
    const { lines, result } = await run(plan, auth, db)
    expect(result.exitCode).toBe(1)
    expect(lines).toContain('   REFUSE  entry 1: zeb HOLLOW is listed twice in children')
    expect(auth.calls.filter((call) => call.startsWith('create '))).toEqual([`create ${at('remy')} Remy Okafor`])
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE lower(email) = ?').bind(at('yara')).first<{ n: number }>())!.n).toBe(0)
    expect(insertsOf(db)).toHaveLength(1)
    expect((await auditRows(admin)).map((row) => row.action)).toEqual(['membership_override'])
    expect(lines).toContain(`Failed or refused: Yara Hollow <${at('yara')}>. Fix the cause and run the script again; whatever already holds is skipped.`)
  })

  it('a child already on the account and written twice makes no change to the account either', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const guardian = await seedMember({ fullName: 'Cleo Fernwood', email: `cleo.${tag}@example.org`, membershipStatus: 'none' })
    const dov = `child-dov-${tag}`
    await env.DB.prepare(`INSERT INTO members (id, email, full_name, membership_status, role, guardian_id) VALUES (?, ?, 'Dov Fernwood', 'none', 'member', ?)`).bind(dov, `cleo.${tag}@example.org`, guardian).run()
    const db = database()
    const { result } = await run(planOf(admin, [{ kind: 'family', memberId: guardian, fullName: 'Cleo Fernwood', email: `cleo.${tag}@example.org`, membershipExpiry: '2027-06-17', children: ['Dov Fernwood', 'dov fernwood'] }]), signInService(), db)
    expect(result.exitCode).toBe(1)
    expect(db.writes).toEqual([])
    expect(await member(guardian)).toMatchObject({ membership_status: 'none' })
    expect((await childrenOf(guardian)).map((k) => k.id)).toEqual([dov])
  })
})

describe('an email that differs from a row only by letter case', () => {
  it('add: the row found holds the person, no second account or row is made, and its stored email and name stay', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const stored = `lark.${tag}@example.org`
    const lark = await seedMember({ fullName: 'Ashdown, Lark', email: stored, membershipStatus: 'expired' })
    await setColumns(lark, { membership_expiry: '2026-03-31', membership_type: 'adult' })
    const auth = signInService([{ id: lark, email: stored, signedIn: true }])
    const db = database()
    const entryEmail = `  LARK.${tag.toUpperCase()}@Example.ORG `
    const { lines, result } = await run(planOf(admin, [{ kind: 'add', fullName: 'Lark Ashdown', email: entryEmail, membershipExpiry: '2027-06-18' }]), auth, db)
    expect(result.exitCode).toBe(0)
    expect(auth.calls).toEqual([])
    expect(insertsOf(db)).toEqual([])
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE lower(email) = ?').bind(stored).first<{ n: number }>())!.n).toBe(1)
    expect(await member(lark)).toMatchObject({ email: stored, full_name: 'Ashdown, Lark', membership_status: 'active', membership_expiry: '2027-06-18', membership_type: 'adult' })
    expect(lines.at(-1)).toBe('No new sign-in accounts.')
  })

  it('family: the guardian found by an email in other capitals keeps its id, and the children join it', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const gwen = await seedMember({ fullName: 'Gwen Hollow', email: `Gwen.${tag}@Example.org`, membershipStatus: 'none' })
    const auth = signInService([{ id: gwen, email: `gwen.${tag}@example.org`, signedIn: true }])
    const { result } = await run(planOf(admin, [{ kind: 'family', fullName: 'Gwen Hollow', email: `GWEN.${tag}@EXAMPLE.ORG`, membershipExpiry: '2027-06-17', children: ['Hal Hollow'] }]), auth, database())
    expect(result.exitCode).toBe(0)
    expect(auth.calls).toEqual([])
    expect(await member(gwen)).toMatchObject({ email: `Gwen.${tag}@Example.org`, membership_status: 'active', membership_type: 'family' })
    expect((await childrenOf(gwen)).map((k) => [k.full_name, k.email, ...membership(k)])).toEqual([['Hal Hollow', `Gwen.${tag}@Example.org`, 'active', '2027-06-17', 'family']])
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE lower(email) = ? AND id NOT LIKE 'child-%'").bind(`gwen.${tag}@example.org`).first<{ n: number }>())!.n).toBe(1)
  })

  it('update: a row that already holds the email in other capitals is left alone, on the sign-in account too', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const kit = await seedMember({ fullName: 'Kit Quillfeather', email: `Kit.${tag}@Example.org` })
    const auth = signInService([{ id: kit, email: `kit.${tag}@example.org`, signedIn: true }])
    const db = database()
    const { lines, result } = await run(planOf(admin, [{ kind: 'update', memberId: kit, email: `kit.${tag}@example.org` }]), auth, db)
    expect(result.exitCode).toBe(0)
    expect(db.writes).toEqual([])
    expect(auth.calls).toEqual([])
    expect(lines).toContain(`   SKIP    email is already kit.${tag}@example.org`)
    expect((await member(kit)).email).toBe(`Kit.${tag}@Example.org`)
  })
})

describe('an update whose sign-in account already carries the new email', () => {
  it('in other capitals: only the row changes, to the lower-cased email, and the account is not touched', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const kit = await seedMember({ fullName: 'Kit Quillfeather', email: `kit.${tag}@lca.invalid` })
    const auth = signInService([{ id: kit, email: `Kit.${tag}@Example.org`, signedIn: true }])
    const db = database()
    const { result } = await run(planOf(admin, [{ kind: 'update', memberId: kit, email: `kit.${tag}@example.org`, membershipExpiry: '2027-06-18', membershipStatus: 'active' }]), auth, db)
    expect(result.exitCode).toBe(0)
    expect(auth.calls.filter((call) => !call.startsWith('find '))).toEqual([])
    expect(auth.accounts.get(`kit.${tag}@example.org`)).toMatchObject({ id: kit, email: `Kit.${tag}@Example.org` })
    expect(await member(kit)).toMatchObject({ email: `kit.${tag}@example.org`, membership_status: 'active', membership_expiry: '2027-06-18' })
  })

  it('a second run changes nothing', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const kit = await seedMember({ fullName: 'Kit Quillfeather', email: `kit.${tag}@lca.invalid` })
    const auth = signInService([{ id: kit, email: `kit.${tag}@example.org`, signedIn: true }])
    const plan = planOf(admin, [{ kind: 'update', memberId: kit, email: `kit.${tag}@example.org` }])
    const db = database()
    await run(plan, auth, db)
    const before = db.writes.length
    const again = await run(plan, auth, db)
    expect(again.result.exitCode).toBe(0)
    expect(db.writes.length).toBe(before)
  })
})

describe('a sign-in email that is taken', () => {
  it('add: the account is made, reported taken, looked up, and its id becomes the member id', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const account = crypto.randomUUID()
    const auth = signInService([{ id: account, email: `Ada.${tag}@Example.org`, signedIn: false }])
    const { lines, result } = await run(planOf(admin, [{ kind: 'add', fullName: 'Ada Larkspur', email: `ada.${tag}@example.org`, membershipExpiry: '2027-06-18' }]), auth, database())
    expect(result.exitCode).toBe(0)
    expect(auth.calls).toEqual([`create ada.${tag}@example.org Ada Larkspur`, `find ada.${tag}@example.org`])
    expect(await member(account)).toMatchObject({ email: `ada.${tag}@example.org`, full_name: 'Ada Larkspur', membership_status: 'active' })
    expect(lines).toContain(`   CREATE  sign-in account for ada.${tag}@example.org (one already used this email, so its id ${account} is used)`)
    // They have never signed in, so they are on the list of people to tell.
    expect(lines.at(-1)).toContain(`Ada Larkspur <ada.${tag}@example.org>`)
  })

  it('family: the guardian row and the children use that id', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const account = crypto.randomUUID()
    const auth = signInService([{ id: account, email: `ivo.${tag}@example.org`, signedIn: true }])
    const { lines, result } = await run(planOf(admin, [{ kind: 'family', fullName: 'Ivo Brambleton', email: `ivo.${tag}@example.org`, membershipExpiry: '2027-07-26', children: ['Juno Brambleton'] }]), auth, database())
    expect(result.exitCode).toBe(0)
    expect(await member(account)).toMatchObject({ full_name: 'Ivo Brambleton', membership_type: 'family' })
    expect((await childrenOf(account)).map((k) => k.full_name)).toEqual(['Juno Brambleton'])
    expect(lines.at(-1)).toBe('No new sign-in accounts.')
  })

  it('reported taken but not found: that person fails, nothing is written for them, the next goes ahead', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const auth = signInService()
    const create = auth.createUser
    auth.createUser = async (user) => (user.email.startsWith('ada.') ? (auth.calls.push(`create ${user.email}`), { duplicate: true as const }) : create(user))
    auth.findUserByEmail = async (email) => (auth.calls.push(`find ${email}`), null)
    const db = database()
    const { lines, result } = await run(planOf(admin, [
      { kind: 'add', fullName: 'Ada Larkspur', email: `ada.${tag}@example.org`, membershipExpiry: '2027-06-18' },
      { kind: 'add', fullName: 'Remy Okafor', email: `remy.${tag}@example.org`, membershipExpiry: '2027-06-18' },
    ]), auth, db)
    expect(result.exitCode).toBe(1)
    expect(lines).toContain(`   FAIL    sign-in account for ada.${tag}@example.org: the sign-in service says this email is taken, but no account with it can be found`)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE lower(email) = ?').bind(`ada.${tag}@example.org`).first<{ n: number }>())!.n).toBe(0)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE lower(email) = ?').bind(`remy.${tag}@example.org`).first<{ n: number }>())!.n).toBe(1)
    expect(lines.at(-1)).not.toContain('Ada Larkspur')
  })

  it('taken by an account whose id already has a member row under another email: stops, writes nothing for that person', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const other = await seedMember({ fullName: 'Someone Else', email: `someone.${tag}@example.org` })
    const auth = signInService([{ id: other, email: `ada.${tag}@example.org`, signedIn: true }])
    const db = database()
    const { lines, result } = await run(planOf(admin, [{ kind: 'add', fullName: 'Ada Larkspur', email: `ada.${tag}@example.org`, membershipExpiry: '2027-06-18' }]), auth, db)
    expect(result.exitCode).toBe(1)
    expect(lines.some((l) => l.startsWith('   FAIL') && l.includes(`the sign-in account ${other} already has a member row, which holds someone.${tag}@example.org`))).toBe(true)
    expect(db.writes).toEqual([])
  })
})

describe('guardian and linked-child expiries that differ from the plan', () => {
  it('the guardian\'s own later expiry is replaced by the plan\'s, with a warning; a child\'s own later expiry is kept', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const at = `gil.${tag}@example.org`
    const admin = await seedAdmin()
    const gil = await seedMember({ fullName: 'Gil Longterm', email: at, membershipStatus: 'active' })
    await setColumns(gil, { membership_expiry: '2028-12-31', membership_type: 'family' })
    const kid = async (id: string, name: string, expiry: string, created: string) => {
      await env.DB.prepare(`INSERT INTO members (id, email, full_name, membership_status, membership_expiry, membership_type, role, guardian_id, created_at) VALUES (?, ?, ?, 'active', ?, 'family', 'member', ?, ?)`).bind(id, at, name, expiry, gil, created).run()
    }
    await kid(`child-a-${tag}`, 'Ana Longterm', '2028-06-01', '2025-03-01 12:00:00')
    await kid(`child-b-${tag}`, 'Bea Longterm', '2027-01-01', '2025-03-02 12:00:00')
    const auth = signInService([{ id: gil, email: at, signedIn: true }])
    const { lines, result } = await run(planOf(admin, [{ kind: 'family', fullName: 'Gil Longterm', email: at, membershipExpiry: '2027-06-17', children: ['Ana Longterm', 'Bea Longterm', 'Cy Longterm'] }]), auth, database())
    expect(result.exitCode).toBe(0)
    // The script writes the plan's date, even though the row held a later one.
    expect(await member(gil)).toMatchObject({ membership_status: 'active', membership_expiry: '2027-06-17', membership_type: 'family' })
    expect(lines).toContain('           warning: this ends the membership earlier than the date it holds now, Sun, Dec 31, 2028')
    expect((await childrenOf(gil)).map((k) => [k.full_name, ...membership(k)])).toEqual([
      ['Ana Longterm', 'active', '2028-06-01', 'family'],
      ['Bea Longterm', 'active', '2027-06-17', 'family'],
      ['Cy Longterm', 'active', '2027-06-17', 'family'],
    ])
    const audit = await auditRows(admin)
    const guardianAudit = audit.find((row) => row.target_member_id === gil && row.action === 'membership_override')!
    expect(JSON.parse(guardianAudit.detail)).toMatchObject({ from: { expiry: '2028-12-31' }, to: { expiry: '2027-06-17' } })
    // Ana already held the date she should: no audit row for her.
    expect(audit.some((row) => row.target_label.startsWith('Ana Longterm'))).toBe(false)
  })

  it('a linked child keeps a later expiry (even on an expired row), is raised from an earlier one, and the type becomes family', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const at = (name: string) => `${name}.${tag}@example.org`
    const admin = await seedAdmin()
    const link = async (name: string, status: string, expiry: string | null, type: string | null, created: string) => {
      const id = await seedMember({ fullName: name, email: at(name.split(',')[0].toLowerCase()), membershipStatus: status })
      await setColumns(id, { membership_expiry: expiry, membership_type: type, created_at: created })
      return id
    }
    const earlier = await link('Earlier, Ada', 'active', '2026-12-31', 'scholastic', '2025-01-01 12:00:00')
    const later = await link('Later, Bo', 'expired', '2028-05-01', 'adult', '2025-01-02 12:00:00')
    const never = await link('Never, Cy', 'none', null, null, '2025-01-03 12:00:00')
    const { lines, result } = await run(planOf(admin, [{
      kind: 'family',
      fullName: 'Gwen Hollow',
      email: at('gwen'),
      membershipExpiry: '2027-06-17',
      children: ['Ada Earlier', 'Bo Later', 'Cy Never'],
      linkExisting: [
        { memberId: earlier, fullName: 'Ada Earlier' },
        { memberId: later, fullName: 'Bo Later' },
        { memberId: never, fullName: 'Cy Never' },
      ],
    }]), signInService(), database())
    expect(result.exitCode).toBe(0)
    const gwen = (await env.DB.prepare('SELECT id FROM members WHERE email = ? AND id NOT LIKE ?').bind(at('gwen'), 'child-%').first<{ id: string }>())!.id
    expect(await member(earlier)).toMatchObject({ guardian_id: gwen, membership_status: 'active', membership_expiry: '2027-06-17', membership_type: 'family' })
    expect(await member(later)).toMatchObject({ guardian_id: gwen, membership_status: 'active', membership_expiry: '2028-05-01', membership_type: 'family' })
    expect(await member(never)).toMatchObject({ guardian_id: gwen, membership_status: 'active', membership_expiry: '2027-06-17', membership_type: 'family' })
    const audit = await auditRows(admin)
    const detail = (id: string) => JSON.parse(audit.find((row) => row.target_member_id === id && row.action === 'membership_override')!.detail)
    expect(detail(later)).toMatchObject({ from: { status: 'expired', expiry: '2028-05-01', type: 'adult' }, to: { status: 'active', expiry: '2028-05-01', type: 'family' } })
    // Each link is logged, since the guardian can now act for that account.
    expect(audit.filter((row) => row.action === 'guardian_link').map((row) => [row.target_member_id, JSON.parse(row.detail)])).toEqual([
      [earlier, { guardianId: gwen, reason: SOURCE }],
      [later, { guardianId: gwen, reason: SOURCE }],
      [never, { guardianId: gwen, reason: SOURCE }],
    ])
    expect(lines).toContain(`   COVER   family coverage for Later, Bo: family, active to Mon, May 1, 2028 (was adult, expired Mon, May 1, 2028)`)
  })
})

describe('a database that fails part way through a family', () => {
  const family = (tag: string) => ({
    kind: 'family',
    fullName: 'Yara Hollow',
    email: `yara.${tag}@example.org`,
    membershipExpiry: '2027-06-17',
    children: ['Ana Hollow', 'Bea Hollow', 'Cy Hollow'],
  })

  it('keeps the earlier writes, reports the person as failed, runs the next entry, and a second run finishes the rest', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const yara = `yara.${tag}@example.org`
    const remy = `remy.${tag}@example.org`
    const admin = await seedAdmin()
    const auth = signInService()
    const plan = planOf(admin, [family(tag), { kind: 'add', fullName: 'Remy Okafor', email: remy, membershipExpiry: '2027-06-18' }])
    const raw = database()
    const armed = { on: true }
    const db = flaky(raw, armed, (sql, params) => isChildInsert(sql, params, 'Bea Hollow'))

    const first = await run(plan, auth, db)
    expect(first.result.exitCode).toBe(1)
    expect(first.result.failedPeople).toEqual([`Yara Hollow <${yara}>`])
    expect(first.lines).toContain('   FAIL    child profile Bea Hollow: the database did not answer')
    expect(first.lines).toContain('Summary: created 3, linked 0, updated 0, skipped 0, failed 1.')
    // What was done stays: the account, the guardian row, Ana. Bea and Cy were never made.
    const guardian = auth.accounts.get(yara)!
    expect(await member(guardian.id)).toMatchObject({ email: yara, membership_status: 'active', membership_expiry: '2027-06-17', membership_type: 'family' })
    expect((await childrenOf(guardian.id)).map((k) => [k.full_name, k.membership_status])).toEqual([['Ana Hollow', 'none']])
    // The next entry ran.
    expect(membership(await member(auth.accounts.get(remy)!.id))).toEqual(['active', '2027-06-18', 'adult'])
    // Making Ana's profile logs nothing; her cover never came.
    expect((await auditRows(admin)).map((row) => [row.action, row.target_label.split(' <')[0]])).toEqual([
      ['membership_override', 'Yara Hollow'],
      ['membership_override', 'Remy Okafor'],
    ])
    // Both are on the one list of people to tell. Yara's account was made but
    // her entry did not finish, so her name carries a note saying what failed.
    const yaraNamed = `Yara Hollow <${yara}> (account made; the rest failed: the database did not answer)`
    expect(first.lines.slice(-2)).toEqual([
      `New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): ${yaraNamed}; Remy Okafor <${remy}>.`,
      'Keep this list: the run that finishes an entry marked "the rest failed" or "refused" may say only that the person has a sign-in account already, without naming them here again.',
    ])
    expect(first.result.newSignIns).toEqual([yaraNamed, `Remy Okafor <${remy}>`])

    // The cause is mended and the script is run again from fresh reads.
    armed.on = false
    const writesBefore = raw.writes.length
    const createsBefore = auth.calls.filter((call) => call.startsWith('create ')).length
    const second = await run(plan, auth, db)
    expect(second.result.exitCode).toBe(0)
    expect(auth.calls.filter((call) => call.startsWith('create ')).length).toBe(createsBefore)
    expect(auth.accounts.size).toBe(2)
    const rerun = raw.writes.slice(writesBefore)
    // Only Bea and Cy are inserted; nothing is made again for Yara, Ana or Remy.
    expect(rerun.filter((sql) => sql.startsWith('INSERT INTO members'))).toHaveLength(2)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE lower(email) = ? AND id NOT LIKE ?').bind(yara, 'child-%').first<{ n: number }>())!.n).toBe(1)
    const kids = await childrenOf(guardian.id)
    expect(kids.map((k) => [k.full_name, k.email, ...membership(k)])).toEqual([
      ['Ana Hollow', yara, 'active', '2027-06-17', 'family'],
      ['Bea Hollow', yara, 'active', '2027-06-17', 'family'],
      ['Cy Hollow', yara, 'active', '2027-06-17', 'family'],
    ])
    expect(new Set(kids.map((k) => k.id)).size).toBe(3)
    // Yara and Remy once each from the first run, then the three covers: nothing twice.
    expect((await auditRows(admin)).map((row) => [row.action, row.target_label.split(' <')[0]])).toEqual([
      ['membership_override', 'Yara Hollow'],
      ['membership_override', 'Remy Okafor'],
      ['membership_override', 'Ana Hollow'],
      ['membership_override', 'Bea Hollow'],
      ['membership_override', 'Cy Hollow'],
    ])
    expect(second.lines).toContain('   SKIP    child Ana Hollow is already on this account')
    // This run finds Yara's row by her email and makes no account. It cannot
    // tell an account the first run made from an older one nobody has signed
    // in to, so it does not name her again, and says instead that she has an
    // account: that line and the first run's list match up.
    expect(second.lines).toContain(`   SKIP    ${yara} has a sign-in account already (the member row ${guardian.id}), so none is made`)
    expect(second.lines.at(-1)).toBe('No new sign-in accounts.')
    expect(second.result.newSignIns).toEqual([])

    // And a third run has nothing to do.
    const after = raw.writes.length
    const third = await run(plan, auth, db)
    expect(third.result.exitCode).toBe(0)
    expect(raw.writes.length).toBe(after)
  })

  it('a failure on the guardian\'s row, after the sign-in account was made: the second run finds that account and finishes', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const yara = `yara.${tag}@example.org`
    const admin = await seedAdmin()
    const auth = signInService()
    const plan = planOf(admin, [family(tag), { kind: 'add', fullName: 'Remy Okafor', email: `remy.${tag}@example.org`, membershipExpiry: '2027-06-18' }])
    const raw = database()
    const armed = { on: true }
    const db = flaky(raw, armed, (sql, params) => isMemberInsert(sql, yara, params))

    const first = await run(plan, auth, db)
    expect(first.result.exitCode).toBe(1)
    expect(first.lines).toContain(`   FAIL    member row for Yara Hollow <${yara}>: family, active to Thu, Jun 17, 2027: the database did not answer`)
    expect(first.lines.some((l) => l.includes('child profile'))).toBe(false)
    const account = auth.accounts.get(yara)!
    expect(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(account.id).first()).toBeNull()
    expect(membership(await member(auth.accounts.get(`remy.${tag}@example.org`)!.id))).toEqual(['active', '2027-06-18', 'adult'])
    // Her account was made, so she is named already, with a note that the rest of her entry failed.
    const yaraNamed = `Yara Hollow <${yara}> (account made; the rest failed: the database did not answer)`
    expect(first.result.newSignIns).toEqual([yaraNamed, `Remy Okafor <remy.${tag}@example.org>`])
    expect(first.lines.at(-2)).toBe(
      `New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): ${yaraNamed}; Remy Okafor <remy.${tag}@example.org>.`,
    )

    armed.on = false
    const second = await run(plan, auth, db)
    expect(second.result.exitCode).toBe(0)
    expect(auth.accounts.size).toBe(2) // no second account for Yara
    expect(auth.calls.filter((call) => call === `find ${yara}`).length).toBeGreaterThan(0)
    expect(await member(account.id)).toMatchObject({ email: yara, membership_type: 'family', membership_status: 'active' })
    expect((await childrenOf(account.id)).map((k) => [k.full_name, k.membership_status])).toEqual([['Ana Hollow', 'active'], ['Bea Hollow', 'active'], ['Cy Hollow', 'active']])
    // The account had never been used, so the run that finishes her entry names her as well.
    expect(second.lines.at(-1)).toBe(`New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): Yara Hollow <${yara}>.`)
  })

  it('a failure while covering the children leaves the covers already made, and a second run makes the rest only', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const at = `gil.${tag}@example.org`
    const admin = await seedAdmin()
    const gil = await seedMember({ fullName: 'Gil Longterm', email: at, membershipStatus: 'active' })
    await setColumns(gil, { membership_expiry: '2027-06-17', membership_type: 'family' })
    const ids = [`child-a-${tag}`, `child-b-${tag}`, `child-c-${tag}`]
    for (const [i, id] of ids.entries()) {
      await env.DB.prepare(`INSERT INTO members (id, email, full_name, membership_status, role, guardian_id, created_at) VALUES (?, ?, ?, 'none', 'member', ?, ?)`).bind(id, at, `Kid ${i} Longterm`, gil, `2025-03-0${i + 1} 12:00:00`).run()
    }
    const plan = planOf(admin, [{ kind: 'family', fullName: 'Gil Longterm', email: at, membershipExpiry: '2027-06-17', children: ['Kid 0 Longterm', 'Kid 1 Longterm', 'Kid 2 Longterm'] }])
    const raw = database()
    const armed = { on: true }
    const db = flaky(raw, armed, (sql, params) => isCover(sql, params, ids[1]))

    const first = await run(plan, signInService([{ id: gil, email: at, signedIn: true }]), db)
    expect(first.result.exitCode).toBe(1)
    expect((await childrenOf(gil)).map((k) => k.membership_status)).toEqual(['active', 'none', 'none'])
    expect((await auditRows(admin)).map((row) => row.action)).toEqual(['membership_override'])

    armed.on = false
    const before = raw.writes.length
    const second = await run(plan, signInService([{ id: gil, email: at, signedIn: true }]), db)
    expect(second.result.exitCode).toBe(0)
    expect(raw.writes.slice(before).map((sql) => sql.split(' ').slice(0, 3).join(' '))).toEqual([
      'UPDATE members SET',
      'INSERT INTO admin_audit_log',
      'UPDATE members SET',
      'INSERT INTO admin_audit_log',
    ])
    expect((await childrenOf(gil)).map((k) => k.membership_status)).toEqual(['active', 'active', 'active'])
    expect(await auditRows(admin)).toHaveLength(3)
  })

  it('an audit row that fails twice: the change stays, the run hands back the row and a statement, and the next run writes exactly that row and nothing else', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const lark = `lark.${tag}@example.org`
    const admin = await seedAdmin()
    // Apostrophes in the name and the source, so the statement's quoting is tried too.
    const id = await seedMember({ fullName: "O'Shea, Lark", email: lark, membershipStatus: 'expired' })
    await setColumns(id, { membership_expiry: '2026-03-31', membership_type: 'adult' })
    const source = "Payments at the club's table, entered by hand"
    const plan = {
      ...planOf(admin, [
        { kind: 'update', memberId: id, membershipExpiry: '2027-06-19', membershipStatus: 'active', note: 'paid at the club table' },
        { kind: 'add', fullName: 'Remy Okafor', email: `remy.${tag}@example.org`, membershipExpiry: '2027-06-18' },
      ]),
      source,
    }
    const auth = signInService()
    const raw = database()
    const armed = { on: true }
    // Lark's audit row fails on both tries; Remy's is written.
    const db = flaky(raw, armed, (sql, params) => /INTO admin_audit_log/.test(sql) && params.includes(id), 'the audit table did not answer')
    const larkAudit = async () =>
      (await env.DB.prepare('SELECT action, actor_id, actor_email, target_member_id, target_label, detail, created_at FROM admin_audit_log WHERE target_member_id = ?')
        .bind(id)
        .all<AuditRow & { created_at: string }>()).results ?? []

    const first = await run(plan, auth, db)
    expect(first.result.exitCode).toBe(1)
    const fail = first.lines.findIndex((l) => l.startsWith('   FAIL'))
    expect(first.lines[fail]).toBe(
      "   FAIL    membership of O'Shea, Lark: adult, active to Sat, Jun 19, 2027 (was adult, expired Tue, Mar 31, 2026): " +
        'the change was made, but its audit log row was not written (the audit table did not answer); ' +
        'the next run with --apply writes it, or insert it by hand with the statement below',
    )
    // The row, under the FAIL line, as a statement to run by hand.
    const [statement] = first.result.missingAudit
    expect(first.lines[fail + 1]).toBe(`           ${statement}`)
    expect(statement).toMatch(
      /^INSERT OR IGNORE INTO admin_audit_log \(id, actor_id, actor_email, action, target_member_id, target_label, detail, created_at\) VALUES \('aud-[0-9a-z]+-[0-9a-z]+', /,
    )
    expect(statement).toContain(`'O''Shea, Lark <${lark}>'`)
    expect(statement).toContain("club''s table")
    expect(first.lines).toContain(
      'Audit log rows not written: 1. Their changes are in place; the next run with --apply writes these rows, ' +
        'or insert each one by hand with the statement printed under its FAIL line. Running a statement twice adds nothing.',
    )
    // The change stays; its audit row is missing; the next person went ahead.
    expect(await member(id)).toMatchObject({ membership_status: 'active', membership_expiry: '2027-06-19' })
    expect(await larkAudit()).toEqual([])
    expect((await auditRows(admin)).map((row) => row.target_label.split(' <')[0])).toEqual(['Remy Okafor'])
    // The same row comes back as data, which the command line keeps beside the plan for the next run.
    const kept = first.result.missingAuditRows
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({ actorId: admin, actorEmail: `${admin}@test.lca`, action: 'membership_override', targetId: id, targetLabel: `O'Shea, Lark <${lark}>` })

    // The next run, with the cause mended and the kept row: the change is a skip, and the one write is that row.
    armed.on = false
    const writesBefore = raw.writes.length
    const lines: string[] = []
    const second = await execute(buildPlan(plan, await loadSnapshot(db, plan, { missingAudit: kept }), TODAY), { auth, d1: db, apply: true, log: (l: string) => lines.push(l) })
    expect(second.exitCode).toBe(0)
    expect(raw.writes.slice(writesBefore)).toEqual([
      'INSERT OR IGNORE INTO admin_audit_log (id, actor_id, actor_email, action, target_member_id, target_label, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ])
    expect(lines).toContain("   SKIP    membership of O'Shea, Lark is already adult, active to Sat, Jun 19, 2027")
    expect(lines.filter((l) => l.startsWith('   AUDIT'))).toEqual([
      expect.stringMatching(
        new RegExp(`^   AUDIT   membership of O'Shea, Lark <${lark.replace(/\./g, '\\.')}>: adult, active to Sat, Jun 19, 2027 \\(was adult, expired Tue, Mar 31, 2026\\); the change was made (Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \\d{1,2}, \\d{4}$`),
      ),
    ])
    expect(lines).toContain('Summary: created 0, linked 0, updated 0, skipped 3, failed 0, audit log rows written 1.')
    expect(second.missingAuditRows).toEqual([])

    // It is the row the site would have written, under the id the first run gave it and dated when the change was made.
    const rows = await larkAudit()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'membership_override', actor_id: admin, actor_email: `${admin}@test.lca`, target_member_id: id, target_label: `O'Shea, Lark <${lark}>` })
    expect(JSON.parse(rows[0].detail)).toEqual({
      from: { status: 'expired', expiry: '2026-03-31', type: 'adult' },
      to: { status: 'active', expiry: '2027-06-19', type: 'adult' },
      reason: source,
    })
    expect(await env.DB.prepare('SELECT id, created_at FROM admin_audit_log WHERE target_member_id = ?').bind(id).first()).toEqual({ id: kept[0].id, created_at: kept[0].madeAt })
    expect(statement.endsWith(`'${rows[0].created_at}');`)).toBe(true)

    // Run by hand as well, the statement adds nothing; given the kept row again, a run finds it and plans no write.
    await env.DB.prepare(statement).run()
    expect(await larkAudit()).toHaveLength(1)
    const again = buildPlan(plan, await loadSnapshot(db, plan, { missingAudit: kept }), TODAY)
    expect(again.map((g: { kind: string }) => g.kind)).toEqual(['update', 'add'])
    const third = await run(plan, auth, db)
    expect(third.result.exitCode).toBe(0)
    expect(raw.writes.length).toBe(writesBefore + 1)
  })

  it('an audit row whose first try fails is written by the second, once', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const lark = await seedMember({ fullName: 'Ashdown, Lark', email: `lark.${tag}@example.org`, membershipStatus: 'expired' })
    await setColumns(lark, { membership_expiry: '2026-03-31', membership_type: 'adult' })
    const raw = database()
    const armed = { on: true }
    const db = flaky(raw, armed, (sql) => {
      if (!/INTO admin_audit_log/.test(sql)) return false
      armed.on = false // the first try only
      return true
    })
    const { lines, result } = await run(planOf(admin, [{ kind: 'update', memberId: lark, membershipExpiry: '2027-06-19', membershipStatus: 'active' }]), signInService(), db)
    expect(result.exitCode).toBe(0)
    expect(lines.some((l) => l.startsWith('   FAIL'))).toBe(false)
    expect(raw.writes.map((sql) => sql.split(' ').slice(0, 3).join(' '))).toEqual(['UPDATE members SET', 'INSERT OR IGNORE'])
    expect((await auditRows(admin)).map((row) => [row.action, row.target_member_id])).toEqual([['membership_override', lark]])
  })

  it('an audit row written before its answer was lost is found by its id, and not written twice', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const lark = await seedMember({ fullName: 'Ashdown, Lark', email: `lark.${tag}@example.org`, membershipStatus: 'expired' })
    await setColumns(lark, { membership_expiry: '2026-03-31', membership_type: 'adult' })
    const raw = database()
    const db = lossy(raw, (sql) => /^INSERT INTO admin_audit_log/.test(sql))
    const { lines, result } = await run(planOf(admin, [{ kind: 'update', memberId: lark, membershipExpiry: '2027-06-19', membershipStatus: 'active' }]), signInService(), db)
    expect(result.exitCode).toBe(0)
    expect(lines.some((l) => l.startsWith('   FAIL'))).toBe(false)
    // The second try ran and changed nothing: the row was there under its id.
    expect(raw.writes.map((sql) => sql.split(' ').slice(0, 3).join(' '))).toEqual(['UPDATE members SET', 'INSERT INTO admin_audit_log', 'INSERT OR IGNORE'])
    expect(await auditRows(admin)).toHaveLength(1)
  })
})

// ── A family taking over a row that holds a child's US Chess ID or entries, ──
// ── and an unused sign-in account given a real email ──────────────────────

describe('a family that takes over a row under another name', () => {
  /** An eight digit US Chess ID no other test uses. */
  const freshUscfId = () => String(10_000_000 + Math.floor(Math.random() * 89_999_999))
  const hint = "add \"renameKeepsEntries\": true to the entry only if this row is Rowan Marsh's own under another spelling, and otherwise settle it by hand"

  /** The row a parent's email holds, made when their child was signed up under it. */
  async function childsRow(email: string, uscfId: string | null = null) {
    const id = await seedMember({ fullName: 'Marsh, Luca', email, uscfId })
    await setColumns(id, { membership_expiry: '2027-02-28', membership_type: 'scholastic' })
    return id
  }

  const family = (email: string, extra: Record<string, unknown> = {}) => ({
    kind: 'family',
    fullName: 'Rowan Marsh',
    email,
    membershipExpiry: '2027-06-17',
    children: ['Luca Marsh'],
    ...extra,
  })

  it('refuses a row with a tournament entry: nothing is written for that person, and the next goes ahead', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const email = `rowan.${tag}@example.org`
    const admin = await seedAdmin()
    const luca = await childsRow(email)
    await seedRegistration({ tournamentId: await seedTournament(), memberId: luca })
    const auth = signInService([{ id: luca, email, signedIn: true }])
    const db = database()
    const { lines, result } = await run(planOf(admin, [
      family(email, { memberId: luca }),
      { kind: 'add', fullName: 'Remy Okafor', email: `remy.${tag}@example.org`, membershipExpiry: '2027-06-18' },
    ]), auth, db)
    expect(result.exitCode).toBe(1)
    expect(lines).toContain(`   REFUSE  the row ${luca} ("Marsh, Luca") holds 1 tournament entry, which would go under the name "Rowan Marsh"; ${hint}`)
    expect(await member(luca)).toMatchObject({ full_name: 'Marsh, Luca', membership_status: 'active', membership_expiry: '2027-02-28', membership_type: 'scholastic' })
    expect(await childrenOf(luca)).toEqual([])
    // Remy's row and its audit row are the only writes.
    expect(db.writes.map((sql) => sql.split(' ').slice(0, 3).join(' '))).toEqual(['INSERT INTO members', 'INSERT INTO admin_audit_log'])
    expect((await auditRows(admin)).map((row) => row.target_label.split(' <')[0])).toEqual(['Remy Okafor'])
  })

  it('refuses a row with a US Chess ID, found by its email, with nothing written', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const email = `rowan.${tag}@example.org`
    const uscfId = freshUscfId()
    const admin = await seedAdmin()
    const luca = await childsRow(email, uscfId)
    const auth = signInService([{ id: luca, email, signedIn: true }])
    const db = database()
    const { lines, result } = await run(planOf(admin, [family(email)]), auth, db)
    expect(result.exitCode).toBe(1)
    expect(lines).toContain(`   REFUSE  the row ${luca} ("Marsh, Luca") holds US Chess ID ${uscfId}, which would go under the name "Rowan Marsh"; ${hint}`)
    expect(db.writes).toEqual([])
    expect(auth.calls).toEqual([])
    expect(await member(luca)).toMatchObject({ full_name: 'Marsh, Luca', uscf_id: uscfId, membership_type: 'scholastic' })
    expect(await auditRows(admin)).toEqual([])
  })

  it('with "renameKeepsEntries": true, renames the row; its US Chess ID and entries stay on it', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const email = `rowan.${tag}@example.org`
    const uscfId = freshUscfId()
    const admin = await seedAdmin()
    const rowan = await childsRow(email, uscfId)
    await seedRegistration({ tournamentId: await seedTournament(), memberId: rowan })
    const auth = signInService([{ id: rowan, email, signedIn: true }])
    const { lines, result } = await run(planOf(admin, [family(email, { memberId: rowan, renameKeepsEntries: true })]), auth, database())
    expect(result.exitCode).toBe(0)
    expect(lines).toContain(`   RENAME  "Marsh, Luca" to "Rowan Marsh" (${rowan}); US Chess ID ${uscfId} and 1 tournament entry stay on the row (renameKeepsEntries)`)
    expect(await member(rowan)).toMatchObject({ full_name: 'Rowan Marsh', uscf_id: uscfId, membership_status: 'active', membership_expiry: '2027-06-17', membership_type: 'family' })
    const entries = await env.DB.prepare('SELECT COUNT(*) AS n FROM registrations WHERE member_id = ?').bind(rowan).first<{ n: number }>()
    expect(entries!.n).toBe(1)
    expect((await childrenOf(rowan)).map((k) => [k.full_name, k.uscf_id, ...membership(k)])).toEqual([['Luca Marsh', null, 'active', '2027-06-17', 'family']])
    const audit = await auditRows(admin)
    expect(JSON.parse(audit.find((row) => row.action === 'name_change')!.detail)).toEqual({ from: 'Marsh, Luca', to: 'Rowan Marsh', reason: SOURCE })
  })

  it('a row that gains an entry after the rows were read is refused by the real run, with nothing written', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const email = `rowan.${tag}@example.org`
    const admin = await seedAdmin()
    const luca = await childsRow(email)
    const auth = signInService([{ id: luca, email, signedIn: true }])
    const plan = planOf(admin, [family(email, { memberId: luca })])
    const db = database()
    const groups = buildPlan(plan, await loadSnapshot(db, plan), TODAY)
    expect(groups[0].ops[1]).toMatchObject({ type: 'rename', guard: true, keeps: false })

    // An entry arrives between the read and the run.
    await seedRegistration({ tournamentId: await seedTournament(), memberId: luca })
    const lines: string[] = []
    const result = await execute(groups, { auth, d1: db, apply: true, log: (line: string) => lines.push(line) })
    expect(result.exitCode).toBe(1)
    expect(lines).toContain(
      `   FAIL    "Marsh, Luca" to "Rowan Marsh" (${luca}); the row holds no US Chess ID and no tournament entries: nothing was written: ` +
        `the row ${luca} ("Marsh, Luca") now holds 1 tournament entry, which would go under the name "Rowan Marsh"; ${hint}`,
    )
    expect(db.writes).toEqual([])
    expect(await member(luca)).toMatchObject({ full_name: 'Marsh, Luca', membership_type: 'scholastic' })
    expect(await childrenOf(luca)).toEqual([])
    expect(await auditRows(admin)).toEqual([])
  })
})

describe('an update that gives an unused sign-in account a real email', () => {
  it('lists that person among the new sign-in accounts, in the dry run and the real run; a used account is not listed', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const placeholder = `wren.${tag}@lca.invalid`
    const real = `wren.${tag}@example.org`
    const wren = await seedMember({ fullName: 'Calloway, Wren', email: placeholder })
    await setColumns(wren, { membership_expiry: '2099-12-31', membership_type: 'adult' })
    const kit = await seedMember({ fullName: 'Kit Quillfeather', email: `kit.${tag}@lca.invalid` })
    const auth = signInService([
      // Made with a placeholder email and never signed in to.
      { id: wren, email: placeholder, signedIn: false },
      { id: kit, email: `kit.${tag}@lca.invalid`, signedIn: true },
    ])
    const plan = planOf(admin, [
      { kind: 'update', memberId: wren, fullName: 'Wren Calloway', email: real, membershipExpiry: '2027-06-18', membershipStatus: 'active' },
      { kind: 'update', memberId: kit, email: `kit.${tag}@example.org` },
    ])
    const db = database()

    const dry = await run(plan, auth, db, false)
    expect(db.writes).toEqual([])
    expect(dry.lines.at(-1)).toBe(`Sign-in accounts the real run would make: Wren Calloway <${real}> (unused sign-in account, new email).`)

    const { lines, result } = await run(plan, auth, db)
    expect(result.exitCode).toBe(0)
    expect(auth.accounts.get(real)).toMatchObject({ id: wren, signedIn: false })
    expect(await member(wren)).toMatchObject({ full_name: 'Wren Calloway', email: real, membership_status: 'active', membership_expiry: '2027-06-18' })
    expect(lines.at(-1)).toBe(
      `New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): Wren Calloway <${real}> (unused sign-in account, new email).`,
    )
    // Both email changes are in the audit log, old email and new.
    expect((await auditRows(admin)).filter((row) => row.action === 'email_change').map((row) => [row.target_label, JSON.parse(row.detail)])).toEqual([
      [`Calloway, Wren <${real}>`, { from: placeholder, to: real, reason: SOURCE }],
      [`Kit Quillfeather <kit.${tag}@example.org>`, { from: `kit.${tag}@lca.invalid`, to: `kit.${tag}@example.org`, reason: SOURCE }],
    ])

    // Once made, the change is a skip, and nobody is listed again.
    const again = await run(plan, auth, db)
    expect(again.result.exitCode).toBe(0)
    expect(again.lines.at(-1)).toBe('No new sign-in accounts.')
  })

  it('names the person when the entry stops after the account took the new email, and the run that finishes it names them again', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const placeholder = `wren.${tag}@lca.invalid`
    const real = `wren.${tag}@example.org`
    const wren = await seedMember({ fullName: 'Calloway, Wren', email: placeholder })
    await setColumns(wren, { membership_expiry: '2099-12-31', membership_type: 'adult' })
    const auth = signInService([{ id: wren, email: placeholder, signedIn: false }])
    const plan = planOf(admin, [{ kind: 'update', memberId: wren, fullName: 'Wren Calloway', email: real, membershipExpiry: '2027-06-18', membershipStatus: 'active' }])
    const raw = database()
    const armed = { on: true }
    const db = flaky(raw, armed, (sql) => /^UPDATE members SET email/.test(sql))
    const named = `Wren Calloway <${real}> (unused sign-in account, new email)`

    const first = await run(plan, auth, db)
    expect(first.result.exitCode).toBe(1)
    // The sign-in account has the real email; the row still has the placeholder.
    expect(auth.accounts.get(real)).toMatchObject({ id: wren, signedIn: false })
    expect(await member(wren)).toMatchObject({ email: placeholder, full_name: 'Calloway, Wren', membership_expiry: '2099-12-31' })
    expect(first.lines).toContain(`   FAIL    ${placeholder} to ${real} (${wren}), on the sign-in account first and then on the row: the database did not answer`)
    const unfinished = `${named.slice(0, -1)}; the rest failed: the database did not answer)`
    expect(first.result.newSignIns).toEqual([unfinished])
    expect(first.lines.slice(-2)).toEqual([
      `New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): ${unfinished}.`,
      'Keep this list: the run that finishes an entry marked "the rest failed" or "refused" may say only that the person has a sign-in account already, without naming them here again.',
    ])

    // With the cause mended, the dry run finds the account already holding the email, never used, and names her.
    armed.on = false
    const dry = await run(plan, auth, db, false)
    expect(dry.lines).toContain(`   EMAIL   ${placeholder} to ${real} (${wren}); the sign-in account already uses it, so only the row changes`)
    expect(dry.lines.at(-1)).toBe(`Sign-in accounts the real run would make: ${named}.`)

    const second = await run(plan, auth, db)
    expect(second.result.exitCode).toBe(0)
    expect(auth.calls.filter((call) => call.startsWith('email '))).toEqual([`email ${wren} ${real}`]) // the account is not changed again
    expect(await member(wren)).toMatchObject({ full_name: 'Wren Calloway', email: real, membership_status: 'active', membership_expiry: '2027-06-18' })
    expect(second.lines).toContain(`   EMAIL   ${placeholder} to ${real} (${wren}); the sign-in account already used it, so only the row changed`)
    expect(second.lines.at(-1)).toBe(`New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): ${named}.`)
  })
})

// ── An update's expiry without a status, and a guardian that has ─────
// ── become a child between the read and the run ──────────────────────

describe('an update that names an expiry and no status', () => {
  it('makes the membership active from a date today or later and expired from one before, as the admin membership endpoint does', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const admin = await seedAdmin()
    const lark = await seedMember({ fullName: 'Ashdown, Lark', email: `lark.${tag}@example.org`, membershipStatus: 'expired' })
    await setColumns(lark, { membership_expiry: '2026-03-31', membership_type: 'adult' })
    const kit = await seedMember({ fullName: 'Kit Quillfeather', email: `kit.${tag}@example.org`, membershipStatus: 'active' })
    await setColumns(kit, { membership_expiry: '2099-12-31', membership_type: 'adult' })
    const { lines, result } = await run(
      planOf(admin, [
        { kind: 'update', memberId: lark, membershipExpiry: '2027-06-19' },
        { kind: 'update', memberId: kit, membershipExpiry: '2026-11-02' },
      ]),
      signInService(),
      database(),
    )
    expect(result.exitCode).toBe(0)
    expect(membership(await member(lark))).toEqual(['active', '2027-06-19', 'adult'])
    expect(membership(await member(kit))).toEqual(['expired', '2026-11-02', 'adult'])
    expect(lines).toContain('   UPDATE  membership of Ashdown, Lark: adult, active to Sat, Jun 19, 2027 (was adult, expired Tue, Mar 31, 2026)')
    expect(lines).toContain('   UPDATE  membership of Kit Quillfeather: adult, expired Mon, Nov 2, 2026 (was adult, active to Thu, Dec 31, 2099)')
    expect((await auditRows(admin)).map((row) => [row.target_member_id, JSON.parse(row.detail).to])).toEqual([
      [lark, { status: 'active', expiry: '2027-06-19', type: 'adult' }],
      [kit, { status: 'expired', expiry: '2026-11-02', type: 'adult' }],
    ])
  })
})

describe('a guardian that has become a child by the time of the run', () => {
  it('is refused a new child profile and a link, as /api/me/children refuses a child, and nothing is written for them', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const email = `gia.${tag}@example.org`
    const admin = await seedAdmin()
    const other = await seedMember({ fullName: 'Otto Otherway' })
    // Gia's row already holds what the entry asks, so the first write would be the child's.
    const gia = await seedMember({ fullName: 'Gia Fernwood', email, membershipStatus: 'active' })
    await setColumns(gia, { membership_expiry: '2027-06-17', membership_type: 'family' })
    const esme = await seedMember({ fullName: 'Fernwood, Esme', email: `esme.${tag}@example.org` })
    const family = (children: string[], extra: Record<string, unknown> = {}) => ({ kind: 'family', memberId: gia, fullName: 'Gia Fernwood', email, membershipExpiry: '2027-06-17', children, ...extra })
    const auth = signInService([{ id: gia, email, signedIn: true }])
    const db = database()
    const cases: Array<[object, string]> = [
      [family(['Hal Fernwood']), 'child profile Hal Fernwood'],
      [family(['Esme Fernwood'], { linkExisting: [{ memberId: esme, fullName: 'Esme Fernwood' }] }), `Fernwood, Esme (${esme}) as a child of this account`],
    ]
    for (const [entry, line] of cases) {
      const plan = planOf(admin, [entry])
      const groups = buildPlan(plan, await loadSnapshot(db, plan), TODAY)
      expect(groups[0].ops.some((op: { type: string }) => op.type === 'refuse')).toBe(false)
      // Gia's row is linked to another account between the read and the run.
      await setColumns(gia, { guardian_id: other })
      const lines: string[] = []
      const result = await execute(groups, { auth, d1: db, apply: true, log: (l: string) => lines.push(l) })
      expect(result.exitCode).toBe(1)
      expect(lines.filter((l) => l.startsWith('   FAIL'))).toEqual([
        `   FAIL    ${line}: nothing was written: the guardian's row ${gia} is a child of another account (${other}), and a child cannot have children`,
      ])
      await setColumns(gia, { guardian_id: null })
    }
    expect(db.writes).toEqual([])
    expect(await childrenOf(gia)).toEqual([])
    expect(await member(esme)).toMatchObject({ guardian_id: null })
    expect(await auditRows(admin)).toEqual([])
  })
})

describe('two entries that reach one child row', () => {
  it('refuses a second family that links a child the first holds, and an update of that child, in every run', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const at = (name: string) => `${name}.${tag}@example.org`
    const admin = await seedAdmin()
    const cleo = await seedMember({ fullName: 'Cleo Fernwood', email: at('cleo'), membershipStatus: 'none' })
    const dov = `child-dov-${tag}`
    await env.DB.prepare(`INSERT INTO members (id, email, full_name, membership_status, role, guardian_id) VALUES (?, ?, 'Dov Fernwood', 'none', 'member', ?)`)
      .bind(dov, at('cleo'), cleo)
      .run()
    const yara = await seedMember({ fullName: 'Yara Hollow', email: at('yara'), membershipStatus: 'none' })
    const plan = planOf(admin, [
      { kind: 'family', memberId: cleo, fullName: 'Cleo Fernwood', email: at('cleo'), membershipExpiry: '2027-06-17', children: ['Dov Fernwood'] },
      // Each of these would put back, on every run, what the first changed on Dov's row.
      { kind: 'family', memberId: yara, fullName: 'Yara Hollow', email: at('yara'), membershipExpiry: '2027-06-17', children: ['Dov Fernwood'], linkExisting: [{ memberId: dov, fullName: 'Dov Fernwood' }] },
      { kind: 'update', memberId: dov, membershipExpiry: '2027-01-31' },
    ])
    const held = `entry 1 already holds the row ${dov} (Dov Fernwood), a child on the account ${cleo}`
    const refusals = [`   REFUSE  entry 2: ${held}`, `   REFUSE  entry 3: ${held}`]

    const db = database()
    const first = await run(plan, signInService([{ id: cleo, email: at('cleo'), signedIn: true }]), db)
    expect(first.result.exitCode).toBe(1)
    expect(first.lines.filter((l) => l.startsWith('   REFUSE'))).toEqual(refusals)
    expect(membership(await member(cleo))).toEqual(['active', '2027-06-17', 'family'])
    expect(membership(await member(dov))).toEqual(['active', '2027-06-17', 'family'])
    expect(await member(yara)).toMatchObject({ membership_status: 'none' })
    expect((await childrenOf(yara)).map((k) => k.id)).toEqual([])
    expect((await auditRows(admin)).map((row) => [row.action, row.target_member_id])).toEqual([
      ['membership_override', cleo],
      ['membership_override', dov],
    ])

    // The run after it changes nothing, and refuses the same two entries.
    const again = database()
    const second = await run(plan, signInService([{ id: cleo, email: at('cleo'), signedIn: true }]), again)
    expect(second.lines.filter((l) => l.startsWith('   REFUSE'))).toEqual(refusals)
    expect(again.writes).toEqual([])
    expect(membership(await member(dov))).toEqual(['active', '2027-06-17', 'family'])
  })
})
