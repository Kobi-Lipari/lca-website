// test/unit/redesign-status-ws09-u-reload.test.ts
//
// REDESIGN_STATUS.md records the reload of a guarded page, a step of WS09's
// checkpoint U added on K's decision 7, of Sunday, November 15, 2026. Like
// WS09 step 13's record test, this file reads only the WS09 section, from its
// heading to the WS10 heading. Pinned here: the block right after WS09 step
// 13's, and before the four lists while it is the section's latest block;
// the Status line's tail while it is; the block's parts in order and its
// claims against the files they describe (the sign-in context, the guard it
// leaves alone, the readers of memberLoading under src/ and the tests); the
// figures of its Checks line; K's decision 7 in the decisions list; the
// follow-up it closes and the sentences it adds to earlier bullets; and the
// plain-language rules over what it wrote and the files it adds.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS)\\b(?<!PENDING_COUNT)|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
/** A bullet and the indented lines under it. */
function bullet(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < all.length && /^\s+\S/.test(all[end])) end++
  return all.slice(at, end).join('\n')
}
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const TAG = '(WS09 checkpoint U).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 13: signed links and the run record'
const BLOCK = '### WS09 checkpoint U: the reload of a guarded page'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const decisions = part(LISTS[0])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''

const CONTEXT = 'src/contexts/AuthContext.tsx'
const GUARD = 'src/components/auth/RoleProtectedRoute.tsx'
const FIRST_DRAW = 'test/unit/auth-first-draw.test.tsx'
const GUARDS_TEST = 'test/unit/auth-first-draw-guard.test.tsx'
const READERS_TEST = 'test/unit/auth-first-draw-readers.test.tsx'
const SELF = 'test/unit/redesign-status-ws09-u-reload.test.ts'
const NEW_TESTS = [FIRST_DRAW, READERS_TEST, GUARDS_TEST, SELF]
/**
 * Cases a later block added to a new test of this step, so the count this block wrote is the file's count less these:
 * the block "WS16 part two: who may send" added three to the guards' test, a plain member who holds the President seat and one who holds another seat.
 */
const ADDED_LATER: Record<string, number> = { [GUARDS_TEST]: 3 }
/** The record tests whose one pin each this step moves. */
const MOVED = ['test/unit/redesign-status-ws09-step1.test.ts', 'test/unit/redesign-status-ws09-step13.test.ts']
/** The two tests that draw the real sign-in context, which pass unchanged. */
const UNCHANGED = ['test/unit/signed-in-header.test.tsx', 'test/unit/wizard-refresh.test.tsx']
/** The files the mail stream holds, and the two the mail stream asked to be left alone. */
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
/** Every reader of memberLoading under src/ but the context itself. */
const READERS = [GUARD, 'src/components/layout/headerParts.ts', 'src/areas/admin/useMediaManager.ts', 'src/pages/ManageClubPage.tsx']

/** A test file's cases as vitest counts them: each plain `it(` and each row of an `it.each` table, named or written in place. */
function casesIn(file: string): number {
  const text = read(file)
  let n = (text.match(/^\s*it\(/gm) ?? []).length
  for (const [, name] of text.matchAll(/^\s*it\.each\((\w+)\)/gm)) {
    const at = text.indexOf(`const ${name}`)
    expect(at, `${file}: ${name}`).toBeGreaterThan(-1)
    const table = text.slice(text.indexOf('[\n', at), text.indexOf('\n]', at))
    n += (table.match(/^ {2}[['a-z]/gm) ?? []).length
  }
  for (const [, , rows] of text.matchAll(/^(\s*)it\.each\(\[\n([\s\S]*?)\n\s*\] as const\)/gm)) n += (rows.match(/^\s*\[/gm) ?? []).length
  return n
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])

/** Every file under a folder, as paths from the repository's root. */
function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name)
    return statSync(join(ROOT, path)).isDirectory() ? walk(path) : [relative(ROOT, join(ROOT, path))]
  })
}

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the reload of a guarded page: the block', () => {
  it('sits once, right after WS09 step 13\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latestBlock === BLOCK) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this block\'s tail while it is the latest', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestBlock === BLOCK) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026; checkpoint U goes on on its own branch, and on K\'s decision 7 the reload of a guarded page is mended at its root there; steps 1 to 13, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens with what was found, K\'s answer and what was built', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'K\'s decision 7, of Sunday, November 15, 2026', '`loading` starts true and `memberLoading` false', '`RoleProtectedRoute`', 'the default role, no seats and no clubs',
      'with the site\'s real sign-in client', 'K\'s answer: mend it at its root', 'What was built:', 'changes today\'s site with every switch off', '`src/contexts/AuthContext.tsx` alone',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The first draw.**', '- **Never stuck.**', '- **Never taken down.**', '- **The guards.**', '- **Who reads it.**',
      '- **The three cautions.**', '- **The loads at the start.**', '- **The real sign-in client.**', '- **Seen in a browser.**', '- **The follow-ups it closes.**', '- **The branch.**',
      '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Pins moved.**',
      '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held files and the guard alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_TESTS, CONTEXT, ...MOVED, ...UNCHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const file of NEW_TESTS) expect(existsSync(join(ROOT, file)), file).toBe(true)
    expect(files).toContain('  - Grown with no change: none by a case.')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', `\`${GUARD}\``, '`src/areas/admin/useMediaManager.ts`', ...HELD.map((f) => `\`${f}\``)]) expect(beyond, piece).toContain(piece)
    for (const file of [...HELD, GUARD, 'src/areas/admin/useMediaManager.ts', 'src/App.tsx', 'src/lib/features.ts']) expect(read(file), file).not.toMatch(/firstLoadEndedFor|firstLoadOpen|memberLoadingShown|checkpoint U/)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the reload of a guarded page: the parts against the files', () => {
  const code = read(CONTEXT)

  it('names the worked-out value and the state the automatic load reads, as the context holds them', () => {
    const builds = bullet(block, '- **What the step builds.**')
    for (const piece of ['`firstLoadEndedFor`', '`loadsInFlight`', '`currentToken`', '`firstLoadOpen`', 'worked out at each draw', '`autoFetchedFor`']) expect(builds, piece).toContain(piece)
    for (const piece of [
      'const firstLoadOpen = !!session?.user && !member && firstLoadEndedFor !== session.access_token',
      'const memberLoadingShown = memberLoading || firstLoadOpen',
      '      memberLoading: memberLoadingShown,',
      '    if (member || memberLoading) return\n    if (autoFetchedFor.current === session.access_token) return',
      '  const [memberLoading, setMemberLoading] = useState(false)',
      '    if (loadsInFlight.current === 0) setFirstLoadEndedFor(currentToken.current)',
    ]) expect(code, piece).toContain(piece)
    // The listener's load is counted before its first await, and ended in a finally, as refreshMember's is.
    const listener = between(code, 'supabase.auth.onAuthStateChange(', 'return () => subscription.unsubscribe()')
    expect(listener.indexOf('profileLoadStarted()')).toBeLessThan(listener.indexOf('await apiSyncMember()'))
    expect(listener).toContain('} finally {\n          profileLoadEnded()\n        }')
    expect(between(code, 'const refreshMember = useCallback(', '}, [session, profileLoadStarted, profileLoadEnded])')).toContain('} finally {\n      setMemberLoading(false)\n      profileLoadEnded()\n    }')
  })

  it('leaves the guard\'s order as the mail stream asked: the loading return ahead of the roles branch, and the media manager asked ahead of every return', () => {
    const guard = read(GUARD)
    const asked = guard.indexOf('const mediaManager = useMediaManager(!!allowMediaManager)')
    const loading = guard.indexOf('if (loading || memberLoading) {')
    expect(asked).toBeGreaterThan(-1)
    expect(asked).toBeLessThan(loading)
    expect(guard.slice(guard.indexOf('export function RoleProtectedRoute'), asked)).not.toMatch(/^\s+return\b/m)
    expect(loading).toBeLessThan(guard.indexOf('if (roles && !roles.includes(role)'))
    expect(bullet(block, '- **The three cautions.**')).toContain('`src/components/auth/RoleProtectedRoute.tsx` is not edited')
  })

  it('lists every reader of memberLoading under src/ with what it draws in the new first draw, and no other', () => {
    const readers = walk('src').filter((f) => /\.(?:ts|tsx)$/.test(f) && f !== CONTEXT && /\bmemberLoading\b/.test(read(f))).sort()
    expect(readers).toEqual([...READERS].sort())
    const who = bullet(block, '- **Who reads it.**')
    for (const file of READERS) expect(who, file).toContain(`\`${file}\``)
    for (const piece of ['`src/components/auth/ProtectedRoute.tsx`', 'reads `loading` and `user` alone', 'the loading line', '`joinSlotOf`', 'asks nothing']) expect(who, piece).toContain(piece)
    expect(read('src/components/auth/ProtectedRoute.tsx')).not.toMatch(/memberLoading|member\b/)
  })

  it('names the cases that hold each claim, as the tests name them', () => {
    expect(bullet(block, '- **The first draw.**')).toContain(`\`${FIRST_DRAW}\``)
    expect(bullet(block, '- **Never stuck.**')).toContain(`\`${FIRST_DRAW}\``)
    expect(bullet(block, '- **Never taken down.**')).toContain(`\`${FIRST_DRAW}\``)
    expect(bullet(block, '- **The guards.**')).toContain(`\`${GUARDS_TEST}\``)
    const first = read(FIRST_DRAW)
    for (const name of [
      'a reload: memberLoading reads true from the first draw that knows the session until the member arrives', 'the listener speaks before the first read',
      'the listener speaks twice, once before the first read and once after', 'a sign-in made after the page opened',
      'one load failing while the other is still on its way keeps the wait until that one ends', 'an answer of 401 signs the person out and ends with memberLoading false',
      'a sign-out ends with memberLoading false, in every draw after it', 'a visitor with no session never reads memberLoading true, in any draw, and nothing is asked',
    ]) expect(first, name).toContain(`it('${name}'`)
    const guards = read(GUARDS_TEST)
    for (const piece of ['describe(\'a reload of a guarded page, for a person the route admits\'', 'describe(\'a reload of a guarded page, for a person the route does not admit\'', 'describe(\'a visitor who is signed out, at a guarded address\'', 'clubKeepers: true']) {
      expect(guards, piece).toContain(piece)
    }
  })

  it('gives the loads at the start as the test counts them, the same before and after', () => {
    const loads = bullet(block, '- **The loads at the start.**')
    for (const piece of ['POST /api/me twice', 'GET /api/me three times', 'The same before this step and after it', 'No load is added']) expect(loads, piece).toContain(piece)
    const first = read(FIRST_DRAW)
    expect(first).toContain("expect(count(record, 'POST /api/me')).toBe(2)\n    expect(count(record, 'GET /api/me')).toBe(3)")
  })

  it('names what each kind of person meets with every switch off', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['A visitor', 'A member', 'A club\'s rep', 'A seat holder', 'An LCA admin', 'No switch is added']) expect(ships, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and no handler', 'Pages rebuilds the site', 'on K\'s own word']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('the window comes back')
    // clubKeepers went on in the block "WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON", so this step holds only that it is declared.
    expect(read('src/lib/features.ts')).toMatch(/^ {2}clubKeepers: (?:false|true),$/m)
    expect(read('src/lib/features.ts')).not.toMatch(/firstLoad|reload of a guarded page/)
  })

  it('names the browser look, before and after, with the clubs switches off and on', () => {
    const seen = bullet(block, '- **Seen in a browser.**')
    for (const piece of ['Player One', 'Player Two', 'Player Three', 'Player Six', 'signed out', '`/admin`', '`/workspace/region`', '`/my/club/slidell`', 'With every switch off', 'clubs switches on', 'the base', 'the dashboard']) {
      expect(seen, piece).toContain(piece)
    }
  })

  it('gives the lint as unchanged and the build\'s figures beside the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '556,219 bytes', '`index-DURnNUWK.css` 134,731 bytes', '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the reload of a guarded page: the Checks line', () => {
  it('gives each figure once, and no browser run of the suite', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `224b670`\'s tree')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file) - (ADDED_LATER[file] ?? 0))
  })

  it('gives unit counts that add up: the base\'s and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9954, 412])
    expect(num(before) + NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s, and the lint files as the base\'s with the new files added', () => {
    expect(checksLine).toContain('integration 2,433 in 136 files (2,433 in 136 on the base), every one passing')
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1101)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_TESTS.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(built?.[2])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the reload of a guarded page: the lists and the earlier bullets', () => {
  it('adds K\'s decision 7 to the decisions list, last while this block is the latest, and tags nothing else', () => {
    expect(tagged(decisions).map(head)).toEqual(['The five open choices (WS09 checkpoint U).'])
    const entry = tagged(decisions)[0]
    for (const piece of [
      'K\'s decision 7, of Sunday, November 15, 2026', 'at most once an hour for one club and one saver', 'what a first save does to today\'s page is kept as built',
      'Still accurate writes no row in the activity log', 'My region asks no second sign-in factor', 'mended at its root in `src/contexts/AuthContext.tsx`',
    ]) expect(entry, piece).toContain(piece)
    if (latestBlock === BLOCK) expect(decisions.trim().split('\n').at(-1)).toBe(entry)
    // Checkpoint U's review logs the one follow-up of its own, from B1, under the same tag.
    expect(tagged(followUps).map(head).filter((h) => h !== 'The run record\'s prune and the read of `seen_by` (WS09 checkpoint U).')).toEqual([])
  })

  it('marks WS09\'s follow-up closed and keeps its words, and adds a marked sentence to each earlier bullet that said the window was open', () => {
    const reload = entries(followUps).find((l) => l.startsWith('- **A reload of My region before the seats arrive (WS09 step 11).**')) ?? ''
    expect(reload).toContain('WS09 step 12\'s page, `/workspace/region/clubs/:id`, has the same window')
    expect(reload).toContain('Closed in WS09 checkpoint U: the window is mended at its root in `src/contexts/AuthContext.tsx`')
    expect(reload).toContain('WS01\'s follow-up "Admin link opened directly" is mended by the same change')
    // A later block of checkpoint U may mark sentences of its own, so the count of three is read while this block is the latest.
    if (latestBlock === BLOCK) expect(ws09.split('Changed at checkpoint U: ')).toHaveLength(4)
    // WS01's own follow-up keeps its words, outside this section.
    expect(status).toContain('- **Admin link opened directly (step 13, seen on the local dev server).** Loading `/admin/tournaments` in a fresh tab as a signed-in admin went to `/dashboard`')
    expect(bullet(block, '- **The follow-ups it closes.**')).toContain('"Admin link opened directly"')
  })

  it('moves only the two pins it names, each gated or widened the narrowest way', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(read(MOVED[0])).toContain('|WS09 checkpoint T: \\S|WS09 checkpoint U: \\S|')
    expect(read(MOVED[0])).toContain('|checkpoint S)\\)\\.\\*\\* \\S|^- \\*\\*[^*]+ \\(WS09 checkpoint U\\)\\.\\*\\* \\S/)')
    expect(read(MOVED[1])).toContain('    if (latestStep === 13 && latestBlock === STEP) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])')
    expect(read(MOVED[1])).toContain('    if (latestStep === 13 && latestBlock === STEP) {\n      expect(tail).toBe(')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the reload of a guarded page: plain language', () => {
  const marked = ws09.split('\n').filter((l) => l.includes('Changed at checkpoint U: ') || l.includes('Closed in WS09 checkpoint U: '))
  const written = [block, ...tagged(decisions), ...marked, statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds, and out of its own lines of the context', () => {
    for (const file of NEW_TESTS) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    const own = between(read(CONTEXT), '  /**\n   * The access token whose first profile load has ended', '  const refreshMember = useCallback(') + between(read(CONTEXT), '  // Worked out at each draw', '  const directedTournamentIds')
    expect(own).not.toBe('')
    for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(own).not.toMatch(rule)
  })

  it('writes the tests\' people and places plainly made up', () => {
    for (const file of [FIRST_DRAW, GUARDS_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      expect(text, file).not.toMatch(/@(?!(?:[a-z0-9-]+\.)*example\.org|testing-library|\/|supabase|vitest)[a-z]/)
    }
    expect(read(FIRST_DRAW)).toContain('Example Chess Club')
  })
})
