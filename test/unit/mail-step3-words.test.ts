// test/unit/mail-step3-words.test.ts
//
// The plain-language and secrecy rules for the files WS16 step 3 wrote or
// changed, read over the files as they are: no em or en dash, no old
// initials for US Chess, no name of a tool or an assistant, in code, copy or
// tests; no postal address in the words an email carries; and the links' key
// named only where it is read or bound, never in a setting file a deploy
// reads, in the worker's folder but its Env type (since WS16 step 4, whose
// sweep sends list mail) or in a file that holds a value for it other than
// the integration harness's own made-up string. Nothing here makes a
// request or reads an environment.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const SOURCE = [
  'functions/utils/mail/links.ts', 'functions/utils/mail/footer.ts', 'functions/utils/mail/lists.ts', 'functions/utils/mail/linkAnswers.ts',
  'functions/utils/mail/send.ts', 'functions/utils/mail/resend.ts', 'functions/utils/mail/rules.ts', 'functions/utils/mail/gate.ts', 'functions/utils/mail/outcome.ts',
  'functions/api/mail/unsubscribe/[token].ts', 'functions/api/mail/preferences/[token].ts',
  'domain/mail/footer.ts', 'domain/contracts/mail.ts', 'domain/mail/address.ts',
]
const TESTS = [
  'test/unit/mail-links.test.ts', 'test/unit/mail-footer.test.ts', 'test/unit/mail-contract-schemas.test.ts', 'test/unit/mail-link-files-closure.test.ts',
  'test/unit/mail-step3-words.test.ts', 'test/unit/redesign-status-ws16-step3.test.ts', 'test/integration/mail-email-choices.test.ts',
  'test/integration/mail-email-choices-edges.test.ts', 'test/integration/contracts/mail-links.test.ts',
]

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gemi' + 'ni'].join('|')})\\b`, 'i')

describe('the files of WS16 step 3', () => {
  it.each([...SOURCE, ...TESTS])('%s exists and holds no em or en dash, no old initials for US Chess and no tool\'s name', (file) => {
    expect(existsSync(join(ROOT, file)), file).toBe(true)
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(OLD_INITIALS)
    expect(text).not.toMatch(TOOLS)
  })

  it('keeps the dashes of the two-day date range, which 764f32f\'s layout already wrote, out of the new list footer: its function and the line renderEmail adds hold none', () => {
    const text = read('functions/utils/emailLayout.ts')
    const start = text.indexOf('export function emailListFooter')
    expect(start).toBeGreaterThan(-1)
    const body = text.slice(start, text.indexOf('\n}\n', start) + 3)
    expect(body.length).toBeGreaterThan(50)
    expect(body).not.toMatch(DASHES)
    expect(text).not.toMatch(OLD_INITIALS)
    expect(text).not.toMatch(TOOLS)
    expect(text.split('\n').filter((line) => /listFooter/.test(line) && DASHES.test(line))).toEqual([])
  })

  it('writes no sender address of its own: the only address a test send goes from is DEFAULT_FROM, and no file here spells one', () => {
    for (const file of SOURCE.filter((f) => f !== 'functions/utils/mail/send.ts' && f !== 'functions/utils/mail/resend.ts')) {
      const code = read(file).split('\n').filter((line) => !/^\s*(?:\/\/|\/\*\*|\*)/.test(line)).join('\n')
      expect(code, file).not.toMatch(/[\w.-]+@louisianachess\.org/)
    }
    for (const file of ['functions/utils/mail/send.ts', 'functions/utils/mail/resend.ts']) {
      const code = read(file).split('\n').filter((line) => !/^\s*(?:\/\/|\/\*\*|\*)/.test(line)).join('\n')
      expect(code, file).not.toMatch(/@louisianachess\.org/)
    }
  })
})

/** Every file under a folder, skipping what a build or an install makes. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (['node_modules', '.git', 'dist', '.wrangler', 'test-results', 'playwright-report'].includes(name)) continue
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

describe('the links\' key', () => {
  it('is named in no setting file a deploy reads and no environment file but the worker\'s comment, and in the worker\'s code only by its Env type, as two optional secrets', () => {
    const settings = ['wrangler.toml', '.dev.vars', '.dev.vars.example', '.dev.vars.a11y', '.env', '.env.example', '.env.local']
    for (const file of settings.filter((f) => existsSync(join(ROOT, f)))) expect(read(file), file).not.toMatch(/MAIL_LINK_SECRET/)
    // Since WS16 step 4 the sweep sends list mail, so the worker's Env type names the two keys K sets on it as secrets;
    // since checkpoint M's review the worker's settings name the key once more, in their comment's secret put line, and
    // give it no value; no other file of the worker's folder names either.
    const naming = walk('workers').filter((f) => /\.(?:ts|toml|json|md|js)$/.test(f)).filter((f) => /MAIL_LINK_SECRET/.test(read(f)))
    expect(naming).toEqual(['workers/daily-emails/src/index.ts', 'workers/daily-emails/wrangler.toml'])
    expect(read('workers/daily-emails/wrangler.toml').split('\n').filter((line) => /MAIL_LINK_SECRET/.test(line))).toEqual([
      '#   npx wrangler secret put MAIL_LINK_SECRET --config workers/daily-emails/wrangler.toml',
    ])
    const worker = read('workers/daily-emails/src/index.ts')
    expect(worker.split('\n').filter((line) => /MAIL_LINK_SECRET/.test(line) && !/^\s*(?:\/\/|\/\*\*|\*)/.test(line)).map((line) => line.trim())).toEqual([
      'MAIL_LINK_SECRET?: string',
      'MAIL_LINK_SECRET_PREVIOUS?: string',
    ])
  })

  it('is given a value in one file only, the integration config\'s made-up string, and the browser tests bind both names empty', () => {
    const config = read('vitest.integration.config.ts')
    const value = /MAIL_LINK_SECRET:\s*'([^']+)'/.exec(config)?.[1]
    expect(value).toMatch(/made-up/)
    const holders = [...walk('functions'), ...walk('domain'), ...walk('src'), ...walk('test'), ...walk('workers'), ...walk('migrations')]
      .filter((f) => /\.(?:ts|tsx|json|toml|sql|md|js)$/.test(f))
      .filter((f) => read(f).includes(value as string))
    expect(holders).toEqual([])
    const setup = read('test/a11y/global-setup.ts')
    const empty = /A11Y_EMPTY_SECRETS\s*=\s*\[([\s\S]*?)\]/.exec(setup)?.[1] ?? ''
    expect(empty).toContain("'MAIL_LINK_SECRET'")
    expect(empty).toContain("'MAIL_LINK_SECRET_PREVIOUS'")
  })

  it('is named only by the link signer, the footer, the endpoints\' shared answers, the unsubscribe answer, the list path, the newsletter\'s send and test, and the Env type, which says both names are optional production secrets', () => {
    const readers = walk('functions').filter((f) => /MAIL_LINK_SECRET/.test(read(f))).map((f) => relative('', f)).sort()
    // WS16 step 4 adds the list path in the campaign sender, which checks the key a list campaign was made with, and the
    // newsletter's send and test send, which refuse to start without it.
    expect(readers).toEqual([
      'functions/api/admin/mail/newsletter.ts', 'functions/api/admin/mail/newsletter/test.ts',
      'functions/api/mail/unsubscribe/[token].ts', 'functions/types.ts', 'functions/utils/admin/campaigns.ts', 'functions/utils/mail/footer.ts',
      'functions/utils/mail/linkAnswers.ts', 'functions/utils/mail/links.ts',
    ])
    const types = read('functions/types.ts')
    expect(types).toMatch(/MAIL_LINK_SECRET\?: string/)
    expect(types).toMatch(/MAIL_LINK_SECRET_PREVIOUS\?: string/)
  })
})
