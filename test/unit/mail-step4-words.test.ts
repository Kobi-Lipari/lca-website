// test/unit/mail-step4-words.test.ts
//
// The plain-language and secrecy rules for the files WS16 step 4 wrote or
// changed, read over the files as they are, and the words of the newsletter's
// answers held as literal strings, so a change to one of them turns this red
// whatever the code that imports it says: no em or en dash, no old initials
// for US Chess, no name of a tool or an assistant, in code, copy or tests; no
// postal address in what an email carries; the newsletter's sender written
// once, in domain/mail/addresses.ts; no log line in the new code that could
// carry an address, a token or a contact id; and the audit detail naming a
// campaign, a count and the list, never an address. Nothing here makes a
// request or reads an environment.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_REPLY_TO, LIST_SENDERS } from '../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import {
  LINK_KEY_DIFFERS_WORDS, MAIL_KEY_MISSING_WORDS, NO_CLEAR_ANSWER_WORDS, NO_LINK_WORDS, NO_LIST_SENDER_WORDS, WRITTEN_OFF_WORDS,
} from '../../functions/utils/admin/campaigns'
import { STOPPED_WORDS } from '../../functions/utils/mail/lists'
import { ALREADY_SENDING, LINK_KEY_MISSING, NOBODY_ON_THE_LIST, NOTHING_SENDING, WAITS_FOR_SES } from '../../functions/utils/mail/newsletterAnswers'
import { GATE_UNREAD_WORDS, REFUSAL_WORDS, WAIT_FOR_SES_WORDS } from '../../functions/utils/mail/send'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const SOURCE = [
  'domain/mail/addresses.ts', 'domain/contracts/mail.ts', 'domain/contracts/registry.ts', 'functions/utils/mail/plan.ts', 'functions/utils/mail/lists.ts',
  'functions/utils/mail/newsletterAnswers.ts', 'functions/utils/admin/audit.ts',
  'functions/api/admin/mail/newsletter.ts', 'functions/api/admin/mail/newsletter/test.ts', 'functions/api/admin/mail/newsletter/stop.ts',
]
/**
 * Files older than this step that it changed, each with the part it wrote, from one marker to another (or the end of
 * the file): the rest of each holds words from before, some with the dashes this step's rule is not applied back to.
 */
const CHANGED_PARTS: ReadonlyArray<readonly [file: string, from: string, to: string | null]> = [
  ['functions/utils/admin/campaigns.ts', '// functions/utils/admin/campaigns.ts', "import { DEFAULT_FROM"],
  ['functions/utils/admin/campaigns.ts', "// ── Under the engine's rules", ' * How long the request path keeps working'],
  ['functions/utils/admin/campaigns.ts', " * The request path under the engine's rules", ' * Finishes any campaign that still has work left.'],
  ['functions/utils/admin/campaigns.ts', " * The sweep under the engine's rules", null],
  ['functions/utils/auth.ts', ' * The 403 an LCA admin gets when the session carries no second factor', '// ── LCA Observer and LCA Officer'],
  ['functions/utils/auth.ts', ' * The people who may send the LCA newsletter', ' * Adding, editing and removing governance documents'],
]
const TESTS = [
  'test/integration/newsletter.test.ts', 'test/integration/newsletter-edges.test.ts', 'test/integration/campaigns-once.test.ts',
  'test/integration/campaignRuns.ts', 'test/integration/contracts/newsletter.test.ts', 'test/unit/mail-plan.test.ts',
  'test/unit/mail-step4-words.test.ts', 'test/unit/redesign-status-ws16-step4.test.ts',
]

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gemi' + 'ni'].join('|')})\\b`, 'i')
const POSTAL = /\bP\.?\s?O\.?\s+Box\b|\bSuite\s+\d|\b\d{5}(?:-\d{4})?\b(?=.*\b(?:LA|Louisiana)\b)/i

/** Every .ts and .tsx file under a folder, as paths from the root, skipping what no deploy reads. */
function sourceFiles(folder: string): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name === '.git') continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.tsx?$/.test(name)) found.push(relative(ROOT, path))
    }
  }
  walk(join(ROOT, folder))
  return found
}

describe('the files of WS16 step 4', () => {
  it.each([...SOURCE, ...TESTS])('%s exists and holds no em or en dash, no old initials for US Chess and no tool\'s name', (file) => {
    expect(existsSync(join(ROOT, file)), file).toBe(true)
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(OLD_INITIALS)
    expect(text).not.toMatch(TOOLS)
  })

  it.each(CHANGED_PARTS)('%s, from "%s", holds no em or en dash, no old initials for US Chess and no tool\'s name in what this step wrote', (file, from, to) => {
    const text = read(file)
    const start = text.indexOf(from)
    expect(start, from).toBeGreaterThan(-1)
    const end = to === null ? text.length : text.indexOf(to, start + 1)
    expect(end, String(to)).toBeGreaterThan(start)
    const part = text.slice(start, end)
    expect(part).not.toMatch(DASHES)
    expect(part).not.toMatch(OLD_INITIALS)
    expect(part).not.toMatch(TOOLS)
  })

  it('writes the worker\'s two link keys on its Env type, and the lines that name them hold no dash', () => {
    const lines = read('workers/daily-emails/src/index.ts').split('\n').filter((line) => /MAIL_LINK_SECRET/.test(line))
    expect(lines.length).toBeGreaterThanOrEqual(2)
    for (const line of lines) expect(line).not.toMatch(DASHES)
  })

  it('writes a postal address nowhere: not in the words the newsletter\'s answers and sends carry, and not in the sender\'s file', () => {
    for (const file of ['functions/utils/mail/newsletterAnswers.ts', 'domain/mail/addresses.ts', 'functions/utils/admin/campaigns.ts', 'functions/utils/mail/lists.ts']) {
      expect(read(file), file).not.toMatch(POSTAL)
    }
  })
})

describe('the newsletter\'s words, as the entry gives them', () => {
  it('the send\'s refusals and the stop\'s, word for word', () => {
    expect(WAITS_FOR_SES).toBe('The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test.')
    expect(LINK_KEY_MISSING).toBe('Not sent: the mail link key is missing on this deployment.')
    expect(NOBODY_ON_THE_LIST).toBe('Nobody is on the newsletter list right now.')
    expect(ALREADY_SENDING).toBe('The newsletter is already sending. Wait for it to finish.')
    expect(NOTHING_SENDING).toBe('No newsletter is sending.')
  })

  it('what a recipient\'s row and the history say, word for word', () => {
    expect(STOPPED_WORDS).toBe('Not sent: the send was stopped.')
    expect(WRITTEN_OFF_WORDS).toBe('Not sent again: the mail service may have taken it, and a second try could send it twice.')
    expect(NO_CLEAR_ANSWER_WORDS).toBe('No clear answer from the mail service; not sent again so it cannot arrive twice.')
    expect(LINK_KEY_DIFFERS_WORDS).toBe('Not sent yet: the link key on this deployment is not the one this email was made with.')
    expect(MAIL_KEY_MISSING_WORDS).toBe('Not sent yet: the mail key is missing on this deployment.')
    expect(GATE_UNREAD_WORDS).toBe('Not sent yet: the do-not-send list could not be read.')
    expect(WAIT_FOR_SES_WORDS).toBe('Not sent yet: list mail goes out through Amazon SES only.')
    expect(REFUSAL_WORDS.do_not_send).toBe('Not sent: this address no longer receives mail.')
    expect(REFUSAL_WORDS.opted_out).toBe('Not sent: this person turned this email off.')
  })

  it('every one of them is plain: a sentence of its own, ending in a full stop, naming no address, token or tool', () => {
    const words = [
      WAITS_FOR_SES, LINK_KEY_MISSING, NOBODY_ON_THE_LIST, ALREADY_SENDING, NOTHING_SENDING, STOPPED_WORDS, WRITTEN_OFF_WORDS, NO_CLEAR_ANSWER_WORDS,
      LINK_KEY_DIFFERS_WORDS, MAIL_KEY_MISSING_WORDS, NO_LIST_SENDER_WORDS, NO_LINK_WORDS, GATE_UNREAD_WORDS, WAIT_FOR_SES_WORDS, ...Object.values(REFUSAL_WORDS),
    ]
    for (const sentence of words) {
      expect(sentence, sentence).toMatch(/[.]$/)
      expect(sentence, sentence).not.toMatch(/@|https?:|[0-9a-f]{16}/)
      expect(sentence, sentence).not.toMatch(DASHES)
      expect(sentence, sentence).not.toMatch(OLD_INITIALS)
      expect(sentence, sentence).not.toMatch(TOOLS)
    }
  })
})

describe('the newsletter\'s sender', () => {
  it('is Louisiana Chess Association <newsletter@news.louisianachess.org>, keyed by the list\'s id, with no other list written yet', () => {
    expect(LIST_SENDERS[NEWSLETTER_LIST_ID]).toEqual({ from: 'newsletter@news.louisianachess.org', name: 'Louisiana Chess Association' })
    expect(Object.keys(LIST_SENDERS)).toEqual([NEWSLETTER_LIST_ID])
  })

  it('is written once in the code a deploy reads: domain/mail/addresses.ts, marked as decided by K on Wednesday, November 11, 2026, and no other file spells it', () => {
    const spelled = [...sourceFiles('functions'), ...sourceFiles('domain'), ...sourceFiles('src'), ...sourceFiles('workers')].filter((file) => /newsletter@news\.louisianachess\.org/.test(read(file)))
    expect(spelled).toEqual(['domain/mail/addresses.ts'])
    const comment = read('domain/mail/addresses.ts')
    expect(comment).toMatch(/decided by K|K decided/)
    expect(comment).toContain('Wednesday, November 11, 2026')
    // Where replies go is still open: no new reply address is written, and replies keep going where Group email's go.
    expect(DEFAULT_REPLY_TO).toBe('LouisianaChess@gmail.com')
    expect([...new Set(read('domain/mail/addresses.ts').match(/@[a-z.]+\.(?:org|com)/g))].sort()).toEqual(['@gmail.com', '@louisianachess.org', '@news.louisianachess.org'].sort())
  })
})

describe('what the new code may print or record', () => {
  it('has no log line in the newsletter\'s files, and the one in the campaign sender is the gate\'s constant', () => {
    for (const file of ['functions/utils/mail/lists.ts', 'functions/utils/mail/newsletterAnswers.ts', 'functions/api/admin/mail/newsletter.ts', 'functions/api/admin/mail/newsletter/test.ts', 'functions/api/admin/mail/newsletter/stop.ts']) {
      expect(read(file), file).not.toMatch(/\bconsole\./)
    }
    const calls = read('functions/utils/admin/campaigns.ts').match(/console\.\w+\([^)]*\)/g) ?? []
    expect(calls).toEqual(['console.warn(GATE_UNREAD_LOG)'])
  })

  it('records the send and the stop with a campaign, a count and the list, and no address, token or contact id', () => {
    const send = read('functions/api/admin/mail/newsletter.ts')
    expect(send).toContain("action: 'group_email_sent'")
    expect(send).toContain('detail: { campaign_id: made.campaignId, recipients: made.totalRecipients, list: NEWSLETTER_LIST_ID }')
    const stop = read('functions/api/admin/mail/newsletter/stop.ts')
    expect(stop).toContain("action: 'group_email_stopped'")
    expect(stop).toContain('detail: { campaign_id: sending.id, stopped }')
    for (const source of [send, stop]) {
      expect(source).not.toMatch(/detail:[^\n]*(?:email|address|token|contact)/i)
    }
  })
})
