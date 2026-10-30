// test/unit/chrome-reads.test.ts
//
// Every read of the site's header and footer in the browser tests goes
// through test/a11y/chrome.ts. The TypeScript parser reads every other file
// of test/a11y, specs and helpers, so a comment, a title or a message is
// never taken for code, and this file holds that:
//
// - no file finds the header, the footer or a part of them on its own: no
//   locator, query, closest, wait or axe scope is handed a selector that
//   starts with header or footer, no getByRole asks for the banner or the
//   contentinfo, nothing asks for the group named Appearance, and no
//   selector of that kind is kept in a string for later; the one exception
//   is the fixture page's own header, which tokens.spec.ts reads inside its
//   container
// - a spec that marks a check as today's imports onlyToday or ifToday from
//   the helper, hands it the test's testInfo, names the part it marks, the
//   header or the footer, and says what it marks; every ifToday is awaited,
//   so what it holds runs, and fails the test, before the test goes on; and
//   onlyToday comes after the test's own skip for its project, so the other
//   build goes on giving the reason it gives now
// - the header's names come from the helper's two lists, never written out;
//   a read of a name only today's header gives (and of the More menu's
//   account links) is marked as today's, or sits in a helper only marked
//   checks call; and a name any header gives is never marked
// - the reading is not blind: made-up lines of each kind are found, and the
//   ways the specs read the chrome through the helper are not
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const DIR = 'test/a11y'
/** Every TypeScript file of the browser tests but the helper itself. */
const FILES = readdirSync(join(ROOT, DIR))
  .filter((name) => name.endsWith('.ts') && name !== 'chrome.ts')
  .map((name) => `${DIR}/${name}`)
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The calls that take a CSS selector as their argument, on a page, a locator, an element or axe. */
const SELECTOR_CALLS = new Set([
  'locator', 'querySelector', 'querySelectorAll', 'closest', 'matches', 'include', 'exclude', 'waitForSelector',
  '$', '$$', '$eval', '$$eval', 'getElementsByTagName',
])
/** A selector that starts with the header or the footer. */
const CHROME_SELECTOR = /^\s*(?:header|footer)(?![\w-])/i
/** The tags a selector inside the header or the footer goes on to name. */
const TAG = '(?:img|a|svg|p|nav|div|span|button|path|ul|ol|li|h[1-6]|picture|source|input|label|section|time|small|strong|em|\\*)'
/** One compound selector after the first: a tag, a class, an id, an attribute or a pseudo-class, or a combinator. */
const COMPOUND = new RegExp(`^(?:[>+~]|${TAG}?(?:[.#][\\w-]+|\\[[^\\]]*\\]|:{1,2}[\\w-]+(?:\\([^)]*\\))?)*)$`)
/** The fixture page's own header, read inside its container: the one read of a header that is not the site's. */
const FIXTURE_HEADER = { file: 'test/a11y/tokens.spec.ts', call: 'container.locator', selector: 'header p' }

/** The text of a string or a template, its head where it has parts. */
function textOf(node: ts.Node | undefined): string | null {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) return node.head.text
  return null
}

/**
 * Whether a string is a selector made of the header or the footer and what
 * is inside them, such as "header img" or "footer > a", rather than words
 * that start with one of them, such as a test's title. The header or the
 * footer alone, a label the specs give what the helper found, is not.
 */
function isChromeSelector(text: string): boolean {
  // An attribute's value may hold spaces; what is inside the brackets says nothing here.
  const plain = text.trim().replace(/\[[^\]]*\]/g, '[x]')
  // Joined to what follows it, as in header.sticky, footer[role] or header>div; a comma is left to words.
  if (/^(?:header|footer)[.#[:>+~]/.test(plain)) return true
  const parts = plain.split(/\s+/)
  if (parts.length < 2 || !/^(?:header|footer)$/.test(parts[0])) return false
  return parts.slice(1).every((part) => COMPOUND.test(part))
}

/** The name a call is made by: the method's, or the function's. */
function calleeName(call: ts.CallExpression): string {
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  if (ts.isIdentifier(callee)) return callee.text
  return ''
}

interface Read {
  line: number
  text: string
  why: string
}

/** Every read of the site's chrome in a file's code that does not go through the helper. */
function ownReads(path: string, source: string): Read[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found: Read[] = []
  const add = (node: ts.Node, why: string) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
    found.push({ line, text: node.getText(file).replace(/\s+/g, ' ').slice(0, 120), why })
  }
  const isFixtureHeader = (call: ts.CallExpression, selector: string) =>
    path === FIXTURE_HEADER.file && call.expression.getText(file) === FIXTURE_HEADER.call && selector === FIXTURE_HEADER.selector
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node)
      const [first, second] = node.arguments
      if (SELECTOR_CALLS.has(name)) {
        const handed = first && ts.isArrayLiteralExpression(first) ? [...first.elements] : [first]
        for (const arg of handed) {
          const selector = textOf(arg)
          if (selector !== null && CHROME_SELECTOR.test(selector) && !isFixtureHeader(node, selector)) add(node, `${name} is handed "${selector}"`)
        }
      }
      if (name === 'getByRole') {
        const role = textOf(first)
        if (role === 'banner' || role === 'contentinfo') add(node, `getByRole asks for the ${role}`)
        if (role === 'group' && second && ts.isObjectLiteralExpression(second)) {
          for (const prop of second.properties) {
            if (!ts.isPropertyAssignment(prop) || prop.name.getText(file) !== 'name') continue
            const named = textOf(prop.initializer) ?? (ts.isRegularExpressionLiteral(prop.initializer) ? prop.initializer.text : '')
            if (/Appearance/.test(named)) add(node, 'getByRole asks for the group named Appearance')
          }
        }
      }
      if (name === 'getByLabel' && /Appearance/.test(textOf(first) ?? '')) add(node, 'getByLabel asks for Appearance')
    }
    // A selector of the chrome kept in a string for later, outside the fixture page's one read.
    const text = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : ts.isTemplateExpression(node) ? node.head.text : null
    if (text !== null && isChromeSelector(text)) {
      const call = node.parent && ts.isCallExpression(node.parent) ? node.parent : null
      if (!(call && isFixtureHeader(call, text))) add(node, `a selector of the chrome, "${text}"`)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  // A call handed a chrome selector string is found twice, by the call and by the string: keep one per line and reason.
  const seen = new Set<string>()
  return found.filter((r) => {
    const key = `${r.line} ${r.why.replace(/^.* is handed "(.*)"$/, 'a selector of the chrome, "$1"')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

interface Mark {
  file: string
  line: number
  name: 'onlyToday' | 'ifToday'
  call: ts.CallExpression
  source: ts.SourceFile
}

/** Every call of onlyToday and ifToday in a file. */
function marksIn(path: string, source: string): Mark[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const marks: Mark[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === 'onlyToday' || node.expression.text === 'ifToday')) {
      marks.push({ file: path, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, name: node.expression.text, call: node, source: file })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return marks
}

/** The names a file imports from the helper. */
function importedFromHelper(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const names: string[] = []
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || textOf(statement.moduleSpecifier) !== './chrome') continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) names.push(el.name.text)
  }
  return names
}

/** Whether a statement is a test's own skip for its project: test.skip(...) or the spec's only(testInfo, ...). */
function isProjectSkip(statement: ts.Statement): boolean {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return false
  const callee = statement.expression.expression
  return (ts.isPropertyAccessExpression(callee) && callee.getText() === 'test.skip') || (ts.isIdentifier(callee) && callee.text === 'only')
}

/** The names the specs read today's header by, which only today's gives: the helper's list, and the More menu's account links. */
const TODAYS = new Set(['TODAYS_NAMES', 'TODAYS_ACCOUNT_LINKS'])

/** The values of the helper's two lists of names, read from its text. */
function helperNames(): string[] {
  const file = ts.createSourceFile('chrome.ts', read(`${DIR}/chrome.ts`), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const values: string[] = []
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !['CHROME_NAMES', 'TODAYS_NAMES'].includes(declaration.name.text)) continue
      const init = declaration.initializer && ts.isAsExpression(declaration.initializer) ? declaration.initializer.expression : declaration.initializer
      if (init && ts.isObjectLiteralExpression(init)) {
        for (const prop of init.properties) if (ts.isPropertyAssignment(prop) && textOf(prop.initializer) !== null) values.push(textOf(prop.initializer)!)
      }
    }
  }
  return values
}

interface NameRead {
  line: number
  text: string
}

/**
 * How a file reads the header's names: the reads of today's names that are
 * not marked as today's (inside what an ifToday runs, in a test onlyToday
 * marks, or in a helper of the file whose every call is one of those), the
 * reads of the names any header gives that are marked, and the names a read
 * of the header writes out rather than take from the helper's lists.
 */
function nameReads(path: string, source: string, names: string[]): { unmarked: NameRead[]; markedAny: NameRead[]; writtenOut: NameRead[] } {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const at = (node: ts.Node): NameRead => ({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, text: node.parent.getText(file).replace(/\s+/g, ' ').slice(0, 100) })
  const called = (node: ts.Node, name: string): node is ts.CallExpression => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
  // What an ifToday runs, and the body of each test onlyToday marks as a whole.
  const marked = new Set<ts.Node>()
  // A helper of the file: a function it declares at its top level, by name.
  const helpers = new Map<ts.Node, string>()
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) helpers.set(statement, statement.name.text)
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) helpers.set(d.initializer, d.name.text)
      }
    }
  }
  const todays: ts.Identifier[] = []
  const anyChrome: ts.Identifier[] = []
  const calls: ts.CallExpression[] = []
  const writtenOut: NameRead[] = []
  const visit = (node: ts.Node) => {
    if (called(node, 'ifToday') && node.arguments[4]) marked.add(node.arguments[4])
    if (called(node, 'onlyToday') && node.parent && ts.isExpressionStatement(node.parent) && ts.isBlock(node.parent.parent)) marked.add(node.parent.parent.parent)
    if (ts.isIdentifier(node) && !ts.isImportSpecifier(node.parent)) {
      if (TODAYS.has(node.text)) todays.push(node)
      if (node.text === 'CHROME_NAMES') anyChrome.push(node)
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.push(node)
    // A read of the header that writes out one of the lists' names.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'getByRole' && /^siteHeader\(/.test(node.expression.expression.getText(file))) {
      const options = node.arguments[1]
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const prop of options.properties) {
          if (ts.isPropertyAssignment(prop) && prop.name.getText(file) === 'name' && names.includes(textOf(prop.initializer) ?? '')) writtenOut.push(at(prop.initializer))
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  const inside = (node: ts.Node, set: { has: (n: ts.Node) => boolean }) => {
    for (let up = node.parent; up; up = up.parent) if (set.has(up)) return true
    return false
  }
  const helperOf = (node: ts.Node) => {
    for (let up = node.parent; up; up = up.parent) if (helpers.has(up)) return helpers.get(up)!
    return null
  }
  // The helpers that read today's names are today's too: each call of one must be marked.
  const todaysHelpers = new Set(todays.map(helperOf).filter((name): name is string => name !== null))
  const unmarked = [
    ...todays.filter((node) => helperOf(node) === null && !inside(node, marked)),
    ...calls.filter((call) => todaysHelpers.has((call.expression as ts.Identifier).text) && !inside(call, marked) && !todaysHelpers.has(helperOf(call) ?? '')),
  ].map(at)
  const markedAny = anyChrome.filter((node) => inside(node, marked)).map(at)
  return { unmarked, markedAny, writtenOut }
}

const ALL = FILES.map((path) => ({ path, source: read(path) }))
const MARKS = ALL.flatMap(({ path, source }) => marksIn(path, source))
const NAMES = helperNames()

describe('the reading is not blind', () => {
  it('finds each kind of read of the chrome that does not go through the helper', () => {
    const lines = [
      'await expect(page.locator(\'header\')).toBeVisible()',
      'await expect(page.locator(\'footer [data-slot="lca-logo"]\')).toHaveCount(1)',
      'const header = page.getByRole(\'banner\')',
      'const footer = page.getByRole("contentinfo")',
      'const group = page.getByRole(\'group\', { name: \'Appearance\' })',
      'const group = page.getByRole(\'group\', { name: /appearance|Appearance/ })',
      'const label = page.getByLabel(\'Appearance\')',
      'page.evaluate(() => document.querySelector(\'header\')!.getBoundingClientRect())',
      'page.evaluate(() => document.querySelectorAll("footer a").length)',
      'mark.evaluate((svg) => svg.closest(\'header\')!.firstElementChild)',
      'new AxeBuilder({ page }).include(\'footer\').analyze()',
      'new AxeBuilder({ page }).include([\'header\', \'main\']).analyze()',
      'await page.waitForSelector(`header ${more}`)',
      'const img = await page.$(\'header img\')',
      'const IN_HEADER = \'header a[href="/"]\'',
      'const LOGO = \'footer > img\'',
    ]
    for (const line of lines) expect(ownReads('test/a11y/made-up.spec.ts', line), line).toHaveLength(1)
  })

  it('finds none in the ways the specs read the chrome through the helper, or in words that only name it', () => {
    const lines = [
      'import { SITE, siteHeader } from \'./chrome\'',
      'await expect(siteHeader(page).getByRole(\'link\', { name: CHROME_NAMES.logIn })).toBeVisible()',
      'const ground = getComputedStyle(svg.closest(site.header)!).backgroundColor',
      'page.evaluate((site) => document.querySelector(site.footer)!.getBoundingClientRect().top, SITE)',
      'for (const [what, scope] of [[\'the header\', SITE.header], [\'the footer\', SITE.footer]] as const) axe.include(scope)',
      'const where = el.closest(site.footer) ? \'footer\' : el.closest(site.header) ? \'header\' : \'page\'',
      'test.describe(\'the header and the footer keep the base look\', () => {})',
      'test(\'header and footer stay inside a phone\\\'s window\', async () => {})',
      'test(\'Header, footer and the page at 390 pixels\', async () => {})',
      'console.log(`footer at ${width} pixels: ${height}`)',
      'expect(m.headerFits, \'the header fits the window\').toBe(true)',
      'const res = await request.get(path, { headers: { Authorization: \'x\' } })',
      'await expect(page.getByRole(\'columnheader\')).toHaveText([\'Place\'])',
      'const header = el.querySelector(\'[data-slot="scroll-panel-header"]\')!',
      '// page.locator(\'header\') is what this line used to say',
      '/* page.getByRole(\'banner\') */ const x = 1',
    ]
    for (const line of lines) expect(ownReads('test/a11y/made-up.spec.ts', line), line).toEqual([])
  })

  it('lets the fixture page\'s own header pass only where tokens.spec.ts reads it inside its container', () => {
    const line = 'const muted = await container.locator(\'header p\').evaluate((el) => getComputedStyle(el).color)'
    expect(ownReads(FIXTURE_HEADER.file, line)).toEqual([])
    expect(ownReads('test/a11y/made-up.spec.ts', line).length).toBeGreaterThan(0)
    expect(ownReads(FIXTURE_HEADER.file, 'const muted = await page.locator(\'header p\').count()').length).toBeGreaterThan(0)
  })

  it('finds a mark that is not awaited, and one that comes before the test\'s own skip', () => {
    const source = [
      'test(\'a made-up test\', async ({ page }, testInfo) => {',
      '  onlyToday(testInfo, \'header\', [1280], \'why\')',
      '  test.skip(testInfo.project.name !== OFF, \'a11y-off only\')',
      '  ifToday(testInfo, \'footer\', 1280, \'what\', () => {})',
      '})',
    ].join('\n')
    const marks = marksIn('test/a11y/made-up.spec.ts', source)
    expect(marks.map((m) => m.name)).toEqual(['onlyToday', 'ifToday'])
    expect(skipsAfter(marks[0])).toEqual([3])
    expect(isAwaited(marks[1].call)).toBe(false)
  })

  it('finds a read of today\'s names that is not marked, a helper of them called unmarked, a name any header gives that is marked, and a name written out', () => {
    const source = [
      'async function more(page: Page) { await siteHeader(page).getByRole(\'button\', { name: TODAYS_NAMES.more }).hover() }',
      'test(\'a made-up test\', async ({ page }, testInfo) => {',
      '  await expect(siteHeader(page).getByRole(\'link\', { name: TODAYS_NAMES.profile })).toBeVisible()',
      '  await more(page)',
      '  await ifToday(testInfo, \'header\', 1280, \'today\\\'s names\', async () => {',
      '    await expect(siteHeader(page).getByRole(\'link\', { name: CHROME_NAMES.logIn })).toBeVisible()',
      '    await more(page)',
      '    await expect(siteHeader(page).getByRole(\'button\', { name: TODAYS_NAMES.logOut })).toBeVisible()',
      '  })',
      '  await expect(siteHeader(page).getByRole(\'link\', { name: \'Join LCA\' })).toBeVisible()',
      '})',
      'test(\'a made-up test of today\\\'s header alone\', async ({ page }, testInfo) => {',
      '  onlyToday(testInfo, \'header\', [1280], \'why\')',
      '  await expect(siteHeader(page).getByRole(\'link\', { name: TODAYS_NAMES.profile })).toBeVisible()',
      '  await more(page)',
      '})',
    ].join('\n')
    const found = nameReads('test/a11y/made-up.spec.ts', source, ['Log in', 'Join LCA', 'Clubs', 'Profile', 'Log out', 'More'])
    expect(found.unmarked.map((r) => r.line)).toEqual([3, 4])
    expect(found.markedAny.map((r) => r.line)).toEqual([6])
    expect(found.writtenOut.map((r) => r.line)).toEqual([10])
  })
})

/** The lines of the project skips that come after an onlyToday in its test's body. */
function skipsAfter(mark: Mark): number[] {
  const statement = mark.call.parent
  const block = statement?.parent
  if (!statement || !ts.isExpressionStatement(statement) || !block || !ts.isBlock(block)) return [-1]
  const at = block.statements.indexOf(statement)
  return block.statements.slice(at + 1).filter(isProjectSkip).map((s) => mark.source.getLineAndCharacterOfPosition(s.getStart(mark.source)).line + 1)
}

/** Whether a call is awaited where it is made, or handed back to be. */
function isAwaited(call: ts.CallExpression): boolean {
  const parent = call.parent
  return ts.isAwaitExpression(parent) || ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === call)
}

describe('the browser tests read the chrome through the helper alone', () => {
  it('reads every file of test/a11y but the helper, the specs and the helpers both', () => {
    expect(FILES).toEqual(expect.arrayContaining(['test/a11y/brand.spec.ts', 'test/a11y/signed-in-edges.spec.ts', 'test/a11y/support.ts', 'test/a11y/signedIn.ts', 'test/a11y/baseline.ts', 'test/a11y/global-setup.ts']))
    expect(FILES).not.toContain('test/a11y/chrome.ts')
  })

  it.each(FILES)('%s finds the header, the footer and their parts through the helper alone', (path) => {
    expect(ownReads(path, read(path)).map((r) => `line ${r.line}: ${r.why}: ${r.text}`)).toEqual([])
  })

  it('keeps the fixture page\'s own header, read inside its container, in tokens.spec.ts alone', () => {
    const at = ALL.filter(({ source }) => source.includes(`${FIXTURE_HEADER.call}('${FIXTURE_HEADER.selector}')`)).map(({ path }) => path)
    expect(at).toEqual([FIXTURE_HEADER.file])
  })
})

describe('the checks marked as today\'s', () => {
  it('are found in the specs that mark them', () => {
    expect(MARKS.length).toBeGreaterThan(0)
    expect(new Set(MARKS.map((m) => m.name))).toEqual(new Set(['onlyToday', 'ifToday']))
  })

  it('are marked by names each spec imports from the helper', () => {
    for (const { path, source } of ALL) {
      const used = new Set(MARKS.filter((m) => m.file === path).map((m) => m.name))
      const imported = importedFromHelper(path, source)
      for (const name of used) expect(imported, `${path} uses ${name}`).toContain(name)
    }
  })

  it('hand the helper the test\'s testInfo, name the header or the footer, and say what they mark', () => {
    for (const mark of MARKS) {
      const where = `${mark.file} line ${mark.line}, ${mark.name}`
      const [info, part, , what, run] = mark.call.arguments
      expect(info && ts.isIdentifier(info) ? info.text : '', `${where}: the test's testInfo`).toBe('testInfo')
      expect(['header', 'footer'], `${where}: the part`).toContain(textOf(part))
      const said = what ? (textOf(what) ?? '') + (ts.isTemplateExpression(what) ? what.templateSpans.map((s) => s.literal.text).join('') : '') : ''
      expect(said.trim().length, `${where}: what it marks`).toBeGreaterThan(0)
      if (mark.name === 'ifToday') expect(run !== undefined && (ts.isArrowFunction(run) || ts.isFunctionExpression(run) || ts.isIdentifier(run)), `${where}: what it runs`).toBe(true)
    }
  })

  it('await every ifToday, so what it holds runs, and fails the test, before the test goes on', () => {
    const loose = MARKS.filter((m) => m.name === 'ifToday' && !isAwaited(m.call)).map((m) => `${m.file} line ${m.line}`)
    expect(loose).toEqual([])
  })

  it('put onlyToday after the test\'s own skip for its project, so the other build keeps the reason it gives now', () => {
    for (const mark of MARKS.filter((m) => m.name === 'onlyToday')) {
      expect(skipsAfter(mark), `${mark.file} line ${mark.line}`).toEqual([])
    }
  })
})

describe('the header\'s names', () => {
  it('are the helper\'s two lists, which hold the six names the specs read the header by', () => {
    expect([...NAMES].sort()).toEqual(['Clubs', 'Join LCA', 'Log in', 'Log out', 'More', 'Profile'])
  })

  it('are read from the lists, never written out in a read of the header', () => {
    for (const { path, source } of ALL) expect(nameReads(path, source, NAMES).writtenOut, path).toEqual([])
  })

  it('that only today\'s header gives are read only where a check is marked as today\'s, by ifToday or onlyToday, or by a helper only such a check calls', () => {
    const reading = ALL.filter(({ source }) => [...TODAYS].some((name) => source.includes(name)))
    expect(reading.map(({ path }) => path)).toEqual(expect.arrayContaining(['test/a11y/signed-in.spec.ts', 'test/a11y/signed-in-edges.spec.ts']))
    for (const { path, source } of reading) expect(nameReads(path, source, NAMES).unmarked.map((r) => `line ${r.line}: ${r.text}`), path).toEqual([])
  })

  it('that any header gives are never marked as today\'s', () => {
    for (const { path, source } of ALL) expect(nameReads(path, source, NAMES).markedAny.map((r) => `line ${r.line}: ${r.text}`), path).toEqual([])
  })
})
