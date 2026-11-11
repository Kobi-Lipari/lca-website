// test/unit/mail-one-seam.test.ts
//
// Every email the site sends goes through one seam (WS16 step 1): this
// reads every .ts, .tsx, .js and .mjs file under functions/, workers/,
// domain/ and scripts/, installed packages and build state left out, and
// lists the files that name a mail service's address, Resend's
// (api.resend.com) or Amazon's (amazonaws.com). Under functions/ the one
// file is the transport, functions/utils/mail/resend.ts; WS16 step 7 adds
// Amazon SES's transport and step 8 the receiver of its reports to the
// list as they write them. Outside functions/ the only files are the two
// launch scripts, each run by hand from a terminal with a key from the
// shell, never by the site or the workers; their send halves go with
// Resend in WS16 step 12, which empties that list.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Every file of code under a folder, its own folders included, but for installed packages and build state such as .wrangler. */
function codeUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : codeUnder(path)
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [path] : []
  })
}

/** A mail service's address: Resend's API, or any of Amazon's, where SES and SNS live. */
const SERVICE = /api\.resend\.com|amazonaws\.com/

/** The transports: the only files under functions/ that may name a mail service's address. */
const TRANSPORTS = ['functions/utils/mail/resend.ts']

/** The files outside functions/ that still call Resend, each with the reason it may. */
const LAUNCH_SCRIPTS: Record<string, string> = {
  'scripts/provision-users.mjs': 'its announce command is run by hand from a terminal, with RESEND_API_KEY from the shell; its send half goes with Resend in WS16 step 12',
  'scripts/send-launch-emails.mjs': 'run by hand from a terminal, with RESEND_API_KEY from the shell; it goes with Resend in WS16 step 12',
}

const files = ['functions', 'workers', 'domain', 'scripts'].flatMap(codeUnder)
const naming = files.filter((file) => SERVICE.test(read(file)))

describe('one seam for every email', () => {
  it('reads the server, the workers, the shared rules and the scripts, so the search is not blind', () => {
    expect(files.length).toBeGreaterThan(150)
    for (const file of [
      'functions/utils/email.ts', 'functions/utils/admin/campaigns.ts', 'functions/utils/mail/send.ts', 'workers/daily-emails/src/index.ts',
      'domain/mail/addresses.ts', 'scripts/provision-users.mjs',
    ]) expect(files, file).toContain(file)
    expect(files.filter((file) => file.includes('/node_modules/') || file.includes('/.'))).toEqual([])
  })

  it('finds a mail service\'s address under functions/ in the transport alone, so the two senders of before name none', () => {
    expect(naming.filter((file) => file.startsWith('functions/'))).toEqual(TRANSPORTS)
    for (const file of ['functions/utils/email.ts', 'functions/utils/admin/campaigns.ts', 'functions/utils/mail/send.ts']) expect(read(file), file).not.toMatch(SERVICE)
  })

  it('finds none in the workers or the shared rules, and outside functions/ only in the two launch scripts, each with its reason', () => {
    expect(naming.filter((file) => file.startsWith('workers/') || file.startsWith('domain/'))).toEqual([])
    expect(naming.filter((file) => file.startsWith('scripts/')).sort()).toEqual(Object.keys(LAUNCH_SCRIPTS).sort())
    for (const [file, reason] of Object.entries(LAUNCH_SCRIPTS)) {
      expect(reason, file).toMatch(/by hand from a terminal/)
      expect(read(file), file).toContain('RESEND_API_KEY')
    }
    // No file of the server, the workers or the shared rules names either script.
    const name = /provision-users|send-launch-emails/
    expect(files.filter((file) => !file.startsWith('scripts/') && name.test(read(file)))).toEqual([])
  })

  it('the transport names Resend\'s address once, where it sends', () => {
    expect(read(TRANSPORTS[0]).match(/https:\/\/api\.resend\.com\/emails/g)).toHaveLength(1)
  })

  it('reads a mail service\'s address where one is written, so the search finds what it looks for', () => {
    for (const text of ["fetch('https://api.resend.com/emails')", 'https://email.us-east-1.amazonaws.com/v2/email/outbound-emails', 'sns.us-east-1.amazonaws.com']) {
      expect(SERVICE.test(text), text).toBe(true)
    }
    expect(SERVICE.test('noreply@louisianachess.org')).toBe(false)
  })
})
