// test/unit/mail-switches.test.ts
//
// mailLists, the switch for the LCA newsletter list and its links, has a
// server half, since the functions and the workers cannot read
// src/lib/features.ts (brief 0.2): MAIL_LISTS_ON in
// functions/utils/mail/switches.ts. The two are turned on in the same
// change, so they are held equal here in the four ways
// test/unit/creation-switch.test.ts holds CREATION_ROLES_ON to
// standingDirectors: as the modules export them; as each file writes its
// value, once, the way vite.config.ts's switchInBuild reads
// src/lib/features.ts; by the comment above the constant, which says what
// it turns on and names the switch and this file; and by the constant's
// file reading no setting of its environment, so nothing outside the code
// can turn it on.
//
// MAIL_SENDER, the service that sends every email, follows no switch: it
// changes only in a pull request of its own. It is held here as written
// once, in its one line, and assigned in no other file of the server or
// the workers.
//
// The two settings of WS16 step 2 follow no switch either: WORKERS_PLAN,
// the hosting plan the mail engine's budgets are sized for, and
// COMPLAINT_STOPS_OTHER_SENDERS, what a spam report stops besides its own
// list. Each is held as written once, with either of its values, so the
// change that follows K's word on Workers Paid and a change of the setting
// each leave this file green, and assigned in no other file.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES } from '@/lib/features'
import { COMPLAINT_STOPS_OTHER_SENDERS, MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN } from '../../functions/utils/mail/switches'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const FILE = 'functions/utils/mail/switches.ts'

/** The switch's value as src/lib/features.ts writes it: the one `name: true,` or `name: false,` line. */
function switchWritten(name: string): boolean {
  const found = [...read('src/lib/features.ts').matchAll(new RegExp(`^\\s*${name}:\\s*(true|false),`, 'gm'))]
  expect(found, `${name} is set once in src/lib/features.ts`).toHaveLength(1)
  return found[0][1] === 'true'
}

/** The constant's value as its file writes it: the one `export const NAME = true` or `= false` line. */
function constantWritten(path: string, name: string): boolean {
  const found = [...read(path).matchAll(new RegExp(`^export const ${name} = (true|false)$`, 'gm'))]
  expect(found, `${name} is set once in ${path}`).toHaveLength(1)
  return found[0][1] === 'true'
}

/** Every file of code under a folder, its own folders included, but for installed packages and build state. */
function codeUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : codeUnder(path)
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [path] : []
  })
}

/** A line that gives MAIL_SENDER a value: a declaration or an assignment, never a comparison. */
const ASSIGNS = /\bMAIL_SENDER\b(?:\s*:\s*[\w|' ]+?)?\s*=(?![=>])/

const PAIR = { feature: 'mailLists', constant: 'MAIL_LISTS_ON', file: FILE, value: MAIL_LISTS_ON } as const

describe('MAIL_LISTS_ON follows mailLists', () => {
  it('MAIL_LISTS_ON equals FEATURES.mailLists', () => {
    expect(typeof PAIR.value).toBe('boolean')
    expect(PAIR.value).toBe(FEATURES[PAIR.feature])
  })

  it('functions/utils/mail/switches.ts writes MAIL_LISTS_ON as src/lib/features.ts writes mailLists', () => {
    expect(constantWritten(PAIR.file, PAIR.constant)).toBe(switchWritten(PAIR.feature))
  })

  it('MAIL_LISTS_ON says what it turns on and names its switch and this file', () => {
    const text = read(PAIR.file)
    const at = text.indexOf(`export const ${PAIR.constant} =`)
    expect(at).toBeGreaterThan(0)
    const comment = text.slice(text.lastIndexOf('/**', at), at)
    expect(comment).toMatch(/^\/\*\*\n \* Set: /)
    expect(comment).toContain(PAIR.feature)
    expect(comment).toContain('test/unit/mail-switches.test.ts')
  })

  it('reads no setting of the environment: constants in the code alone', () => {
    expect(read(PAIR.file)).not.toMatch(/\benv\b|process\.|import\.meta/)
  })
})

describe('MAIL_SENDER, the one service that sends', () => {
  it('is written once, in the one line a cutover changes, and the module answers it', () => {
    const lines = read(FILE).split('\n').filter((line) => /\bMAIL_SENDER\b/.test(line) && ASSIGNS.test(line))
    expect(lines).toEqual(["export const MAIL_SENDER: MailSender = 'resend'"])
    expect(MAIL_SENDER).toBe('resend')
  })

  it('is given a value by no other file of the server or the workers', () => {
    const files = ['functions', 'workers'].flatMap(codeUnder)
    expect(files).toContain('functions/utils/mail/send.ts')
    expect(files).toContain('workers/daily-emails/src/index.ts')
    const others = files.filter((file) => file !== FILE && read(file).split('\n').some((line) => ASSIGNS.test(line)))
    expect(others).toEqual([])
  })

  it('tells a value given from a comparison, so the search finds what it looks for', () => {
    for (const line of ["export const MAIL_SENDER: MailSender = 'ses'", "let MAIL_SENDER = 'ses'", "MAIL_SENDER = 'resend'"]) expect(ASSIGNS.test(line), line).toBe(true)
    for (const line of ["return MAIL_LISTS_ON || (MAIL_SENDER as string) === 'ses'", 'if (MAIL_SENDER !== x) return', 'return MAIL_SENDER', "const f = () => MAIL_SENDER"]) {
      expect(ASSIGNS.test(line), line).toBe(false)
    }
  })
})

/** A line that gives the named constant a value: a declaration or an assignment, never a comparison. */
const assigns = (name: string) => new RegExp(`\\b${name}\\b(?:\\s*:\\s*[\\w|' ]+?)?\\s*=(?![=>])`)

/** The comment block right above a constant's line in the file. */
function commentAbove(name: string): string {
  const text = read(FILE)
  const at = text.indexOf(`export const ${name}`)
  expect(at, name).toBeGreaterThan(0)
  const start = text.lastIndexOf('/**', at)
  const comment = text.slice(start, at)
  expect(comment.trimEnd().endsWith('*/'), `${name}: the comment ends right above it`).toBe(true)
  return comment
}

describe('WORKERS_PLAN, the hosting plan the budgets are sized for', () => {
  it('is written once, as \'free\' or \'paid\', and the module answers what the file writes', () => {
    const found = [...read(FILE).matchAll(/^export const WORKERS_PLAN: WorkersPlan = '(free|paid)'$/gm)]
    expect(found, 'WORKERS_PLAN is set once').toHaveLength(1)
    expect(WORKERS_PLAN).toBe(found[0][1])
    expect(read(FILE).split('\n').filter((line) => assigns('WORKERS_PLAN').test(line))).toHaveLength(1)
  })

  it('names the two plans and no other in its type', () => {
    expect(read(FILE)).toMatch(/^export type WorkersPlan = 'free' \| 'paid'$/m)
  })

  it('says what it sizes and what waits for \'paid\' in a comment of its own', () => {
    const comment = commentAbove('WORKERS_PLAN')
    for (const piece of ['./plan', 'Workers Paid', 'Amazon SES', 'test/unit/mail-switches.test.ts']) expect(comment, piece).toContain(piece)
  })
})

describe('COMPLAINT_STOPS_OTHER_SENDERS, the setting for a spam report', () => {
  it('is written once, as true or false, and the module answers what the file writes', () => {
    expect(typeof COMPLAINT_STOPS_OTHER_SENDERS).toBe('boolean')
    expect(constantWritten(FILE, 'COMPLAINT_STOPS_OTHER_SENDERS')).toBe(COMPLAINT_STOPS_OTHER_SENDERS)
    expect(read(FILE).split('\n').filter((line) => assigns('COMPLAINT_STOPS_OTHER_SENDERS').test(line))).toHaveLength(1)
  })

  it('says what a report stops in a comment of its own', () => {
    const comment = commentAbove('COMPLAINT_STOPS_OTHER_SENDERS')
    for (const piece of ['spam report', 'main mailers', 'A setting', 'test/unit/mail-switches.test.ts']) expect(comment, piece).toContain(piece)
  })
})

describe('the two settings in the rest of the code', () => {
  it('are given a value by no other file of the server or the workers', () => {
    const files = ['functions', 'workers'].flatMap(codeUnder).filter((file) => file !== FILE)
    expect(files).toContain('functions/utils/mail/plan.ts')
    for (const name of ['WORKERS_PLAN', 'COMPLAINT_STOPS_OTHER_SENDERS']) {
      expect(files.filter((file) => read(file).split('\n').some((line) => assigns(name).test(line))), name).toEqual([])
    }
  })

  it('are told from a comparison by the same search, so it finds what it looks for', () => {
    expect(assigns('WORKERS_PLAN').test("export const WORKERS_PLAN: WorkersPlan = 'paid'")).toBe(true)
    expect(assigns('COMPLAINT_STOPS_OTHER_SENDERS').test('export const COMPLAINT_STOPS_OTHER_SENDERS = false')).toBe(true)
    expect(assigns('WORKERS_PLAN').test("if (WORKERS_PLAN === 'paid') return")).toBe(false)
    expect(assigns('COMPLAINT_STOPS_OTHER_SENDERS').test('if (contact.complained && COMPLAINT_STOPS_OTHER_SENDERS && !mainMailer) return')).toBe(false)
  })
})
