// test/unit/rate-limit-boundaries.test.ts
//
// What the two guards of WS09 step 25 must stay, read from the tree: the
// limit (functions/utils/rateLimit.ts) and the spam check
// (functions/utils/spamCheck.ts). The limiter's shortest secret is the
// tokens' own; the visitor's address is read only from the header the
// platform sets, in one place; neither guard logs anything but the
// limiter's one fixed line; the spam check sends no address of the visitor;
// the one caller of the limit is the monthly check's confirm endpoint, and
// no file calls the spam check yet; and neither reads a switch.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIN_SECRET_LENGTH as LIMITER_MIN } from '../../functions/utils/rateLimit'
import { MIN_SECRET_LENGTH as TOKENS_MIN } from '../../functions/utils/tokens'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const walk = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const LIMIT = 'functions/utils/rateLimit.ts'
const SPAM = 'functions/utils/spamCheck.ts'
const CONFIRM = 'functions/api/clubs/confirm/[token].ts'
const server = [...walk('functions'), ...walk('domain'), ...walk('workers').filter((f) => !f.includes('node_modules'))].filter((f) => /\.tsx?$/.test(f))

describe('the limit and the spam check, as the tree holds them', () => {
  it('the limiter counts only with a secret as long as a token needs', () => {
    expect(LIMITER_MIN).toBe(TOKENS_MIN)
    expect(LIMITER_MIN).toBe(32)
  })

  it('reads the visitor\'s address only from the header the platform sets, and only in the limiter', () => {
    const readers = server.filter((f) => /cf-connecting-ip/i.test(codeOf(f)))
    expect(readers).toEqual([LIMIT])
    expect(codeOf(LIMIT)).toContain('export const ADDRESS_HEADER = \'CF-Connecting-IP\'')
    for (const file of server) expect(codeOf(file), file).not.toMatch(/x-forwarded-for|x-real-ip|true-client-ip|remoteip/i)
  })

  it('logs nothing but the limiter\'s one fixed line, which names no address', () => {
    expect(codeOf(SPAM)).not.toMatch(/console\./)
    expect(codeOf(LIMIT).match(/console\.\w+\([^)]*\)/g)).toEqual(['console.warn(RATE_LIMITS_MISSING_LOG)'])
  })

  it('the spam check sends the secret and the token alone', () => {
    expect(codeOf(SPAM)).toContain('body: new URLSearchParams({ secret, response: token }),')
    expect(codeOf(SPAM)).not.toMatch(/headers\.get|ADDRESS_HEADER/)
  })

  it('the callers of the limit are the confirm endpoint and the contact relay, and the relay is the one caller of the spam check', () => {
    const importsOf = (target: string) => server.filter((f) => f !== target && new RegExp(`['"][./]+(?:utils/)?${target.split('/').pop()!.replace('.ts', '')}['"]`).test(read(f)))
    // The contact relay (WS09 step 26) is the first form to call both.
    const CONTACT = 'functions/api/clubs/[id]/contact.ts'
    // Reply through LCA (WS09 step 27) calls the limit too, counted by the member, and not the spam check.
    const REPLY = 'functions/api/clubs/reply/[token].ts'
    // Moved at WS09 step 28: Suggest an update calls both, and a keeper's reply to a suggestion calls the limit alone.
    const SUGGEST = 'functions/api/clubs/[id]/reports.ts'
    const ANSWER = 'functions/api/admin/clubs/[id]/reports/[reportId].ts'
    // Moved at WS09 step 30: Suggest a club and Start a club calls both.
    const NEW_CLUB = 'functions/api/clubs/reports.ts'
    // Moved at WS09 step 31: Ask to be its named rep calls the limit alone, counted by the member and by the keepers.
    const REP = 'functions/api/clubs/[id]/rep-requests.ts'
    expect(importsOf(LIMIT).sort()).toEqual([CONTACT, CONFIRM, REPLY, SPAM, SUGGEST, ANSWER, NEW_CLUB, REP].sort())
    expect(importsOf(SPAM).sort()).toEqual([CONTACT, SUGGEST, NEW_CLUB].sort())
    expect(codeOf(CONFIRM)).toContain('const counted = await limit(context.env, context.request, LINK_LIMIT_ROUTE, { perHour: LINK_CALLS_AN_HOUR })')
    // Only once the token holds: after the forged link's refusal and before the club is read.
    const code = codeOf(CONFIRM)
    expect(code.indexOf('return refuse(LINK_FORGED, 400)\n')).toBeLessThan(code.indexOf('await limit('))
    expect(code.indexOf('await limit(')).toBeLessThan(code.indexOf('FROM clubs WHERE id = ?'))
  })

  it('neither guard reads a switch, and the secret names are read where they belong', () => {
    for (const file of [LIMIT, SPAM]) expect(codeOf(file), file).not.toMatch(/_ON\b|FEATURES|features|CLUB_EMAIL_HIDDEN|ROSTER_SHORT_NAMES/)
    expect(server.filter((f) => /\bTURNSTILE_SECRET_KEY\b/.test(codeOf(f))).sort()).toEqual(['functions/types.ts', SPAM])
  })
})
