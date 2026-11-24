// test/integration/newsletter-templates-edges.test.ts
//
// The edges of saved templates on the newsletter's own page, through the real
// handlers on the D1 database built from the migrations, beside
// newsletter-templates.test.ts: two writers at once, the name at and past its
// length, of spaces, on two lines, with an emoji and with markup, the 40th and
// 41st, a body at the size limit, words the cleaner changes, a removed name
// used again, a start from a template removed a moment ago, the page switched
// off part way, and a writer who loses the seat part way.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LETTER_MAX_BYTES, defaultSubject } from '../../domain/mail/letter'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestPost as startPost } from '../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet } from '../../functions/api/admin/mail/newsletter/issues'
import {
  onRequestDelete as templatesDelete,
  onRequestGet as templatesGet,
  onRequestPost as templatesPost,
  onRequestPut as templatesPut,
} from '../../functions/api/admin/mail/newsletter/templates'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { TEMPLATES_FULL, TEMPLATES_MAX, TEMPLATE_CHANGED, saveIssue, startIssue, templateNameTaken } from '../../functions/utils/mail/issues'
import { seedAdmin, seedMember, seedPresident, seedSeat } from './factories'
import { invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ pageOn: true, listsOn: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_PAGE_ON() {
      return flags.pageOn
    },
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
  }
})

type Row = Record<string, unknown>
type Template = { id: string; name: string; savedAt: string; by: string | null; version: number }

const MONTH = 'December 2026'
const WORDS = '<h2>Sample heading one</h2><p>Sample words to keep.</p>'
const db = () => env.DB
const rows = async () => (await env.DB.prepare('SELECT * FROM newsletter_issues ORDER BY rowid').all<Row>()).results
const rowOf = async (id: string) => (await env.DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(id).first<Row>())!
const fieldRefusal = (words: string) => ({ error: 'Some fields are missing or not valid.', fields: { name: words } })

const post = (as: string, body: unknown) => invoke(templatesPost, { method: 'POST', as, body })
const put = (as: string, body: unknown) => invoke(templatesPut, { method: 'PUT', as, body })
const del = (as: string, body: unknown) => invoke(templatesDelete, { method: 'DELETE', as, body })
const list = async (as: string) => (await (await invoke(templatesGet, { as })).json<{ templates: Template[] }>()).templates
async function saved(as: string, name: string, bodyHtml = WORDS): Promise<Template> {
  const res = await post(as, { name, bodyHtml })
  expect(res.status, name).toBe(201)
  return (await res.json<{ template: Template }>()).template
}
async function openLetter(by: string) {
  const result = await saveIssue(db(), { listId: NEWSLETTER_LIST_ID, id: null, version: 0, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: 'Sample preview line', bodyHtml: WORDS, by })
  if (!('saved' in result)) throw new Error('the open letter was not saved')
  return result.saved
}

let seq = 0
const person = (fullName: string, role = 'member') => seedMember({ fullName, email: `edge-${++seq}@templates.test.lca`, role })

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.listsOn = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('two writers at once', () => {
  it('C1: a rename made while another writer\'s chooser is open leaves that writer\'s rename refused with who and when, and nothing changed', async () => {
    const one = await person('Player One', 'lca_observer')
    await seedPresident(one)
    const two = await seedAdmin()
    const template = await saved(one, 'Sample shared')
    const seenByTwo = (await list(two))[0]!
    expect((await put(one, { id: template.id, version: 1, name: 'Sample renamed' })).status).toBe(200)
    const late = await put(two, { id: seenByTwo.id, version: seenByTwo.version, name: 'Sample late' })
    expect(late.status).toBe(409)
    expect(await late.json()).toEqual({ error: TEMPLATE_CHANGED, changedBy: 'Player One', changedAt: expect.any(String) })
    expect((await rowOf(template.id)).pinned_name).toBe('Sample renamed')
    // A start from it still works by id: the chooser's stale name does not matter to the words.
    const started = await invoke(startPost, { method: 'POST', as: two, body: { from: { templateId: seenByTwo.id }, monthLabel: MONTH } })
    expect(started.status).toBe(201)
  })

  it('C2: a remove made while another writer\'s chooser is open leaves that writer\'s rename, remove and start not found, and nothing written', async () => {
    const one = await person('Player One', 'lca_observer')
    await seedPresident(one)
    const two = await seedAdmin()
    const template = await saved(one, 'Sample going')
    const seenByTwo = (await list(two))[0]!
    expect((await del(one, { id: template.id, version: 1 })).status).toBe(200)
    const before = await rows()
    expect((await put(two, { id: seenByTwo.id, version: 1, name: 'Sample late' })).status).toBe(404)
    expect((await del(two, { id: seenByTwo.id, version: 1 })).status).toBe(404)
    expect((await invoke(startPost, { method: 'POST', as: two, body: { from: { templateId: seenByTwo.id }, monthLabel: MONTH } })).status).toBe(404)
    expect(await rows()).toEqual(before)
  })

  it('C3: a name one writer just took is refused to the other in words, in turn and when both save at the same moment', async () => {
    const one = await person('Player One', 'lca_observer')
    await seedPresident(one)
    const two = await seedAdmin()
    await saved(one, 'Sample taken')
    const late = await post(two, { name: 'sample TAKEN', bodyHtml: WORDS })
    expect([late.status, (await late.json<{ error: string }>()).error]).toEqual([409, templateNameTaken('Sample taken')])

    const both = await Promise.all([post(one, { name: 'Sample race', bodyHtml: WORDS }), post(two, { name: 'Sample race', bodyHtml: WORDS })])
    expect(both.map((res) => res.status).sort()).toEqual([201, 409])
    expect((await list(one)).filter((t) => t.name === 'Sample race')).toHaveLength(1)
  })
})

describe('the name', () => {
  it('C4: saves a name of 60 characters and refuses one of 61 in words, writing nothing', async () => {
    const admin = await seedAdmin()
    const sixty = `Sample ${'n'.repeat(53)}`
    expect(sixty).toHaveLength(60)
    expect((await saved(admin, sixty)).name).toBe(sixty)
    const res = await post(admin, { name: `${sixty}x`, bodyHtml: WORDS })
    expect([res.status, await res.json()]).toEqual([400, fieldRefusal('Keep the template\'s name to 60 characters.')])
    expect(await rows()).toHaveLength(1)
  })

  it('C5 and C6: refuses a name of spaces alone and a name on two lines, in words, writing nothing', async () => {
    const admin = await seedAdmin()
    const spaces = await post(admin, { name: '    ', bodyHtml: WORDS })
    expect([spaces.status, await spaces.json()]).toEqual([400, fieldRefusal('Write a name for the template.')])
    for (const name of ['Sample\nname', 'Sample\r\nname', 'Sample\tname']) {
      const res = await post(admin, { name, bodyHtml: WORDS })
      expect([res.status, await res.json()], JSON.stringify(name)).toEqual([400, fieldRefusal('Write the template\'s name on one line, with no line break, tab or other hidden character.')])
    }
    expect(await rows()).toEqual([])
  })

  it('C7: keeps an emoji written as two units whole, and counts it as one character of the 60', async () => {
    const admin = await seedAdmin()
    const name = `Sample ${'e'.repeat(51)}\u{1F600}`
    expect(name).toHaveLength(60)
    const template = await saved(admin, name)
    expect(template.name).toBe(name)
    expect((await rowOf(template.id)).pinned_name).toBe(name)
    expect((await list(admin))[0]!.name.codePointAt(58)).toBe(0x1f600)
    // Sixty characters to a reader (61 units): saved, as the rule says "at most 60 characters".
    const sixty = `Sample ${'f'.repeat(52)}\u{1F600}`
    expect([...sixty]).toHaveLength(60)
    expect((await saved(admin, sixty)).name).toBe(sixty)
    // Sixty-one characters: refused in words.
    const over = await post(admin, { name: `Sample ${'g'.repeat(53)}\u{1F600}`, bodyHtml: WORDS })
    expect([over.status, await over.json()]).toEqual([400, fieldRefusal('Keep the template\'s name to 60 characters.')])
  })

  it('C8: keeps a name with markup in it as plain text, never as markup', async () => {
    const admin = await seedAdmin()
    const name = '<b>Sample</b> <img src=x onerror=alert(1)>'
    const template = await saved(admin, name)
    expect(template.name).toBe(name)
    expect((await list(admin))[0]!.name).toBe(name)
  })

  it('C12: saves a removed template\'s name again, the removed row kept as it was', async () => {
    const admin = await seedAdmin()
    const first = await saved(admin, 'Sample again')
    expect((await del(admin, { id: first.id, version: 1 })).status).toBe(200)
    const removed = await rowOf(first.id)
    const second = await saved(admin, 'sample AGAIN')
    expect(second.id).not.toBe(first.id)
    expect((await list(admin)).map((t) => t.name)).toEqual(['sample AGAIN'])
    expect(await rowOf(first.id)).toEqual(removed)
    // Renaming the new one to its own name, in another case, is not a clash with itself.
    expect((await put(admin, { id: second.id, version: 1, name: 'Sample Again' })).status).toBe(200)
  })
})

describe('the limits and the words', () => {
  it('C9: saves the 40th, refuses the 41st in words, and saves it once one is removed', async () => {
    const admin = await seedAdmin()
    let last: Template | undefined
    for (let n = 1; n <= TEMPLATES_MAX; n += 1) last = await saved(admin, `Sample ${n}`)
    expect(await list(admin)).toHaveLength(TEMPLATES_MAX)
    const full = await post(admin, { name: 'Sample 41', bodyHtml: WORDS })
    expect([full.status, (await full.json<{ error: string }>()).error]).toEqual([409, TEMPLATES_FULL])
    expect((await del(admin, { id: last!.id, version: 1 })).status).toBe(200)
    expect((await saved(admin, 'Sample 41')).name).toBe('Sample 41')
    expect(await list(admin)).toHaveLength(TEMPLATES_MAX)
  })

  it('C10: saves a body of exactly the size limit and refuses one byte more with 413', async () => {
    const admin = await seedAdmin()
    const at = `<p>${'s'.repeat(LETTER_MAX_BYTES - 7)}</p>`
    expect(new TextEncoder().encode(at).length).toBe(LETTER_MAX_BYTES)
    const template = await saved(admin, 'Sample at the limit', at)
    expect((await rowOf(template.id)).body_html).toBe(at)
    const over = await post(admin, { name: 'Sample over', bodyHtml: `<p>${'s'.repeat(LETTER_MAX_BYTES - 6)}</p>` })
    expect(over.status).toBe(413)
    expect(await rows()).toHaveLength(1)
  })

  it('C11: stores words the cleaner changes as the cleaner leaves them, and the open letter as it was', async () => {
    const admin = await seedAdmin()
    const open = await openLetter(admin)
    const before = await rowOf(open.id)
    const template = await saved(admin, 'Sample cleaned', '<p>Sample <script>steal()</script><a href="javascript:steal()">link</a> <span style="color:red">kept</span></p>')
    const body = String((await rowOf(template.id)).body_html)
    expect(body).not.toMatch(/script|javascript|style|span/i)
    expect(body).toContain('kept')
    expect(await rowOf(open.id)).toEqual(before)
  })

  it('A9: lists a real past newsletter under the last newsletters beside saved templates, and no template', async () => {
    const admin = await seedAdmin()
    const open = await openLetter(admin)
    await startIssue(db(), { listId: NEWSLETTER_LIST_ID, from: 'blank', monthLabel: 'January 2027', by: admin })
    const kept = await saved(admin, 'Sample kept')
    const gone = await saved(admin, 'Sample gone')
    await del(admin, { id: gone.id, version: 1 })
    const issues = (await (await invoke(issuesGet, { as: admin })).json<{ issues: Array<{ issueId: string | null }> }>()).issues
    expect(issues.map((i) => i.issueId)).toEqual([open.id])
    expect(issues.map((i) => i.issueId)).not.toContain(kept.id)
  })
})

describe('part way', () => {
  it('C13: a start from a template removed a moment ago is not found, and the open letter is left as it was', async () => {
    const one = await seedAdmin()
    const two = await person('Player Two', 'lca_observer')
    await seedPresident(two)
    const open = await openLetter(one)
    const template = await saved(one, 'Sample short lived')
    await del(two, { id: template.id, version: 1 })
    const before = await rows()
    const res = await invoke(startPost, { method: 'POST', as: one, body: { from: { templateId: template.id }, monthLabel: MONTH } })
    expect(res.status).toBe(404)
    expect(await rows()).toEqual(before)
    expect((await rowOf(open.id)).set_aside_at).toBeNull()
  })

  it('C14: once the page is switched off part way, every method answers "Not found" and nothing is written', async () => {
    const admin = await seedAdmin()
    const template = await saved(admin, 'Sample before the switch')
    const before = await rows()
    flags.pageOn = false
    for (const res of [
      await invoke(templatesGet, { as: admin }),
      await post(admin, { name: 'Sample after', bodyHtml: WORDS }),
      await put(admin, { id: template.id, version: 1, name: 'Sample after' }),
      await del(admin, { id: template.id, version: 1 }),
      await invoke(startPost, { method: 'POST', as: admin, body: { from: { templateId: template.id }, monthLabel: MONTH } }),
    ]) {
      expect([res.status, await res.response.clone().text()]).toEqual([404, JSON.stringify({ error: 'Not found' })])
    }
    expect(await rows()).toEqual(before)
  })

  it('C15: a media manager whose seat passes to someone else part way is refused at the next step, and nothing is written', async () => {
    const seated = await person('Player Three')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [seated])
    const template = await saved(await seedAdmin(), 'Sample seat')
    expect((await invoke(templatesGet, { as: seated, aal: 'aal2' })).status).toBe(200)
    await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
    const before = await rows()
    for (const res of [
      await invoke(templatesGet, { as: seated, aal: 'aal2' }),
      await invoke(templatesPost, { method: 'POST', as: seated, aal: 'aal2', body: { name: 'Sample after', bodyHtml: WORDS } }),
      await invoke(templatesPut, { method: 'PUT', as: seated, aal: 'aal2', body: { id: template.id, version: 1, name: 'Sample after' } }),
      await invoke(templatesDelete, { method: 'DELETE', as: seated, aal: 'aal2', body: { id: template.id, version: 1 } }),
    ]) {
      expect(res.status).toBe(403)
      expect(JSON.stringify(await res.json())).not.toContain('Sample seat')
    }
    expect(await rows()).toEqual(before)
  })
})
