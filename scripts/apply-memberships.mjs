// scripts/apply-memberships.mjs
//
// Applies a plan file of membership changes to the live site, each one the
// way the site itself would have made it. Sends no email.
//
// Each entry of the plan is one person:
//   add     A new member: a sign-in account (email confirmed, no password)
//           and a members row whose id is that account's id, as
//           scripts/provision-members.mjs makes them. If a row already holds
//           the email, that row's membership changes instead and its name
//           stays as it is.
//   family  A guardian on a family membership. The guardian's row is the one
//           the entry names by memberId, else the one holding the email,
//           else a new account made as for add; it takes the entry's name
//           and an active family membership. A row under another name that
//           holds a US Chess ID or tournament entries is refused, since they
//           would stay on it under the guardian's name, unless the entry
//           says "renameKeepsEntries": true because the row is the
//           guardian's own under another spelling. Each child is then
//           already on the account, or an existing row named in
//           linkExisting and linked to it, or a new child profile made as
//           /api/me/children makes one. Last comes the family coverage of
//           functions/utils/family.ts: the first three children, in the
//           order they were added, get an active family membership to the
//           later of their own expiry and the guardian's.
//   update  Whichever of one row's name, email, membership status and expiry
//           the entry names. An expiry given without a status sets the
//           status from the date, as the admin membership endpoint does:
//           active when the date is today or later, expired when it is
//           before. A new email goes on the sign-in account first and then
//           on the row, because every sign in copies the account's email
//           onto the row (upsertMemberFromAuth).
// Every change writes an admin_audit_log row in the actor's name, with the
// plan's source as the reason, under one of the AdminAction names in
// functions/utils/admin/audit.ts: 'membership_override' for a membership,
// as the admin membership endpoint writes it, a new member row included
// (from no membership); 'name_change' for a name, as the admin name
// endpoint writes it; 'email_change' for an email; 'guardian_link' for an
// existing row linked to a guardian. A new child profile writes none of its
// own; the 'membership_override' of its family coverage, when it is
// covered, records it.
//
// Two steps, from the repository root:
//   export SUPABASE_URL=...                same one the site uses
//   export SUPABASE_SERVICE_ROLE_KEY=...   service role, not anon
//   export CLOUDFLARE_API_TOKEN=...
//   export CF_ACCOUNT_ID=...               or CLOUDFLARE_ACCOUNT_ID
//   node scripts/apply-memberships.mjs <plan.json>           1. dry run
//   node scripts/apply-memberships.mjs <plan.json> --apply   2. the real run
// The dry run only reads (member rows and sign-in accounts, and the audit log
// when rows are kept from an earlier run) and prints, person by person, what
// the real run would do. Read all of it before step 2.
// The family size comes from domain/households/family.ts, so the script needs
// a Node that loads TypeScript files as they are: 22.18 or later (23.6 or
// later on Node 23). On an older Node it says so in one sentence and stops.
//
// The plan file holds people's names and emails, so it lives outside the
// repository and is never committed; the script will not read one inside it.
// Once applied, the rows in production are the truth, not the plan. Running
// the script again is safe: every write first reads its row afresh and skips
// what already holds, so a run after a fix repeats nothing. An audit log row
// that could not be written after its change was made is kept beside the
// plan, in <plan>.missing-audit.json, from the moment it fails, so a run
// stopped part way loses none, and the next run with --apply writes it, under
// the same id and dated when the change was made, and then removes the file.
// Its FAIL line also prints the row as a statement to run by hand.
//
// At the end the real run names the people it made a sign-in account for, or
// whose unused account it gave a real email, to be told to set a password,
// whether or not the rest of their entry went through: one whose entry did
// not finish carries a note saying what failed or was refused. A later run
// that finishes such an entry names them again when their row was never
// made; when it was, the run finds the row and says, in that person's part
// of the output, that they have a sign-in account already, so the two runs
// can be matched up.
//
// The plan file, with every date written YYYY-MM-DD:
//   { "source": "where these changes come from (the audit log's reason)",
//     "actor": { "memberId": "...", "email": "..." },     an lca_admin's row
//     "defaults": { "individualType": "adult", "familyType": "family" },
//     "decidedByK" (optional): text for people, printed under the source,
//     "entries": [
//       { "kind": "add", "fullName", "email", "membershipExpiry",
//         "membershipType" (optional, else defaults.individualType) },
//       { "kind": "family", "fullName", "email", "membershipExpiry",
//         "children": [names], "memberId" (optional),
//         "linkExisting" (optional): [{ "memberId", "fullName" }],
//         "renameKeepsEntries" (optional): true or false },
//       { "kind": "update", "memberId", and any of "fullName", "email",
//         "membershipExpiry", "membershipStatus" } ] }
// Any entry may also carry "note", "pending" and "decided": text for people,
// which the script prints and never acts on.

// Loaded when the module loads rather than by an import statement: on a Node
// too old to load a .ts file the import then fails quietly, and main says why
// in one sentence instead of the module failing before main can run.
let familyRules = null
let familyImportFailure = null
try {
  familyRules = await import('../domain/households/family.ts')
} catch (err) {
  familyImportFailure = err
}
/** How many children one family membership covers (domain/households/family.ts). */
const FAMILY_SIZE = familyRules?.FAMILY_MEMBERSHIP_CHILDREN

const D1_DATABASE_ID = 'e891b93f-e7fe-48d0-9afc-8570d805ef08' // lca-db

/** Children one account may hold (functions/api/me/children.ts). */
const MAX_CHILDREN = 8
/** The longest name the site accepts (functions/utils/admin/members.ts). */
const MAX_NAME_LENGTH = 100

const KINDS = ['add', 'family', 'update']
/** Every action the script writes to admin_audit_log: each is in the AdminAction union of functions/utils/admin/audit.ts. */
export const AUDIT_ACTIONS = ['membership_override', 'name_change', 'email_change', 'guardian_link']
const MEMBERSHIP_TYPES = ['adult', 'scholastic', 'family', 'senior', 'single_event']
const MEMBERSHIP_STATUSES = ['active', 'expired', 'none']
/** Text for people that any entry may carry: printed, never acted on. */
const NOTE_FIELDS = ['note', 'pending', 'decided']
const ENTRY_FIELDS = {
  add: ['kind', 'fullName', 'email', 'membershipExpiry', 'membershipType', ...NOTE_FIELDS],
  family: ['kind', 'fullName', 'email', 'membershipExpiry', 'children', 'memberId', 'linkExisting', 'renameKeepsEntries', ...NOTE_FIELDS],
  update: ['kind', 'memberId', 'fullName', 'email', 'membershipExpiry', 'membershipStatus', ...NOTE_FIELDS],
}
const REQUIRED_FIELDS = {
  add: ['fullName', 'email', 'membershipExpiry'],
  family: ['fullName', 'email', 'membershipExpiry', 'children'],
  update: ['memberId'],
}
const TYPE_WORDS = { adult: 'adult', scholastic: 'scholastic', family: 'family', senior: 'senior', single_event: 'single event' }
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// rowid breaks ties in created_at, as listChildren orders them.
const MEMBER_COLUMNS =
  'rowid AS row_order, id, email, full_name, uscf_id, role, membership_status, membership_expiry, membership_type, club_id, guardian_id, created_at'

/** @type {Membership} */
const NO_MEMBERSHIP = { status: 'none', expiry: null, type: null }

/**
 * @typedef {{ status: string, expiry: string | null, type: string | null }} Membership
 * @typedef {{ actorId: string, actorEmail: string, reason: string }} AuditContext
 * @typedef {{ type: string, text: string, details?: string[], [key: string]: unknown }} Operation
 * @typedef {{ index: number, kind: string, person: string, notes: string[], audit: AuditContext, ops: Operation[] }} Group
 * @typedef {{ query: (sql: string, params?: unknown[]) => Promise<{ results: Record<string, unknown>[], changes: number | null }> }} D1Adapter
 * @typedef {{ members: Record<string, unknown>[], registrationCounts?: Record<string, number>, audit?: Record<string, unknown>[], missingAudit?: AuditRow[] }} Snapshot
 * @typedef {{ id: string, actorId: string, actorEmail: string, action: string, targetId: string, targetLabel: string, detail: string, madeAt: string }} AuditRow
 * @typedef {{ uscfId: string | null, entries: number }} Holdings
 * @typedef {{ fullName: string, email: string, moved?: boolean }} NewSignIn
 * @typedef {{ id: string, email: string, signedIn: boolean }} SignInAccount
 * @typedef {{
 *   findUserByEmail: (email: string) => Promise<SignInAccount | null>,
 *   createUser: (user: { email: string, fullName: string }) => Promise<{ id: string } | { duplicate: true }>,
 *   updateEmail: (id: string, email: string) => Promise<unknown>,
 * }} AuthAdapter
 */

/** A problem with the plan as a whole: nothing is written while it stands. */
export class PlanError extends Error {}

/**
 * Why this Node cannot run the script, in one sentence, or null when it can.
 * The script imports a TypeScript file from domain/, which Node loads as it
 * is from 22.18 on, and from 23.6 on in the 23 line.
 */
export function nodeVersionProblem(version) {
  const m = /^v?(\d+)\.(\d+)\./.exec(typeof version === 'string' ? version : '')
  const [major, minor] = m ? [Number(m[1]), Number(m[2])] : [0, 0]
  if (major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18)) return null
  const shown = typeof version === 'string' && version ? version : 'of no known version'
  return `This script needs Node 22.18 or later (23.6 or later on Node 23), which loads the TypeScript file it imports from domain/, and this is Node ${shown}.`
}

// ── Dates and words ─────────────────────────────────────────────────

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(value) {
  if (typeof value !== 'string') return false
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

/** A YYYY-MM-DD date as people read it, weekday first: "Fri, Jun 18, 2027". */
export function formatDate(iso) {
  if (!isIsoDate(iso)) return String(iso)
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${weekday}, ${MONTHS[month - 1]} ${day}, ${year}`
}

/** Today's date in Louisiana, YYYY-MM-DD. */
export function centralToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** A membership as people read it: "adult, active to Fri, Jun 18, 2027". */
export function membershipWords({ status, expiry, type }) {
  if (status === 'none') return 'no membership'
  const kind = type ? `${TYPE_WORDS[type] ?? type}, ` : ''
  if (status === 'active') return `${kind}active to ${expiry ? formatDate(expiry) : 'no end date'}`
  if (status === 'expired') return `${kind}expired${expiry ? ` ${formatDate(expiry)}` : ''}`
  return `${kind}${status}`
}

const lower = (value) => String(value).trim().toLowerCase()
const label = (row) => `${row.full_name} <${row.email}>`
const messageOf = (err) => (err instanceof Error ? err.message : String(err))

/** @returns {Membership} */
const stateOf = (row) => ({
  status: row.membership_status,
  expiry: row.membership_expiry ?? null,
  type: row.membership_type ?? null,
})
const sameState = (a, b) => a.status === b.status && (a.expiry ?? null) === (b.expiry ?? null) && (a.type ?? null) === (b.type ?? null)

/** The later of two dates, as syncFamilyCoverage picks it: a child's own longer membership is never shortened. */
function laterDate(a, b) {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

/** A child profile carries its guardian's email and has no sign-in account; a walk-in guest row is no account either. */
function isAccountRow(row) {
  return !String(row.id).startsWith('child-') && row.role !== 'guest'
}

/**
 * Why a row cannot hold children, as /api/me/children refuses it: a child
 * cannot have children, and a walk-in guest has no account. Null when it can.
 */
function guardianProblem(row) {
  if (row.guardian_id) return `the guardian's row ${row.id} is a child of another account (${row.guardian_id}), and a child cannot have children`
  if (row.role === 'guest') return `the guardian's row ${row.id} is a walk-in guest row, which has no account to hold children`
  return null
}

/** Oldest first, rowid breaking ties: the order listChildren gives and coverage follows. */
function byAddedOrder(a, b) {
  if (a.created_at !== b.created_at) return String(a.created_at) < String(b.created_at) ? -1 : 1
  return Number(a.row_order ?? 0) - Number(b.row_order ?? 0)
}

const signInText = (email) => `sign-in account for ${email}`
/**
 * Said for a person whose row the plan finds, so it makes no account. On a
 * run after one that made the account and stopped later in the entry, this
 * is the line that matches the earlier run's list of new sign-in accounts.
 */
const signInHeldText = (email, row) => `${email} has a sign-in account already (the member row ${row.id}), so none is made`
const memberRowText = (fullName, email, to) => `member row for ${fullName} <${email}>: ${membershipWords(to)}`
const membershipText = (name, from, next) => `membership of ${name}: ${membershipWords(next)} (was ${membershipWords(from)})`
const membershipHeldText = (name, state) => `membership of ${name} is already ${membershipWords(state)}`
/** What a row holds that belongs to the person it was made for: "US Chess ID 12345678 and 2 tournament entries". */
function holdingsWords({ uscfId, entries }) {
  const parts = []
  if (uscfId) parts.push(`US Chess ID ${uscfId}`)
  if (entries > 0) parts.push(`${entries} tournament ${entries === 1 ? 'entry' : 'entries'}`)
  return parts.join(' and ')
}
const holdsAny = (holds) => Boolean(holds.uscfId) || holds.entries > 0
/** @returns {Holdings} */
const holdingsOfRow = (row, entries) => ({ uscfId: row.uscf_id ? String(row.uscf_id) : null, entries: Number(entries) || 0 })

/** A rename with what the row holds, which stays on it under the new name. */
function renameText(id, from, to, holds, keeps = false) {
  const what = holdingsWords(holds)
  if (!what) return `"${from}" to "${to}" (${id}); the row holds no US Chess ID and no tournament entries`
  const several = (holds.uscfId ? 1 : 0) + holds.entries > 1
  return `"${from}" to "${to}" (${id}); ${what} ${several ? 'stay' : 'stays'} on the row${keeps ? ' (renameKeepsEntries)' : ''}`
}
/** Why a family will not take over a row under another name that holds a US Chess ID or entries. */
const renameRefusalText = (row, to, holds, now = false) =>
  `the row ${row.id} ("${row.full_name}") ${now ? 'now holds' : 'holds'} ${holdingsWords(holds)}, which would go under the name "${to}"; ` +
  `add "renameKeepsEntries": true to the entry only if this row is ${to}'s own under another spelling, and otherwise settle it by hand`
const emailText = (id, from, to) => `${from} to ${to} (${id}), on the sign-in account first and then on the row`
const childText = (name) => `child profile ${name}`
const childHeldText = (name) => `child ${name} is already on this account`
const linkText = (row) => `${row.full_name} (${row.id}) as a child of this account`
const linkHeldText = (row) => `${row.full_name} (${row.id}) is already linked to this account`
const coverText = (name, from, to) => `family coverage for ${name}: ${membershipWords(to)} (was ${membershipWords(from)})`
const coveredText = (name, state) => `${name} is already covered: ${membershipWords(state)}`
const uncoveredText = (name, place) =>
  `${name} is not covered: a family membership covers the first ${FAMILY_SIZE} children by when they were added, and ${name} is number ${place}`

const skip = (text) => ({ type: 'skip', text })
const refuse = (text) => ({ type: 'refuse', text })

// ── The plan ────────────────────────────────────────────────────────

/** Checks the parts of the plan every entry relies on. Throws PlanError. */
export function checkPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new PlanError('The plan file must hold one JSON object.')
  }
  const problems = []
  if (typeof plan.source !== 'string' || !plan.source.trim()) {
    problems.push('"source" must say where these changes come from; it becomes the reason in the audit log.')
  }
  const actor = plan.actor
  if (!actor || typeof actor.memberId !== 'string' || !actor.memberId.trim() || typeof actor.email !== 'string' || !EMAIL_SHAPE.test(actor.email.trim())) {
    problems.push('"actor" needs the memberId and email of the admin making these changes.')
  }
  if (!plan.defaults || !MEMBERSHIP_TYPES.includes(plan.defaults.individualType)) {
    problems.push(`"defaults.individualType" must be one of ${MEMBERSHIP_TYPES.join(', ')}.`)
  }
  if (!plan.defaults || plan.defaults.familyType !== 'family') {
    problems.push('"defaults.familyType" must be family, the type the site\'s family coverage looks for.')
  }
  if (!Array.isArray(plan.entries) || plan.entries.length === 0) {
    problems.push('"entries" must be a list with at least one entry.')
  }
  if (plan.decidedByK !== undefined && typeof plan.decidedByK !== 'string') {
    problems.push('"decidedByK" must be text.')
  }
  if (problems.length) throw new PlanError(problems.join(' '))
}

function nameProblem(value) {
  if (typeof value !== 'string') return 'must be text'
  if (!value.trim()) return 'is empty'
  if (value.trim().length > MAX_NAME_LENGTH) return `is longer than ${MAX_NAME_LENGTH} characters`
  return null
}

/** What makes one entry unusable on its own, before any row is looked at. */
function entryProblems(entry, today) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ['the entry is not an object']
  if (!KINDS.includes(entry.kind)) return [`kind ${JSON.stringify(entry.kind)} is not add, family or update`]
  const problems = []
  const unknown = Object.keys(entry).filter((key) => !ENTRY_FIELDS[entry.kind].includes(key))
  if (unknown.length) problems.push(`${unknown.map((k) => `"${k}"`).join(', ')} ${unknown.length === 1 ? 'is not a field' : 'are not fields'} of ${entry.kind} entries`)
  for (const field of REQUIRED_FIELDS[entry.kind]) {
    if (entry[field] === undefined || entry[field] === null) problems.push(`${field} is missing`)
  }
  if (entry.fullName !== undefined) {
    const problem = nameProblem(entry.fullName)
    if (problem) problems.push(`fullName ${problem}`)
  }
  if (entry.email !== undefined && !(typeof entry.email === 'string' && EMAIL_SHAPE.test(entry.email.trim()))) {
    problems.push(`email ${JSON.stringify(entry.email)} is not an email address`)
  }
  if (entry.memberId !== undefined && !(typeof entry.memberId === 'string' && entry.memberId.trim())) {
    problems.push('memberId must be the id of a member row')
  }
  if (entry.membershipExpiry !== undefined && !isIsoDate(entry.membershipExpiry)) {
    problems.push(`membershipExpiry ${JSON.stringify(entry.membershipExpiry)} is not a date written YYYY-MM-DD`)
  }
  if (entry.membershipStatus !== undefined && !MEMBERSHIP_STATUSES.includes(entry.membershipStatus)) {
    problems.push(`membershipStatus ${JSON.stringify(entry.membershipStatus)} is not one of ${MEMBERSHIP_STATUSES.join(', ')}`)
  }
  if (entry.membershipType !== undefined && !MEMBERSHIP_TYPES.includes(entry.membershipType)) {
    problems.push(`membershipType ${JSON.stringify(entry.membershipType)} is not one of ${MEMBERSHIP_TYPES.join(', ')}`)
  }
  for (const field of NOTE_FIELDS) {
    if (entry[field] !== undefined && typeof entry[field] !== 'string') problems.push(`${field} must be text`)
  }
  if (entry.kind === 'family') problems.push(...familyProblems(entry, today))
  if (entry.kind === 'update') {
    if (!['fullName', 'email', 'membershipExpiry', 'membershipStatus'].some((field) => entry[field] !== undefined)) {
      problems.push('it names nothing to change')
    }
    if (entry.membershipStatus === 'active' && isIsoDate(entry.membershipExpiry) && entry.membershipExpiry < today) {
      problems.push(`an active membership cannot end before today: ${formatDate(entry.membershipExpiry)} is before ${formatDate(today)}`)
    }
  }
  return problems
}

function familyProblems(entry, today) {
  const problems = []
  if (entry.renameKeepsEntries !== undefined && typeof entry.renameKeepsEntries !== 'boolean') {
    problems.push('renameKeepsEntries must be true or false')
  }
  if (isIsoDate(entry.membershipExpiry) && entry.membershipExpiry < today) {
    problems.push(`a family membership is made active, so it cannot end before today: ${formatDate(entry.membershipExpiry)} is before ${formatDate(today)}`)
  }
  const names = new Set()
  if (entry.children !== undefined && !Array.isArray(entry.children)) problems.push('children must be a list of names')
  for (const child of Array.isArray(entry.children) ? entry.children : []) {
    const problem = nameProblem(child)
    if (problem) {
      problems.push(`a child's name ${problem}`)
    } else if (names.has(lower(child))) {
      problems.push(`${child.trim()} is listed twice in children`)
    } else {
      names.add(lower(child))
    }
  }
  if (entry.linkExisting === undefined) return problems
  if (!Array.isArray(entry.linkExisting)) return [...problems, 'linkExisting must be a list']
  const ids = new Set()
  const linked = new Set()
  for (const link of entry.linkExisting) {
    if (!link || typeof link.memberId !== 'string' || !link.memberId.trim() || nameProblem(link.fullName)) {
      problems.push('each linkExisting item needs a memberId and a fullName')
      continue
    }
    if (!names.has(lower(link.fullName))) problems.push(`linkExisting names ${link.fullName.trim()}, who is not in children`)
    if (ids.has(link.memberId)) problems.push(`linkExisting names the row ${link.memberId} twice`)
    if (linked.has(lower(link.fullName))) problems.push(`linkExisting names ${link.fullName.trim()} twice`)
    ids.add(link.memberId)
    linked.add(lower(link.fullName))
  }
  return problems
}

function personOf(entry, rows) {
  if (!entry || typeof entry !== 'object') return 'an entry that is not an object'
  const row = typeof entry.memberId === 'string' ? rows.byId.get(entry.memberId) : undefined
  const name = typeof entry.fullName === 'string' && entry.fullName.trim() ? entry.fullName.trim() : row?.full_name ?? 'no name given'
  const email = typeof entry.email === 'string' && entry.email.trim() ? lower(entry.email) : row?.email ?? 'no email given'
  return `${name} <${email}>`
}

function notesOf(entry) {
  if (!entry || typeof entry !== 'object') return []
  return NOTE_FIELDS.filter((field) => typeof entry[field] === 'string' && entry[field].trim()).map((field) => `${field}: ${entry[field].trim()}`)
}

function indexRows(members, registrationCounts) {
  const byId = new Map(members.map((row) => [row.id, row]))
  const all = [...byId.values()]
  return {
    byId,
    accountsByEmail: (email) => all.filter((row) => isAccountRow(row) && lower(row.email) === email),
    childrenOf: (id) => all.filter((row) => row.guardian_id === id).sort(byAddedOrder),
    holdingsOf: (row) => holdingsOfRow(row, registrationCounts[row.id]),
  }
}

/**
 * A name change. guard is set when the row becomes the guardian's, so the
 * real run checks again what the row holds; keeps is the entry's
 * renameKeepsEntries.
 */
function renameOp(row, to, holds, { guard = false, keeps = false } = {}) {
  return { type: 'rename', memberId: row.id, from: row.full_name, to, guard, keeps, text: renameText(row.id, row.full_name, to, holds, keeps) }
}

/** The change to one row's membership, or a skip when it already holds. */
function membershipOp(row, set, name = row.full_name) {
  const from = stateOf(row)
  const next = { ...from, ...set }
  if (sameState(from, next)) return skip(membershipHeldText(name, from))
  const op = { type: 'set-membership', memberId: row.id, name, from, to: set, text: membershipText(name, from, next) }
  if (from.expiry && next.expiry && next.expiry < from.expiry) {
    op.details = [`warning: this ends the membership earlier than the date it holds now, ${formatDate(from.expiry)}`]
  }
  return op
}

function newAccountOps(email, fullName, to) {
  return [
    { type: 'create-sign-in', email, fullName, text: signInText(email) },
    { type: 'insert-member', email, fullName, to, text: memberRowText(fullName, email, to) },
  ]
}

function planAdd(group, entry, { rows, defaults, today }) {
  const email = lower(entry.email)
  const fullName = entry.fullName.trim()
  const to = {
    status: entry.membershipExpiry >= today ? 'active' : 'expired',
    expiry: entry.membershipExpiry,
    type: entry.membershipType ?? defaults.individualType,
  }
  const holders = rows.accountsByEmail(email)
  if (holders.length > 1) {
    group.ops.push(refuse(`${holders.length} member rows hold ${email} (${holders.map((r) => r.id).join(', ')}); decide by hand which one is the account`))
    return
  }
  const [row] = holders
  if (!row) {
    group.ops.push(...newAccountOps(email, fullName, to))
    return
  }
  group.ops.push(skip(signInHeldText(email, row)))
  const op = membershipOp(row, to)
  op.details = [
    `this email already has a member row (${row.id}), so its membership changes and its name stays "${row.full_name}"`,
    ...(op.details ?? []),
  ]
  group.ops.push(op)
}

function planFamily(group, entry, { rows, defaults }) {
  const ops = group.ops
  const email = lower(entry.email)
  const fullName = entry.fullName.trim()

  let guardian = null
  if (entry.memberId !== undefined) {
    guardian = rows.byId.get(entry.memberId) ?? null
    if (!guardian) return void ops.push(refuse(`no member row has the id ${entry.memberId}`))
    if (lower(guardian.email) !== email) {
      return void ops.push(refuse(`the row ${guardian.id} holds ${guardian.email}, not ${email}; correct the plan, or change the row's email with an update entry first`))
    }
  } else {
    const holders = rows.accountsByEmail(email)
    if (holders.length > 1) {
      return void ops.push(refuse(`${holders.length} member rows hold ${email} (${holders.map((r) => r.id).join(', ')}); name the guardian's row with memberId`))
    }
    guardian = holders[0] ?? null
  }
  if (guardian && !isAccountRow(guardian)) {
    return void ops.push(refuse(`${label(guardian)} is ${guardian.role === 'guest' ? 'a walk-in guest row' : 'a child profile'}, not an account that can hold a family membership`))
  }
  if (guardian?.guardian_id) {
    return void ops.push(refuse(`${label(guardian)} is a child on another account (${guardian.guardian_id}), and a child cannot be a guardian`))
  }

  // The guardian: name and an active family membership.
  const to = { status: 'active', expiry: entry.membershipExpiry, type: defaults.familyType }
  if (guardian) {
    let nameOp = skip(`name is already "${fullName}"`)
    if (guardian.full_name !== fullName) {
      // The row becomes the guardian's, and whatever it holds stays on it
      // under the new name: a child's US Chess ID, rating and entries would
      // pass to the parent. Only the entry can say the row is the
      // guardian's own under another spelling (renameKeepsEntries).
      const holds = rows.holdingsOf(guardian)
      const keeps = entry.renameKeepsEntries === true
      if (holdsAny(holds) && !keeps) return void ops.push(refuse(renameRefusalText(guardian, fullName, holds)))
      nameOp = renameOp(guardian, fullName, holds, { guard: true, keeps })
    }
    ops.push(skip(signInHeldText(email, guardian)), nameOp, membershipOp(guardian, to, fullName))
  } else {
    ops.push(...newAccountOps(email, fullName, to))
  }

  // The children: on the account already, linked, or new.
  const guardianId = guardian?.id ?? null
  const onAccount = guardianId ? rows.childrenOf(guardianId) : []
  const existing = [...onAccount]
  const added = []
  const links = new Map((entry.linkExisting ?? []).map((link) => [lower(link.fullName), link]))
  let count = onAccount.length
  for (const raw of entry.children) {
    const name = raw.trim()
    if (onAccount.some((row) => lower(row.full_name) === lower(name))) {
      ops.push(skip(childHeldText(name)))
      continue
    }
    const link = links.get(lower(name))
    if (link) {
      const row = rows.byId.get(link.memberId)
      if (row && guardianId && row.guardian_id === guardianId) {
        ops.push(skip(linkHeldText(row)))
        continue
      }
      const problem = !row
        ? `no member row has the id ${link.memberId}`
        : row.id === guardianId
          ? 'that row is the guardian\'s own'
          : row.guardian_id
            ? `the row ${row.id} (${row.full_name}) is already a child of another account (${row.guardian_id}), so it is left alone`
            : !isAccountRow(row)
              ? `the row ${row.id} is a walk-in guest row`
              : rows.childrenOf(row.id).length > 0
                ? `${row.full_name} (${row.id}) has children of their own, and a guardian cannot be a child`
                : count >= MAX_CHILDREN
                  ? `an account can hold at most ${MAX_CHILDREN} children`
                  : null
      if (problem) {
        ops.push(refuse(`child ${name}: ${problem}`))
        continue
      }
      count++
      ops.push({ type: 'link-child', guardianId, childId: row.id, fullName: name, text: linkText(row) })
      existing.push(row)
      continue
    }
    if (count >= MAX_CHILDREN) {
      ops.push(refuse(`child ${name}: an account can hold at most ${MAX_CHILDREN} children`))
      continue
    }
    count++
    const childKey = lower(name)
    ops.push({ type: 'insert-child', guardianId, fullName: name, childKey, text: childText(name) })
    added.push({ name, childKey })
  }

  // Coverage, as syncFamilyCoverage gives it: every child on the account in
  // the order they were added (new profiles last), the first three covered.
  const line = [
    ...existing.sort(byAddedOrder).map((row) => ({ name: row.full_name, childId: row.id, childKey: null, from: stateOf(row) })),
    ...added.map((kid) => ({ name: kid.name, childId: null, childKey: kid.childKey, from: NO_MEMBERSHIP })),
  ]
  line.forEach((kid, i) => {
    if (i >= FAMILY_SIZE) {
      ops.push(skip(uncoveredText(kid.name, i + 1)))
      return
    }
    const target = { status: 'active', expiry: laterDate(kid.from.expiry, to.expiry), type: 'family' }
    if (sameState(kid.from, target)) {
      ops.push(skip(coveredText(kid.name, target)))
      return
    }
    ops.push({
      type: 'cover-child',
      guardianId,
      childId: kid.childId,
      childKey: kid.childKey,
      name: kid.name,
      from: kid.from,
      to: target,
      text: coverText(kid.name, kid.from, target),
    })
  })
}

function planUpdate(group, entry, { rows, today }) {
  const ops = group.ops
  const row = rows.byId.get(entry.memberId)
  if (!row) return void ops.push(refuse(`no member row has the id ${entry.memberId}`))

  const email = entry.email === undefined ? null : lower(entry.email)
  if (email && lower(row.email) !== email) {
    if (!isAccountRow(row)) {
      return void ops.push(refuse(`${label(row)} has no sign-in account of its own, so its email cannot change here`))
    }
    const others = rows.accountsByEmail(email).filter((other) => other.id !== row.id)
    if (others.length) return void ops.push(refuse(`${email} already belongs to ${others.map(label).join('; ')}`))
  }
  const set = {}
  if (entry.membershipStatus !== undefined) set.status = entry.membershipStatus
  // An expiry without a status sets the status from the date, as the admin
  // membership endpoint does: active from today on, expired before.
  else if (entry.membershipExpiry !== undefined) set.status = entry.membershipExpiry >= today ? 'active' : 'expired'
  if (entry.membershipExpiry !== undefined) set.expiry = entry.membershipExpiry
  const next = { ...stateOf(row), ...set }
  if (Object.keys(set).length && next.status === 'active' && next.expiry && next.expiry < today) {
    return void ops.push(refuse(`an active membership cannot end before today: ${formatDate(next.expiry)} is before ${formatDate(today)}`))
  }

  const fullName = entry.fullName === undefined ? null : entry.fullName.trim()
  // The email first, so the audit rows that follow name the new one.
  if (email) {
    ops.push(
      lower(row.email) === email
        ? skip(`email is already ${email}`)
        : { type: 'change-email', memberId: row.id, from: row.email, to: email, fullName: fullName ?? row.full_name, text: emailText(row.id, row.email, email) },
    )
  }
  // The entry names this row and the person on it, so their own US Chess
  // ID and entries stay with them; the line says what those are.
  if (fullName) {
    ops.push(row.full_name === fullName ? skip(`name is already "${fullName}"`) : renameOp(row, fullName, rows.holdingsOf(row)))
  }
  if (Object.keys(set).length) ops.push(membershipOp(row, set, fullName ?? row.full_name))
}

const KEPT_AUDIT_HEADING = 'Audit log rows an earlier run could not write'
const STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

/** What makes an audit log row kept from an earlier run unusable, or null. */
function auditRowProblem(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return 'is not an object'
  for (const field of ['id', 'actorId', 'actorEmail', 'action', 'targetId', 'targetLabel', 'detail', 'madeAt']) {
    if (typeof row[field] !== 'string' || !row[field].trim()) return `has no ${field}`
  }
  if (!AUDIT_ACTIONS.includes(row.action)) return `has the action ${JSON.stringify(row.action)}, which this script does not write`
  if (!STAMP.test(row.madeAt)) return `has the time ${JSON.stringify(row.madeAt)}, not one written YYYY-MM-DD HH:MM:SS`
  if (detailKey(row.detail) === null) return 'has a detail that is not a JSON object'
  return null
}

/** What an audit row's detail says changed: the reason, from and to, and the guardian of a link. */
function detailKey(detail) {
  let d
  try {
    d = typeof detail === 'string' ? JSON.parse(detail) : detail
  } catch {
    return null
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const part = (v) => (v && typeof v === 'object' ? [v.status ?? null, v.expiry ?? null, v.type ?? null] : v ?? null)
  return JSON.stringify([d.reason ?? null, part(d.from), part(d.to), d.guardianId ?? null])
}

const sameDetail = (a, b) => {
  const key = detailKey(a)
  return key !== null && key === detailKey(b)
}

/** A kept audit log row as people read it, with the day its change was made. */
function auditRowText(row) {
  const d = JSON.parse(row.detail)
  const who = row.targetLabel
  const what = {
    membership_override: () => `membership of ${who}: ${membershipWords(d.to ?? NO_MEMBERSHIP)} (was ${membershipWords(d.from ?? NO_MEMBERSHIP)})`,
    name_change: () => `name of ${who}: "${d.from}" to "${d.to}"`,
    email_change: () => `email of ${who}: ${d.from} to ${d.to}`,
    guardian_link: () => `${who} linked as a child of the account ${d.guardianId}`,
  }[row.action]()
  return `${what}; the change was made ${formatDate(centralToday(new Date(`${row.madeAt.replace(' ', 'T')}Z`)))}`
}

/**
 * The audit log rows an earlier run could not write (snapshot.missingAudit,
 * from the file kept beside the plan) that the table still lacks: no row
 * there has the same id, or the same member, action and detail (the same
 * reason, from and to). Each becomes an "audit" operation that writes it.
 */
function auditRepairs(snapshot) {
  const kept = Array.isArray(snapshot?.missingAudit) ? snapshot.missingAudit : []
  const present = Array.isArray(snapshot?.audit) ? snapshot.audit : []
  const seen = new Set()
  const ops = []
  kept.forEach((row, i) => {
    const problem = auditRowProblem(row)
    if (problem) throw new PlanError(`Audit log row ${i + 1} kept from an earlier run ${problem}.`)
    if (seen.has(row.id)) return
    seen.add(row.id)
    const written = present.some(
      (r) => r.id === row.id || (r.target_member_id === row.targetId && r.action === row.action && sameDetail(r.detail, row.detail)),
    )
    if (!written) ops.push({ type: 'audit', row, text: auditRowText(row) })
  })
  return ops
}

/**
 * The plan in words and data: one group per entry, in the plan's order, each
 * an ordered list of operations. What already holds becomes a "skip", what
 * cannot be done a "refuse". Audit log rows an earlier run could not write,
 * and the table still lacks, come first, in a group of their own. Pure: reads
 * nothing but its arguments.
 *
 * @param {object} plan the plan file's contents
 * @param {Snapshot} snapshot from loadSnapshot
 * @param {string} today YYYY-MM-DD
 * @returns {Group[]}
 */
export function buildPlan(plan, snapshot, today) {
  checkPlan(plan)
  if (!isIsoDate(today)) throw new PlanError(`today must be a date written YYYY-MM-DD, not ${JSON.stringify(today)}`)
  if (typeof FAMILY_SIZE !== 'number') {
    throw new PlanError(`The family size could not be read from domain/households/family.ts: ${messageOf(familyImportFailure ?? 'it gave no number')}`)
  }
  const counts = snapshot?.registrationCounts && typeof snapshot.registrationCounts === 'object' ? snapshot.registrationCounts : {}
  const rows = indexRows(Array.isArray(snapshot?.members) ? snapshot.members : [], counts)

  const actor = rows.byId.get(plan.actor.memberId)
  if (!actor) throw new PlanError(`No member row has the actor's id, ${plan.actor.memberId}.`)
  if (lower(actor.email) !== lower(plan.actor.email)) {
    throw new PlanError(`The actor's row (${actor.id}) holds ${actor.email}, not ${lower(plan.actor.email)}.`)
  }
  if (actor.role !== 'lca_admin') {
    throw new PlanError(`${label(actor)} is not an admin (role ${actor.role}). These changes go into the audit log in the actor's name, so the actor must be an lca_admin.`)
  }
  const audit = { actorId: actor.id, actorEmail: actor.email, reason: plan.source.trim() }
  const defaults = plan.defaults

  const firstEntryFor = new Map()
  const groups = plan.entries.map((entry, i) => {
    /** @type {Group} */
    const group = {
      index: i + 1,
      kind: KINDS.includes(entry?.kind) ? entry.kind : 'unknown',
      person: personOf(entry, rows),
      notes: notesOf(entry),
      audit,
      ops: [],
    }
    const problems = entryProblems(entry, today)
    if (!problems.length) {
      // Two entries that reach one row would each plan from the same rows, and
      // each later run would put back what the other changed. An entry reaches
      // its email, the account rows that email finds, the row it names by id
      // and every row in its linkExisting; a family also reaches every child
      // already on its guardian's account, since its coverage changes them
      // whether or not it names them. Each reach is kept with how the entry
      // came to it, which is what a later entry's refusal says.
      const reaches = new Map()
      const reach = (key, how, childOf = null) => {
        if (!reaches.has(key)) reaches.set(key, { how, childOf })
      }
      if (typeof entry.email === 'string') {
        const email = lower(entry.email)
        reach(email, `names ${email}`)
        for (const row of rows.accountsByEmail(email)) reach(row.id, `names the row ${row.id}`)
      }
      if (entry.memberId !== undefined) reach(entry.memberId, `names the row ${entry.memberId}`)
      for (const link of entry.linkExisting ?? []) reach(link.memberId, `names the row ${link.memberId}`)
      if (entry.kind === 'family') {
        const guardians = entry.memberId !== undefined ? [rows.byId.get(entry.memberId)].filter(Boolean) : rows.accountsByEmail(lower(entry.email))
        for (const guardian of guardians) {
          for (const child of rows.childrenOf(guardian.id)) {
            reach(child.id, `holds the row ${child.id} (${child.full_name}), a child on the account ${guardian.id}`, guardian.id)
          }
        }
      }
      const clashes = new Map()
      for (const [key, { childOf }] of reaches) {
        const earlier = firstEntryFor.get(key)
        if (!earlier || clashes.has(earlier.index)) continue
        // Said from both sides when this entry reaches the row only as a child on its account.
        const mine = childOf && !earlier.childOf ? `, which is a child on this entry's account ${childOf}` : ''
        clashes.set(earlier.index, `${earlier.how}${mine}`)
      }
      for (const [earlier, words] of clashes) problems.push(`entry ${earlier} already ${words}`)
      if (!clashes.size) for (const [key, { how, childOf }] of reaches) firstEntryFor.set(key, { index: i + 1, how, childOf })
    }
    if (problems.length) {
      group.ops.push(refuse(`entry ${i + 1}: ${problems.join('; ')}`))
      return group
    }
    const context = { rows, defaults, today }
    if (entry.kind === 'add') planAdd(group, entry, context)
    else if (entry.kind === 'family') planFamily(group, entry, context)
    else planUpdate(group, entry, context)
    return group
  })
  const repairs = auditRepairs(snapshot)
  if (!repairs.length) return groups
  return [{ index: 0, kind: 'audit', person: KEPT_AUDIT_HEADING, notes: [], audit, ops: repairs }, ...groups]
}

// ── Reading ─────────────────────────────────────────────────────────

const marks = (list) => list.map(() => '?').join(', ')

function chunks(list, size = 50) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

async function selectMembers(d1, where, params) {
  const { results } = await d1.query(`SELECT ${MEMBER_COLUMNS} FROM members WHERE ${where}`, params)
  return results ?? []
}

/**
 * Reads the rows the plan names (by id, and by email compared lower-cased),
 * the children of every one of them, and how many tournament entries each
 * of those rows has. Given the audit log rows an earlier run could not
 * write (kept beside the plan), it also reads the audit log rows of the
 * members they are about, to see which have been written since. SELECT only.
 *
 * @param {D1Adapter} d1
 * @param {{ missingAudit?: AuditRow[] }} [options]
 * @returns {Promise<Snapshot>}
 */
export async function loadSnapshot(d1, plan, { missingAudit = [] } = {}) {
  const ids = new Set()
  const emails = new Set()
  const addId = (id) => {
    if (typeof id === 'string' && id.trim()) ids.add(id)
  }
  addId(plan?.actor?.memberId)
  for (const entry of Array.isArray(plan?.entries) ? plan.entries : []) {
    if (!entry || typeof entry !== 'object') continue
    addId(entry.memberId)
    if (typeof entry.email === 'string' && entry.email.trim()) emails.add(lower(entry.email))
    for (const link of Array.isArray(entry.linkExisting) ? entry.linkExisting : []) addId(link?.memberId)
  }

  const found = new Map()
  const keep = (rows) => rows.forEach((row) => found.set(row.id, row))
  for (const chunk of chunks([...ids])) keep(await selectMembers(d1, `id IN (${marks(chunk)})`, chunk))
  for (const chunk of chunks([...emails])) keep(await selectMembers(d1, `lower(email) IN (${marks(chunk)})`, chunk))
  for (const chunk of chunks([...found.keys()])) keep(await selectMembers(d1, `guardian_id IN (${marks(chunk)})`, chunk))
  const registrationCounts = {}
  for (const chunk of chunks([...found.keys()])) {
    const { results } = await d1.query(
      `SELECT member_id, COUNT(*) AS n FROM registrations WHERE member_id IN (${marks(chunk)}) GROUP BY member_id`,
      chunk,
    )
    for (const r of results ?? []) registrationCounts[r.member_id] = Number(r.n) || 0
  }
  const kept = Array.isArray(missingAudit) ? missingAudit : []
  const audit = []
  for (const chunk of chunks([...new Set(kept.map((row) => row?.targetId).filter((id) => typeof id === 'string'))])) {
    const { results } = await d1.query(
      `SELECT id, target_member_id, action, detail FROM admin_audit_log WHERE target_member_id IN (${marks(chunk)})`,
      chunk,
    )
    audit.push(...(results ?? []))
  }
  return { members: [...found.values()], registrationCounts, audit, missingAudit: kept }
}

async function rowById(d1, id) {
  return (await selectMembers(d1, 'id = ?', [id]))[0] ?? null
}

async function accountRowsByEmail(d1, email) {
  return selectMembers(d1, "lower(email) = ? AND id NOT LIKE 'child-%' AND role != 'guest'", [email])
}

/** What the row holds now, read afresh: its US Chess ID and how many tournament entries name it. */
async function holdingsNow(d1, row) {
  const { results } = await d1.query('SELECT COUNT(*) AS n FROM registrations WHERE member_id = ?', [row.id])
  return holdingsOfRow(row, results?.[0]?.n ?? 0)
}

/** Whether the sign-in account under this email is the row's own and nobody has signed in to it yet. */
async function isUnusedAccount(auth, email, id) {
  const account = await auth.findUserByEmail(lower(email))
  return Boolean(account && account.id === id && !account.signedIn)
}

async function childrenOf(d1, guardianId) {
  const { results } = await d1.query(
    `SELECT ${MEMBER_COLUMNS} FROM members WHERE guardian_id = ? ORDER BY created_at ASC, rowid ASC`,
    [guardianId],
  )
  return results ?? []
}

// ── Writing ─────────────────────────────────────────────────────────

const CHANGED_UNDERFOOT = 'nothing was written: the row changed after it was read; run the script again'

/** Whether a guarded write changed its row. Reads the row back when the database does not say. */
async function wrote(result, readBack) {
  if (typeof result?.changes === 'number') return result.changes > 0
  return readBack()
}

const AUDIT_COLUMNS = 'id, actor_id, actor_email, action, target_member_id, target_label, detail'
/** @param {AuditRow} row */
const auditValues = (row) => [row.id, row.actorId, row.actorEmail, row.action, row.targetId, row.targetLabel, row.detail]

/** A value as SQL text: in single quotes, each single quote doubled. */
const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`

/**
 * An audit log row that is not in the table although its change was made.
 * The error carries the row, which the command line keeps beside the plan
 * for the next run to write, and the same row as a statement to run by hand,
 * dated when the change was made.
 */
class AuditRowMissing extends Error {
  /**
   * @param {string} message
   * @param {AuditRow} row
   */
  constructor(message, row) {
    super(message)
    this.row = row
    this.statement = `INSERT OR IGNORE INTO admin_audit_log (${AUDIT_COLUMNS}, created_at) VALUES (${[...auditValues(row), row.madeAt].map(sqlText).join(', ')});`
  }
}

/**
 * Inserts one admin_audit_log row and makes sure it is there. A failed insert
 * is tried once more under the same id, ignoring a row the first try wrote
 * before its answer was lost, and the row is then looked for by that id. A
 * row kept from an earlier run (dated) goes in with the time its change was
 * made, and one already written by hand under its id is left as it is.
 * Returns why the row is still missing, or null once it is in the table.
 *
 * @param {AuditRow} row
 */
async function insertAudit(d1, row, { dated = false } = {}) {
  const values = dated ? [...auditValues(row), row.madeAt] : auditValues(row)
  const into = `INTO admin_audit_log (${dated ? `${AUDIT_COLUMNS}, created_at` : AUDIT_COLUMNS}) VALUES (${marks(values)})`
  let failure
  try {
    await d1.query(`${dated ? 'INSERT OR IGNORE' : 'INSERT'} ${into}`, values)
    return null
  } catch (err) {
    failure = err
  }
  try {
    await d1.query(`INSERT OR IGNORE ${into}`, values)
  } catch {
    // Whether either try wrote the row is read next.
  }
  try {
    const { results } = await d1.query('SELECT id FROM admin_audit_log WHERE id = ? AND action = ? AND target_member_id = ?', [row.id, row.action, row.targetId])
    if (results?.length) return null
  } catch {
    // Not known, so it is reported as missing: the statement adds nothing if the row is there.
  }
  return messageOf(failure)
}

/**
 * One admin_audit_log row, as recordAdminAction writes it, with the plan's
 * source as the reason. A row still missing after insertAudit throws
 * AuditRowMissing.
 */
async function writeAudit(d1, audit, action, target, detail) {
  /** @type {AuditRow} */
  const row = {
    id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    actorId: audit.actorId,
    actorEmail: audit.actorEmail,
    action,
    targetId: target.id,
    targetLabel: label(target),
    detail: JSON.stringify({ ...detail, reason: audit.reason }),
    // When the change was made, in the form the table's own default writes.
    madeAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  }
  const failure = await insertAudit(d1, row)
  if (failure !== null) {
    throw new AuditRowMissing(
      `the change was made, but its audit log row was not written (${failure}); ` +
        'the next run with --apply writes it, or insert it by hand with the statement below',
      row,
    )
  }
}

const said = (verb, text, count = null, extra = {}) => ({ verb, text, count, ...extra })

/** Makes one operation's change, after reading its row afresh. */
async function runOp(op, ctx, { auth, d1, audit, newChildId }) {
  const memberId = () => {
    const id = op.memberId ?? ctx.memberId
    if (!id) throw new Error('the account this depends on was not made')
    return id
  }
  const guardianId = () => {
    const id = op.guardianId ?? ctx.memberId
    if (!id) throw new Error('the guardian\'s account was not made')
    return id
  }

  switch (op.type) {
    case 'create-sign-in': {
      const holders = await accountRowsByEmail(d1, op.email)
      if (holders.length > 1) throw new Error(`${holders.length} member rows now hold this email (${holders.map((r) => r.id).join(', ')}); decide by hand which one is the account`)
      if (holders.length === 1) {
        ctx.memberId = holders[0].id
        return said('SKIP', `${op.text}: the member row ${holders[0].id} already holds this email`, 'skipped')
      }
      const made = await auth.createUser({ email: op.email, fullName: op.fullName })
      /** @type {NewSignIn} */
      const person = { fullName: op.fullName, email: op.email }
      let id
      let fresh = true
      if (made && 'duplicate' in made && made.duplicate) {
        const found = await auth.findUserByEmail(op.email)
        if (!found) throw new Error('the sign-in service says this email is taken, but no account with it can be found')
        id = found.id
        fresh = !found.signedIn
      } else if (made && 'id' in made && made.id) {
        id = made.id
        // Made just now: the person is named at the end even if a later step fails.
        ctx.newSignIn = person
      } else {
        throw new Error('the sign-in service gave back no account id')
      }
      const clash = await rowById(d1, id)
      if (clash) throw new Error(`the sign-in account ${id} already has a member row, which holds ${clash.email}; settle it by hand`)
      ctx.memberId = id
      if (fresh) ctx.newSignIn = person
      const how = 'duplicate' in made ? `one already used this email, so its id ${id} is used` : `new, id ${id}`
      return said('CREATE', `${op.text} (${how})`)
    }

    case 'insert-member': {
      const id = memberId()
      const existing = await rowById(d1, id)
      if (existing) {
        if (sameState(stateOf(existing), op.to)) return said('SKIP', `${op.text}: the row ${id} already exists`, 'skipped')
        throw new Error(`the row ${id} already exists, with ${membershipWords(stateOf(existing))}; run the script again to plan from it`)
      }
      const result = await d1.query(
        `INSERT INTO members (id, email, full_name, membership_status, membership_expiry, role, membership_type)
         SELECT ?, ?, ?, ?, ?, 'member', ? WHERE NOT EXISTS (SELECT 1 FROM members WHERE id = ?)`,
        [id, op.email, op.fullName, op.to.status, op.to.expiry, op.to.type, id],
      )
      if (!(await wrote(result, async () => !!(await rowById(d1, id))))) throw new Error(CHANGED_UNDERFOOT)
      const row = await rowById(d1, id)
      // Logged as the admin membership endpoint logs a membership: from none.
      await writeAudit(d1, audit, 'membership_override', row, { from: NO_MEMBERSHIP, to: stateOf(row) })
      return said('CREATE', op.text, 'created')
    }

    case 'set-membership': {
      const id = memberId()
      const row = await rowById(d1, id)
      if (!row) throw new Error(`no member row has the id ${id}`)
      const from = stateOf(row)
      const to = { ...from, ...op.to }
      if (sameState(from, to)) return said('SKIP', membershipHeldText(op.name, from), 'skipped')
      const result = await d1.query(
        `UPDATE members SET membership_status = ?, membership_expiry = ?, membership_type = ?
          WHERE id = ? AND membership_status IS ? AND membership_expiry IS ? AND membership_type IS ?`,
        [to.status, to.expiry, to.type, id, from.status, from.expiry, from.type],
      )
      if (!(await wrote(result, async () => sameState(stateOf((await rowById(d1, id)) ?? row), to)))) throw new Error(CHANGED_UNDERFOOT)
      const after = (await rowById(d1, id)) ?? row
      await writeAudit(d1, audit, 'membership_override', after, { from, to })
      return said('UPDATE', membershipText(op.name, from, to), 'updated')
    }

    case 'rename': {
      const id = memberId()
      const row = await rowById(d1, id)
      if (!row) throw new Error(`no member row has the id ${id}`)
      if (row.full_name === op.to) return said('SKIP', `name is already "${op.to}"`, 'skipped')
      // The plan's look at the row may be stale: a family takes it over only
      // if it still holds nothing, or the entry says it is the guardian's own.
      const holds = await holdingsNow(d1, row)
      if (op.guard && !op.keeps && holdsAny(holds)) throw new Error(`nothing was written: ${renameRefusalText(row, op.to, holds, true)}`)
      const result = await d1.query('UPDATE members SET full_name = ? WHERE id = ? AND full_name = ?', [op.to, id, row.full_name])
      if (!(await wrote(result, async () => (await rowById(d1, id))?.full_name === op.to))) throw new Error(CHANGED_UNDERFOOT)
      await writeAudit(d1, audit, 'name_change', { ...row, full_name: op.to }, { from: row.full_name, to: op.to })
      return said('RENAME', renameText(id, row.full_name, op.to, holds, op.keeps), 'updated')
    }

    case 'change-email': {
      const id = memberId()
      const row = await rowById(d1, id)
      if (!row) throw new Error(`no member row has the id ${id}`)
      if (lower(row.email) === op.to) return said('SKIP', `email is already ${op.to}`, 'skipped')
      const others = (await accountRowsByEmail(d1, op.to)).filter((other) => other.id !== id)
      if (others.length) throw new Error(`${op.to} already belongs to ${others.map(label).join('; ')}`)
      const holder = await auth.findUserByEmail(op.to)
      if (holder && holder.id !== id) throw new Error(`another sign-in account (${holder.id}) already uses ${op.to}`)
      // An account nobody has signed in to (made with a placeholder email,
      // say): with a real email its owner can sign in for the first time, so
      // they go on the list of people to tell from the moment the account has
      // it. A run that stopped after moving the account's email finds the
      // account already holding the new one.
      const unused = holder ? !holder.signedIn : await isUnusedAccount(auth, row.email, id)
      if (!holder) await auth.updateEmail(id, op.to)
      if (unused) ctx.newSignIn = { fullName: op.fullName ?? row.full_name, email: op.to, moved: true }
      const result = await d1.query('UPDATE members SET email = ? WHERE id = ? AND email = ?', [op.to, id, row.email])
      if (!(await wrote(result, async () => (await rowById(d1, id))?.email === op.to))) {
        throw new Error(
          holder ? CHANGED_UNDERFOOT : `the sign-in account now has ${op.to}, but the row was not changed, because it changed after it was read; run the script again`,
        )
      }
      await writeAudit(d1, audit, 'email_change', { ...row, email: op.to }, { from: row.email, to: op.to })
      const text = holder
        ? `${row.email} to ${op.to} (${id}); the sign-in account already used it, so only the row changed`
        : emailText(id, row.email, op.to)
      return said('EMAIL', text, 'updated')
    }

    case 'insert-child': {
      const gid = guardianId()
      const guardian = await rowById(d1, gid)
      if (!guardian) throw new Error(`no member row has the id ${gid}`)
      const refused = guardianProblem(guardian)
      if (refused) throw new Error(`nothing was written: ${refused}`)
      const kids = await childrenOf(d1, gid)
      const same = kids.find((kid) => lower(kid.full_name) === lower(op.fullName))
      if (same) {
        ctx.children.set(op.childKey, same.id)
        return said('SKIP', childHeldText(op.fullName), 'skipped')
      }
      if (kids.length >= MAX_CHILDREN) throw new Error(`an account can hold at most ${MAX_CHILDREN} children`)
      const id = newChildId()
      // As /api/me/children makes one: the guardian's email and club, no membership yet.
      const result = await d1.query(
        `INSERT INTO members (id, email, full_name, membership_status, role, club_id, guardian_id)
         SELECT ?, ?, ?, 'none', 'member', ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM members WHERE guardian_id = ? AND lower(full_name) = lower(?))`,
        [id, guardian.email, op.fullName, guardian.club_id ?? null, gid, gid, op.fullName],
      )
      if (!(await wrote(result, async () => !!(await rowById(d1, id))))) throw new Error(CHANGED_UNDERFOOT)
      ctx.children.set(op.childKey, id)
      // No audit row here: the family coverage that follows logs the child's membership.
      return said('CREATE', childText(op.fullName), 'created')
    }

    case 'link-child': {
      const gid = guardianId()
      const guardian = await rowById(d1, gid)
      if (!guardian) throw new Error(`no member row has the id ${gid}`)
      const refused = guardianProblem(guardian)
      if (refused) throw new Error(`nothing was written: ${refused}`)
      const row = await rowById(d1, op.childId)
      if (!row) throw new Error(`no member row has the id ${op.childId}`)
      if (row.guardian_id === gid) return said('SKIP', linkHeldText(row), 'skipped')
      if (row.guardian_id) throw new Error(`the row is now a child of another account (${row.guardian_id})`)
      if (row.id === gid) throw new Error('that row is the guardian\'s own')
      if ((await childrenOf(d1, row.id)).length) throw new Error(`${row.full_name} has children of their own, and a guardian cannot be a child`)
      if ((await childrenOf(d1, gid)).length >= MAX_CHILDREN) throw new Error(`an account can hold at most ${MAX_CHILDREN} children`)
      const result = await d1.query('UPDATE members SET guardian_id = ? WHERE id = ? AND guardian_id IS NULL', [gid, row.id])
      if (!(await wrote(result, async () => (await rowById(d1, row.id))?.guardian_id === gid))) throw new Error(CHANGED_UNDERFOOT)
      // The guardian can now act for this account, so the link is logged.
      await writeAudit(d1, audit, 'guardian_link', { ...row, guardian_id: gid }, { guardianId: gid })
      return said('LINK', linkText(row), 'linked')
    }

    case 'cover-child': {
      const gid = guardianId()
      const childId = op.childId ?? ctx.children.get(op.childKey)
      if (!childId) throw new Error(`${op.name}'s child profile was not made`)
      const guardian = await rowById(d1, gid)
      if (!guardian || guardian.membership_status !== 'active' || guardian.membership_type !== 'family') {
        throw new Error('the guardian does not hold an active family membership')
      }
      const kids = await childrenOf(d1, gid)
      const place = kids.findIndex((kid) => kid.id === childId)
      if (place < 0) throw new Error(`${op.name} is not a child of this account`)
      const child = kids[place]
      if (place >= FAMILY_SIZE) return said('SKIP', uncoveredText(child.full_name, place + 1), 'skipped')
      const from = stateOf(child)
      const to = { status: 'active', expiry: laterDate(from.expiry, guardian.membership_expiry), type: 'family' }
      if (sameState(from, to)) return said('SKIP', coveredText(child.full_name, to), 'skipped')
      const result = await d1.query(
        `UPDATE members SET membership_status = 'active', membership_expiry = ?, membership_type = 'family'
          WHERE id = ? AND guardian_id = ? AND membership_status IS ? AND membership_expiry IS ? AND membership_type IS ?`,
        [to.expiry, childId, gid, from.status, from.expiry, from.type],
      )
      if (!(await wrote(result, async () => sameState(stateOf((await rowById(d1, childId)) ?? child), to)))) throw new Error(CHANGED_UNDERFOOT)
      await writeAudit(d1, audit, 'membership_override', child, { from, to })
      return said('COVER', coverText(child.full_name, from, to), 'updated')
    }

    case 'audit': {
      const failure = await insertAudit(d1, op.row, { dated: true })
      if (failure !== null) {
        throw new AuditRowMissing(
          `the audit log row was still not written (${failure}); it is kept for the next run with --apply, or insert it by hand with the statement below`,
          op.row,
        )
      }
      return said('AUDIT', op.text, 'audited')
    }

    default:
      throw new Error(`the script does not know the operation ${JSON.stringify(op.type)}`)
  }
}

const VERBS = {
  'create-sign-in': 'CREATE',
  'insert-member': 'CREATE',
  'set-membership': 'UPDATE',
  rename: 'RENAME',
  'change-email': 'EMAIL',
  'insert-child': 'CREATE',
  'link-child': 'LINK',
  'cover-child': 'COVER',
  audit: 'AUDIT',
}
const COUNTS = {
  'insert-member': 'created',
  'insert-child': 'created',
  'set-membership': 'updated',
  rename: 'updated',
  'change-email': 'updated',
  'link-child': 'linked',
  'cover-child': 'updated',
  audit: 'audited',
}

/** What the real run would do with one operation. Reads, never writes. */
async function previewOp(op, { auth, d1 }) {
  if (op.type === 'create-sign-in') {
    const user = await auth.findUserByEmail(op.email)
    /** @type {NewSignIn} */
    const person = { fullName: op.fullName, email: op.email }
    if (!user) return said('CREATE', `${op.text} (new, with no password until they set one)`, null, { newSignIn: person })
    const row = await rowById(d1, user.id)
    if (row) throw new Error(`a sign-in account (${user.id}) already uses this email, and its member row holds ${row.email}; settle it by hand`)
    return said('CREATE', `${op.text}: one already uses this email (${user.id}), so its id becomes the member id`, null, { newSignIn: user.signedIn ? null : person })
  }
  if (op.type === 'change-email') {
    const holder = await auth.findUserByEmail(op.to)
    if (holder && holder.id !== op.memberId) throw new Error(`another sign-in account (${holder.id}) already uses ${op.to}`)
    // As the real run decides it: an account nobody has signed in to puts its owner on the list.
    const unused = holder ? !holder.signedIn : await isUnusedAccount(auth, op.from, op.memberId)
    const newSignIn = unused ? { fullName: op.fullName, email: op.to, moved: true } : null
    if (holder) return said('EMAIL', `${op.from} to ${op.to} (${op.memberId}); the sign-in account already uses it, so only the row changes`, 'updated', { newSignIn })
    return said('EMAIL', op.text, 'updated', { newSignIn })
  }
  if (!VERBS[op.type]) throw new Error(`the script does not know the operation ${JSON.stringify(op.type)}`)
  return said(VERBS[op.type], op.text, COUNTS[op.type] ?? null)
}

/**
 * Prints the plan person by person and, with apply, makes each change.
 * A person's operations run in order; a failure stops that person only and
 * makes the exit code 1. Every write reads its row afresh first, so running
 * the same operations again writes nothing. The audit log rows an earlier
 * run could not write come first, each written on its own. At the end come
 * the audit log rows this run could not write, if any (returned as rows for
 * the command line to keep, and printed as statements), and the people given
 * a new sign-in account, or an unused one given a real email: every one of
 * them, with a note on each whose entry then failed or was refused. Each such
 * row is also handed to keepAuditRow the moment it is known, so a run stopped
 * part way has already kept it; one that cannot be kept then is said under
 * its FAIL line, and the command line tries again at the end.
 *
 * @param {Group[]} groups from buildPlan
 * @param {{ auth: AuthAdapter, d1: D1Adapter, apply?: boolean, log?: (line: string) => void, newChildId?: () => string, keepAuditRow?: (row: AuditRow) => Promise<void> }} options
 */
export async function execute(
  groups,
  { auth, d1, apply = false, log = console.log, newChildId = () => `child-${crypto.randomUUID()}`, keepAuditRow = async () => {} },
) {
  const summary = { created: 0, linked: 0, updated: 0, skipped: 0, failed: 0, audited: 0 }
  const failedPeople = []
  /** Everyone given a sign-in account to set a password for, with a note on each whose entry did not finish. */
  const newSignIns = []
  let unfinished = 0
  /** Audit log rows whose changes were made without them, and the same rows as statements to run by hand. */
  const missingAuditRows = []
  const missingAudit = []
  const line = (verb, text) => log(`   ${verb.padEnd(6)}  ${text}`)
  const details = (list) => (list ?? []).forEach((text) => log(`           ${text}`))
  /**
   * @param {NewSignIn} person
   * @param {string[]} problems what failed or was refused in the rest of the entry
   */
  const signInName = ({ fullName, email, moved }, problems) => {
    const notes = [...(moved ? ['unused sign-in account, new email'] : apply && problems.length ? ['account made'] : []), ...problems]
    return `${fullName} <${email}>${notes.length ? ` (${notes.join('; ')})` : ''}`
  }

  log(apply ? 'Writing the changes below.' : 'Dry run: nothing is written. Run again with --apply to make these changes.')
  for (const group of groups) {
    // The audit log rows kept from an earlier run belong to no one entry, and
    // one that fails does not stop the next.
    const kept = group.kind === 'audit'
    log('')
    log(kept ? `${group.person}:` : `${group.index}. ${group.kind.toUpperCase()} ${group.person}`)
    group.notes.forEach((note) => log(`   ${note}`))
    const ctx = { memberId: null, children: new Map(), newSignIn: null }
    /** What failed or was refused, for the note beside a new sign-in account. */
    const problems = []
    let failed = false
    for (const op of group.ops) {
      if (op.type === 'skip') {
        line('SKIP', op.text)
        details(op.details)
        summary.skipped++
        continue
      }
      if (op.type === 'refuse') {
        line('REFUSE', op.text)
        summary.failed++
        failed = true
        problems.push(`refused: ${op.text}`)
        continue
      }
      try {
        const outcome = apply ? await runOp(op, ctx, { auth, d1, audit: group.audit, newChildId }) : await previewOp(op, { auth, d1 })
        line(outcome.verb, outcome.text)
        details(op.details)
        if (outcome.count) summary[outcome.count]++
        if (!apply && outcome.newSignIn) ctx.newSignIn = outcome.newSignIn
      } catch (err) {
        line('FAIL', `${op.text}: ${messageOf(err)}`)
        if (err instanceof AuditRowMissing) {
          details([err.statement])
          missingAuditRows.push(err.row)
          missingAudit.push(err.statement)
          try {
            await keepAuditRow(err.row)
          } catch (keepErr) {
            details([`not yet kept for the next run (${messageOf(keepErr)}); the run tries again at the end`])
          }
        }
        summary.failed++
        failed = true
        problems.push(`${apply ? 'the rest failed' : 'the rest would fail'}: ${messageOf(err)}`)
        if (!kept) break
      }
    }
    if (failed && !kept) failedPeople.push(group.person)
    if (ctx.newSignIn) {
      newSignIns.push(signInName(ctx.newSignIn, problems))
      if (problems.length) unfinished++
    }
  }

  const s = summary
  log('')
  log(
    apply
      ? `Summary: created ${s.created}, linked ${s.linked}, updated ${s.updated}, skipped ${s.skipped}, failed ${s.failed}${s.audited ? `, audit log rows written ${s.audited}` : ''}.`
      : `Summary of the dry run, nothing written: would create ${s.created}, link ${s.linked}, update ${s.updated}` +
          `${s.audited ? `, write ${s.audited} audit log row${s.audited === 1 ? '' : 's'}` : ''}; skipped ${s.skipped}; failed ${s.failed}.`,
  )
  if (failedPeople.length) {
    log(`Failed or refused: ${failedPeople.join('; ')}. Fix the cause and run the script again; whatever already holds is skipped.`)
  }
  if (missingAudit.length) {
    log(
      `Audit log rows not written: ${missingAudit.length}. Their changes are in place; the next run with --apply writes these rows, ` +
        'or insert each one by hand with the statement printed under its FAIL line. Running a statement twice adds nothing.',
    )
  }
  if (apply) {
    log(
      newSignIns.length
        ? `New sign-in accounts, with no password yet (each person sets one with "Forgot password?" on the Log in page): ${newSignIns.join('; ')}.`
        : 'No new sign-in accounts.',
    )
    if (unfinished) {
      log(
        'Keep this list: the run that finishes an entry marked "the rest failed" or "refused" may say only that the person ' +
          'has a sign-in account already, without naming them here again.',
      )
    }
  } else if (newSignIns.length) {
    log(`Sign-in accounts the real run would make: ${newSignIns.join('; ')}.`)
  }
  return { summary, failedPeople, newSignIns, missingAudit, missingAuditRows, exitCode: s.failed > 0 ? 1 : 0 }
}

// ── The two services ────────────────────────────────────────────────

/**
 * The sign-in service, reached with the service role key, cut down to what
 * this script needs. The account list is read once, in pages of 200, and kept
 * up to date as the script changes it.
 *
 * @returns {AuthAdapter}
 */
export function supabaseAuth(client, { pageSize = 200, maxPages = 100 } = {}) {
  let byEmail = null
  const remember = (user) => byEmail?.set(lower(user.email), user)

  async function listAll() {
    const map = new Map()
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: pageSize })
      if (error) throw new Error(`could not list the sign-in accounts: ${error.message}`)
      for (const user of data.users) {
        if (user.email) map.set(lower(user.email), { id: user.id, email: user.email, signedIn: Boolean(user.last_sign_in_at) })
      }
      if (data.users.length < pageSize) return map
    }
    throw new Error(`there are more than ${maxPages * pageSize} sign-in accounts, more than this script reads`)
  }

  return {
    async findUserByEmail(email) {
      byEmail ??= await listAll()
      return byEmail.get(lower(email)) ?? null
    },
    async createUser({ email, fullName }) {
      const { data, error } = await client.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) {
        if (error.code === 'email_exists' || error.code === 'user_already_exists' || /already/i.test(error.message ?? '')) {
          byEmail = null // read the list afresh to find it
          return { duplicate: true }
        }
        throw new Error(`could not make the sign-in account: ${error.message}`)
      }
      remember({ id: data.user.id, email, signedIn: false })
      return { id: data.user.id }
    },
    async updateEmail(id, email) {
      const { error } = await client.auth.admin.updateUserById(id, { email, email_confirm: true })
      if (error) throw new Error(`could not change the sign-in account's email: ${error.message}`)
      if (byEmail) {
        const before = [...byEmail.values()].find((user) => user.id === id)
        for (const [key, user] of byEmail) if (user.id === id) byEmail.delete(key)
        remember({ id, email, signedIn: before?.signedIn ?? false })
      }
    },
  }
}

/**
 * The production database over its HTTP API, as provision-members.mjs
 * reaches it: one parameterised statement per request. Error text from the
 * API is scrubbed of the token and the account id before it is shown.
 *
 * @returns {D1Adapter}
 */
export function d1Http(fetchFn, token, account, databaseId = D1_DATABASE_ID) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${databaseId}/query`
  const scrub = (text) =>
    [[token, '[token]'], [account, '[account]']].reduce(
      (out, [secret, mask]) => (secret ? out.split(secret).join(mask) : out),
      String(text),
    )
  return {
    async query(sql, params = []) {
      let res
      try {
        res = await fetchFn(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, params }),
        })
      } catch (err) {
        throw new Error(`the database could not be reached: ${scrub(messageOf(err))}`)
      }
      const body = await res.text()
      let json
      try {
        json = JSON.parse(body)
      } catch {
        throw new Error(`the database answered HTTP ${res.status} with something other than JSON`)
      }
      if (!json.success) throw new Error(`the database refused the statement: ${scrub(JSON.stringify(json.errors ?? []))}`)
      const first = json.result?.[0]
      if (!first || first.success === false) throw new Error('the database sent back no result for the statement')
      return {
        results: first.results ?? [],
        changes: typeof first.meta?.changes === 'number' ? first.meta.changes : null,
      }
    },
  }
}

// ── Running it ──────────────────────────────────────────────────────

const USAGE = 'Usage: node scripts/apply-memberships.mjs <plan.json> [--apply]'

/** Where a run keeps the audit log rows it could not write: beside the plan, so outside the repository too. */
export function missingAuditPath(planPath) {
  return `${planPath.replace(/\.json$/i, '')}.missing-audit.json`
}

/**
 * The audit log rows an earlier run could not write, from the file kept
 * beside the plan; none when there is no file. Throws when the file holds
 * anything but a list of such rows.
 *
 * @returns {Promise<AuditRow[]>}
 */
export async function readMissingAudit(path) {
  const { existsSync, readFileSync } = await import('node:fs')
  if (!existsSync(path)) return []
  const rows = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(rows)) throw new Error('it must hold a list of audit log rows')
  rows.forEach((row, i) => {
    const problem = auditRowProblem(row)
    if (problem) throw new Error(`row ${i + 1} ${problem}`)
  })
  return rows
}

/**
 * Keeps the audit log rows a run could not write, one of each, for the next
 * run, in a file only its owner can read, since each names a member; removes
 * the file once there are none. The rows go to a file under a temporary name
 * beside it, which then takes the file's name, so the file holds either the
 * old list or the new one, whole, whenever the run stops.
 *
 * @param {AuditRow[]} rows
 */
export async function keepMissingAudit(path, rows) {
  const { renameSync, rmSync, writeFileSync } = await import('node:fs')
  const once = [...new Map(rows.map((row) => [row.id, row])).values()]
  if (!once.length) return void rmSync(path, { force: true })
  const temporary = `${path}.${process.pid}.tmp`
  try {
    writeFileSync(temporary, `${JSON.stringify(once, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporary, path)
  } catch (err) {
    rmSync(temporary, { force: true })
    throw err
  }
}

/**
 * The command line. Returns the exit code. Everything before the first read
 * of production (the Node version, the arguments, the plan file and any
 * audit log rows kept beside it, the environment) is checked first, and no
 * environment value is ever printed.
 */
export async function main(
  argv,
  { env = process.env, log = console.log, error = console.error, fetchFn = globalThis.fetch, nodeVersion = globalThis.process?.versions?.node } = {},
) {
  const tooOld = nodeVersionProblem(nodeVersion)
  if (tooOld) {
    error(tooOld)
    return 1
  }
  if (typeof FAMILY_SIZE !== 'number') {
    error(`The family size could not be read from domain/households/family.ts: ${messageOf(familyImportFailure ?? 'it gave no number')}`)
    return 1
  }
  const options = argv.filter((arg) => arg.startsWith('--'))
  const paths = argv.filter((arg) => !arg.startsWith('--'))
  const unknown = options.filter((arg) => arg !== '--apply')
  if (unknown.length || paths.length !== 1) {
    error(unknown.length ? `Unknown option ${unknown.join(', ')}. ${USAGE}` : USAGE)
    return 1
  }
  const apply = options.includes('--apply')

  const { readFileSync } = await import('node:fs')
  const { resolve, sep } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const planPath = resolve(paths[0])
  const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
  if (planPath.startsWith(repoRoot + sep)) {
    error(`The plan file ${planPath} is inside the repository. It holds people's names and emails, so move it outside the repository and run again.`)
    return 1
  }
  let plan
  try {
    plan = JSON.parse(readFileSync(planPath, 'utf8'))
    checkPlan(plan)
  } catch (err) {
    error(`The plan file ${planPath} cannot be used: ${messageOf(err)}`)
    return 1
  }
  const auditPath = missingAuditPath(planPath)
  let keptAudit
  try {
    keptAudit = await readMissingAudit(auditPath)
  } catch (err) {
    error(
      `The file ${auditPath} cannot be used: ${messageOf(err)}. It holds audit log rows an earlier run could not write; ` +
        'put it right, or move it away once each row is written by hand.',
    )
    return 1
  }

  const accountName = env.CF_ACCOUNT_ID ? 'CF_ACCOUNT_ID' : 'CLOUDFLARE_ACCOUNT_ID'
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLOUDFLARE_API_TOKEN'].filter((name) => !env[name])
  if (!env[accountName]) missing.push('CF_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID)')
  if (missing.length) {
    error(`Missing environment variable${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Set ${missing.length === 1 ? 'it' : 'them'} and run again.`)
    return 1
  }

  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const auth = supabaseAuth(client)
  const d1 = d1Http(fetchFn, env.CLOUDFLARE_API_TOKEN, env[accountName])
  const today = centralToday()

  log(`Plan file: ${planPath}`)
  log(`Source: ${plan.source.trim()}`)
  if (typeof plan.decidedByK === 'string' && plan.decidedByK.trim()) log(`Decided by K: ${plan.decidedByK.trim()}`)
  log(`Changes made in the name of: ${lower(plan.actor.email)}`)
  log(`Today in Louisiana: ${formatDate(today)}`)
  if (keptAudit.length) log(`Audit log rows kept from an earlier run: ${keptAudit.length}, in ${auditPath}.`)
  let groups
  try {
    groups = buildPlan(plan, await loadSnapshot(d1, plan, { missingAudit: keptAudit }), today)
  } catch (err) {
    error(`Stopped before any change: ${messageOf(err)}`)
    return 1
  }
  // Each audit log row this run cannot write is kept the moment it is known,
  // so a run stopped part way loses none. Until the run ends, the rows kept
  // from before stay in the file with it: one this run has written since is
  // found in the table by the next run and left out there.
  const keptSoFar = new Map(keptAudit.map((row) => [row.id, row]))
  const keepAuditRow = async (row) => {
    keptSoFar.set(row.id, row)
    await keepMissingAudit(auditPath, [...keptSoFar.values()])
  }
  const result = await execute(groups, { auth, d1, apply, log, keepAuditRow: apply ? keepAuditRow : undefined })
  if (!apply) return result.exitCode
  // What the next run is to write: the rows this run could not. A row kept
  // from before that this run wrote, or found written, is not among them.
  const keep = [...new Map(result.missingAuditRows.map((row) => [row.id, row])).values()]
  try {
    await keepMissingAudit(auditPath, keep)
  } catch (err) {
    error(
      `The audit log rows not written could not be kept in ${auditPath} (${messageOf(err)}), so the next run will not write them: ` +
        'insert each one by hand with the statement printed under its FAIL line.',
    )
    return 1
  }
  if (keep.length) log(`Kept for the next run with --apply: ${keep.length} audit log row${keep.length === 1 ? '' : 's'}, in ${auditPath}.`)
  return result.exitCode
}

/** Runs main when this file is the one node was asked to run, and not when a test imports it. */
async function runIfEntryPoint() {
  const entry = globalThis.process?.argv?.[1]
  if (!entry || !import.meta.url.startsWith('file:')) return
  const { realpathSync } = await import('node:fs')
  const { pathToFileURL } = await import('node:url')
  let entryUrl
  try {
    entryUrl = pathToFileURL(realpathSync(entry)).href
  } catch {
    return
  }
  if (entryUrl !== import.meta.url) return
  try {
    process.exit(await main(process.argv.slice(2)))
  } catch (err) {
    console.error(messageOf(err))
    process.exit(1)
  }
}

runIfEntryPoint().catch(() => {})
