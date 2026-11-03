// test/unit/creation-modules.test.ts
//
// The two files WS08 step 1 adds, as files: what each imports, what it
// exports and what it reads.
// - domain/events/creation.ts imports nothing from zod, domain/contracts,
//   functions/, src/ or any package, not even a type, and nothing it loads
//   at run time leaves domain/ or reaches zod, however deep the chain; it
//   names no switch in its code, so the server and the pages get the same
//   answers; its header comment, at most twelve lines, says what it decides
//   and that the database half is functions/utils/events/creation.ts.
// - functions/utils/events/creation.ts sets CREATION_ROLES_ON under the
//   comment the brief writes for it, word for word, with nothing but the
//   header comment and the imports before it; names it in code on that line
//   alone, so no function reads it for itself; and loads nothing at run
//   time that reaches the sign-in client (functions/utils/supabase.ts) or
//   functions/utils/admin/members.ts, so a worker that imports it never
//   bundles them.
// - Each name the brief gives is exported, and each function takes rolesOn
//   with no default (a default would drop it from the function's length).
// - FEES_NEED_PAYOUT_ACCOUNT is G1's title and the panel's last sentence,
//   as the brief writes them.
// - The files of the step, and the tests written for it, hold no en dash
//   or em dash, never US Chess's old initials and never a tool's name.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as rules from '../../domain/events/creation'
import * as server from '../../functions/utils/events/creation'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const RULES = 'domain/events/creation.ts'
const SERVER = 'functions/utils/events/creation.ts'

/** Every module specifier a file names: static imports, re-exports, import() and require(). */
function specifiers(source: string): string[] {
  const found: string[] = []
  const patterns = [
    /\b(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) for (const m of source.matchAll(re)) found.push(m[1])
  return found
}

/** The specifiers a file loads at run time: all but those of `import type` and `export type`, which the compiler erases. */
const runtimeSpecifiers = (source: string) => specifiers(source.replace(/\b(?:import|export)\s+type\s[^'"]*?\sfrom\s*['"][^'"]+['"]/g, ''))

/** Where a specifier leads: a file from the repo root, or `package:<name>` for a package. */
function target(from: string, spec: string): string {
  let base: string
  if (spec.startsWith('.')) base = join(dirname(join(ROOT, from)), spec)
  else if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice(2))
  else if (spec.startsWith('@domain/')) base = join(ROOT, 'domain', spec.slice('@domain/'.length))
  else return `package:${spec}`
  const file = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && statSync(f).isFile())
  return relative(ROOT, file ?? base).split('\\').join('/')
}

/** Every file and package a file loads at run time, through every file it loads in turn. */
function runtimeClosure(file: string): Set<string> {
  const seen = new Set<string>()
  const queue = [file]
  while (queue.length > 0) {
    const next = queue.shift() as string
    for (const spec of runtimeSpecifiers(read(next))) {
      const to = target(next, spec)
      if (seen.has(to)) continue
      seen.add(to)
      if (!to.startsWith('package:')) queue.push(to)
    }
  }
  return seen
}

/** The code of a file without its comments: block comments, and line comments on lines of their own. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('domain/events/creation.ts, the rules', () => {
  const source = read(RULES)

  it('names no module outside domain/, not even for a type: no zod, no contract, no server, no site, no package', () => {
    const specs = specifiers(source)
    expect(specs.length).toBeGreaterThan(0)
    for (const spec of specs) {
      const to = target(RULES, spec)
      expect(to, spec).toMatch(/^domain\//)
      expect(to, spec).not.toMatch(/^domain\/contracts(\/|$)/)
    }
  })

  it('loads nothing at run time, however deep, that leaves domain/ or reaches zod or a contract', () => {
    for (const to of runtimeClosure(RULES)) {
      expect(to).toMatch(/^domain\//)
      expect(to).not.toMatch(/^domain\/contracts(\/|$)/)
      expect(to).not.toMatch(/zod/)
    }
  })

  it('names no switch in its code: the caller hands it rolesOn', () => {
    const body = code(source)
    for (const name of ['CREATION_ROLES_ON', 'FEATURES', 'standingDirectors']) expect(body, name).not.toContain(name)
    expect(body).not.toMatch(/\benv\b|process\.|import\.meta/)
  })

  it('opens with a header comment of at most twelve lines that says what it decides and where its database half is', () => {
    const lines = source.split('\n')
    const header = lines.slice(0, lines.findIndex((l) => !l.startsWith('//')))
    expect(header.length).toBeGreaterThan(0)
    expect(header.length).toBeLessThanOrEqual(12)
    const text = header.join(' ')
    expect(text).toContain('functions/utils/events/creation.ts')
    for (const decides of [/\bcreate\b/, /\bfee\b/, /\bdirectors?\b/, /\bdelete\b/]) expect(text, String(decides)).toMatch(decides)
  })

  it('exports the brief\'s names: the grant\'s five values, the person with repClubId beside the grant, and the event', () => {
    const grant = /export type CreationGrant = ([^\n]+)/.exec(source)?.[1] ?? ''
    for (const value of ['admin', 'president', 'standing_director', 'club_rep', 'none']) expect(grant, value).toContain(`'${value}'`)
    const person = /export interface CreationPerson \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''
    for (const field of ['grant: CreationGrant', 'memberId: string', 'repClubId: string | null']) expect(person, field).toContain(field)
    const event = /export interface CreationEvent \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''
    for (const field of ['clubId: string | null', 'createdBy: string | null']) expect(event, field).toContain(field)
  })

  it.each([
    ['canCreate', 3],
    ['canChargeFees', 3],
    ['canAssignDirectors', 3],
    ['canDeleteDraft', 3],
    ['lcaAffiliateAllowed', 1],
    ['feesRaised', 2],
  ] as const)('exports %s, with no default on any of its %i parameters', (name, length) => {
    const fn = rules[name] as (...args: never[]) => unknown
    expect(typeof fn).toBe('function')
    expect(fn.length).toBe(length)
  })

  it('gives the two refusals as one line each, in plain words, ending with a full stop', () => {
    for (const words of [rules.FEES_NEED_PAYOUT_ACCOUNT, rules.LCA_RUN_ONLY]) {
      expect(typeof words).toBe('string')
      expect(words).not.toContain('\n')
      expect(words).toMatch(/^[A-Z].*\.$/)
    }
  })

  it('refuses a raised fee with G1\'s title and the panel\'s last sentence, as the brief writes them', () => {
    const spec = read('docs/redesign/REDESIGN_SPEC.md')
    const g1 = spec.split('\n').find((l) => l.includes('titled "Entry fees need a payout account first"')) ?? ''
    expect(g1).not.toBe('')
    const title = /titled "([^"]+)"/.exec(g1)?.[1] ?? ''
    const panel = /titled "[^"]+": "([^"]+)"/.exec(g1)?.[1] ?? ''
    const lastSentence = panel.slice(panel.lastIndexOf('. ') + 2)
    expect(lastSentence).toBe('Until then, your event can run at $0.')
    expect(rules.FEES_NEED_PAYOUT_ACCOUNT).toBe(`${title}. ${lastSentence}`)
  })
})

describe('functions/utils/events/creation.ts, the database half', () => {
  const source = read(SERVER)
  /** The constant as the brief writes it, comment and line, with the value the switch gives it. */
  const CONSTANT = new RegExp(
    [
      '/**',
      ' * Set: standing directors and the president may create events, a creator is written as the event\'s first director,',
      ' * a creator may delete an unpublished draft with no entries, only D24\'s list may set a fee above $0, and the LCA',
      ' * admins are told by email at the first publish of a standing director\'s event.',
      ' * Turned on with standingDirectors in src/lib/features.ts, in the same change;',
      ' * test/unit/creation-switch.test.ts holds the two equal.',
      ' */',
    ]
      .map((line) => line.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
      .join('\\n') + '\\nexport const CREATION_ROLES_ON = (?:true|false)\\n',
    'g',
  )

  it('sets CREATION_ROLES_ON once, under the comment the brief writes for it, word for word', () => {
    expect([...source.matchAll(CONSTANT)]).toHaveLength(1)
  })

  it('has nothing before the constant but its header comment and its imports', () => {
    const before = source.slice(0, source.search(CONSTANT))
    expect(before).toMatch(/^\/\/ /)
    for (const line of before.split('\n')) expect(line, line).toMatch(/^(?:\/\/.*|import (?:type )?\{[^}]*\} from '[^']+'|)$/)
  })

  it('names CREATION_ROLES_ON in its code on the line that sets it and nowhere else, so no function reads it for itself', () => {
    const lines = code(source).split('\n').filter((l) => /\bCREATION_ROLES_ON\b/.test(l))
    expect(lines).toEqual(['export const CREATION_ROLES_ON = false'.replace('false', String(server.CREATION_ROLES_ON))])
  })

  it('loads nothing at run time that reaches the sign-in client or functions/utils/admin/members.ts', () => {
    const loaded = runtimeClosure(SERVER)
    for (const banned of ['functions/utils/supabase.ts', 'functions/utils/admin/members.ts']) expect([...loaded], banned).not.toContain(banned)
    expect([...loaded].filter((to) => to.startsWith('package:@supabase'))).toEqual([])
  })

  it('the walk that says so does find the sign-in client from functions/utils/admin/members.ts', () => {
    expect([...runtimeClosure('functions/utils/admin/members.ts')]).toContain('functions/utils/supabase.ts')
  })

  it('exports GrantMember as the member\'s id, role and club_id', () => {
    expect(source).toContain('export type GrantMember = Pick<MemberRow, \'id\' | \'role\' | \'club_id\'>')
  })

  it.each([
    ['holdsPresidentSeat', 2],
    ['creationGrant', 3],
    ['creationPerson', 3],
    ['creatorGrant', 3],
  ] as const)('exports %s, with no default on any of its %i parameters', (name, length) => {
    const fn = server[name] as (...args: never[]) => unknown
    expect(typeof fn).toBe('function')
    expect(fn.length).toBe(length)
  })

  it('exports CREATION_ROLES_ON as a boolean', () => {
    expect(typeof server.CREATION_ROLES_ON).toBe('boolean')
  })
})

describe('the plain-language rules over the step\'s files and the tests written for it', () => {
  /** An en dash or an em dash, written by code so that this file holds neither. */
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  /** US Chess's old initials, put together so that this file does not hold them. */
  const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
  /** The tools no file names, split up so that this file does not name them either. */
  const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
  /** The two letters on their own. */
  const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)

  const FILES = [
    RULES,
    SERVER,
    'test/unit/creation-rules.test.ts',
    'test/unit/creation-switch.test.ts',
    'test/unit/features.test.ts',
    'test/unit/redesign-status-ws08-step1.test.ts',
    'test/unit/creation-rules-matrix.test.ts',
    'test/unit/creation-fees-raised.test.ts',
    'test/unit/creation-modules.test.ts',
    'test/unit/redesign-status-ws08-step1-claims.test.ts',
    'test/integration/creation-grant.test.ts',
  ]

  it.each(FILES)('%s', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(OLD_INITIALS)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(BARE)
  })
})
