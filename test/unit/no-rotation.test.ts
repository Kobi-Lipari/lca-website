// test/unit/no-rotation.test.ts
//
// Nothing on the site moves on by itself (WS01 step 29; acceptance criterion
// 4, WCAG 2.2.2). A slideshow, a ticker or any part of a page that changes
// what it shows on a timer is built from a repeating timer, so this test
// reads every .ts and .tsx file under src with the TypeScript parser (calls
// only: a type such as ReturnType<typeof setInterval>, or a word in a
// comment, is not a call) and holds the timers to two rules:
//
// - every setInterval call, bare or as window.setInterval, globalThis or
//   self, is named in ALLOWED below by its file, with its reason and the
//   number of calls in that file, which must match: a new call fails, and a
//   removed one must take its entry down, so the list only shrinks. There
//   are four: the home page's slideshow with newLook off, listed until WS03
//   replaces the hero, and three that move nothing on, the email screen's
//   poll while a campaign is sending, the annual meeting page's minute clock
//   and the price clock of useNow, a hook in a .ts file;
// - a setTimeout (or requestAnimationFrame) that runs again by itself is a
//   loop, and fails wherever it is: one whose callback is the function it
//   sits in, one whose callback calls the function it sits in, and one in
//   an effect that runs again once its callback sets a state, so the effect
//   sets another timer. An effect runs again when a state it depends on
//   changes: one its dependency list names, or one a value in the list is
//   read from (const slide = slides[index], through useMemo or not,
//   followed through the component's own values as far as they go). An
//   effect with no dependency list runs after every render, and so does
//   one whose list names a function, object or list written in the
//   component's body without a hook to keep it (made anew on every
//   render), or one whose list is not written out; in such an effect any
//   state the timer sets is a loop. The callback is followed into the
//   functions the file defines, so a helper between them changes nothing:
//   a callback that is, or calls, a helper that leads back to the function
//   the timer sits in, or that sets such a state, is a loop as well. A
//   function given to useCallback, or written as a class method or field,
//   goes by the name it is given. A one-shot timer (a debounce, a reload, a
//   scroll, a message that goes away) passes.
//
// What the rules do not read: a timer that runs again only by way of
// another file, a prop or a context (a parent's state set through a
// callback it hands down), or through a class component's lifecycle
// methods. A change that builds one of those is for review to catch.
//
// Each rule is run on a planted tree first, with the timers' names put
// together when the test runs, to show it finds what it looks for.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')

/** The timers' names, put together here so this file holds no call of its own to find. */
const INTERVAL = ['set', 'Interval'].join('')
const TIMEOUT = ['set', 'Timeout'].join('')
const FRAME = ['request', 'Animation', 'Frame'].join('')
/** The objects a timer is called on besides none. */
const GLOBALS = new Set(['window', 'globalThis', 'self'])

interface Allowed {
  file: string
  count: number
  reason: string
}

/** The repeating timers the site keeps, by file, each with its reason and its number of calls. */
const ALLOWED: Allowed[] = [
  {
    file: 'src/pages/HomePage.tsx',
    count: 2,
    reason:
      'HeroSlideshow, today\'s hero with newLook off: the five slides move on every 5 seconds, set when the page opens and again when a slide control starts the count over. Under the new look the hero is one still picture and HeroSlideshow is not drawn. Listed until WS03 replaces the hero and deletes HeroSlideshow.',
  },
  {
    file: 'src/pages/AdminEmailPage.tsx',
    count: 1,
    reason: 'The admin email screen reads its list of campaigns again every 3 seconds, only while one is still sending, to show its progress. Nothing on show moves on by itself.',
  },
  {
    file: 'src/pages/AnnualMeetingPage.tsx',
    count: 1,
    reason: 'The annual meeting page reads the clock once a minute for its countdown to the meeting. Nothing on show moves on by itself.',
  },
  {
    file: 'src/hooks/useNow.ts',
    count: 1,
    reason:
      'The price clock: reads the time every 30 seconds so a price shown follows the early deadline and the late fee as checkout does, on the tournament page and the family registration panel. Nothing on show moves on by itself.',
  },
]

interface Found {
  file: string
  line: number
  timer: string
}

interface Scan {
  /** Every setInterval call, by file and line. */
  intervals: Found[]
  /** Every setTimeout and requestAnimationFrame call that runs once. */
  oneShots: Found[]
  /** Every setTimeout and requestAnimationFrame call that runs again by itself, with why. */
  loops: Array<Found & { why: string }>
  /** What fails: each call or count the allowlist does not allow, and each loop. */
  problems: string[]
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return filesUnder(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/** The timer a call starts, bare or on window, globalThis or self, or null. */
function timerOf(call: ts.CallExpression): string | null {
  const callee = call.expression
  const names = [INTERVAL, TIMEOUT, FRAME]
  if (ts.isIdentifier(callee) && names.includes(callee.text)) return callee.text
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && GLOBALS.has(callee.expression.text) && names.includes(callee.name.text)) {
    return callee.name.text
  }
  return null
}

const isFunction = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)

/** The name a function goes by: its own, or the variable, property or class field it is given to, through a useCallback or not. */
function nameOf(fn: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn)) && fn.name && ts.isIdentifier(fn.name)) return fn.name.text
  let parent = fn.parent
  // const tick = useCallback(() => { ... }, []) gives the function the name tick.
  if (parent && ts.isCallExpression(parent) && parent.arguments[0] === fn && /^(React\.)?useCallback$/.test(parent.expression.getText())) parent = parent.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text
  if (parent && (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) && ts.isIdentifier(parent.name)) return parent.name.text
  return null
}

/** The names of the functions a node sits in, innermost first. */
function enclosingNames(node: ts.Node): string[] {
  const names: string[] = []
  for (let at = node.parent; at; at = at.parent) {
    if (isFunction(at)) {
      const name = nameOf(at)
      if (name) names.push(name)
    }
  }
  return names
}

/** A function named by an identifier or by this.name, as a call's target or a timer's callback, or null. */
function plainName(e: ts.Expression): string | null {
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e) && e.expression.kind === ts.SyntaxKind.ThisKeyword) return e.name.text
  return null
}

/** Every function called anywhere inside a node, by identifier or as this.name. */
function calledNames(node: ts.Node): string[] {
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const name = plainName(n.expression)
      if (name) out.push(name)
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return out
}

/** The functions a file defines by a name (see nameOf), each name with the bodies written for it. */
function localFunctions(sf: ts.SourceFile): Map<string, ts.Node[]> {
  const fns = new Map<string, ts.Node[]>()
  const visit = (n: ts.Node) => {
    if (isFunction(n) && n.body) {
      const name = nameOf(n)
      if (name) fns.set(name, [...(fns.get(name) ?? []), n.body])
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return fns
}

/**
 * Every function the bodies call, and every function those call in turn
 * among the file's own, each with the one called first on the way to it:
 * a body that calls advance, which calls setSlide, reaches advance and
 * setSlide, both by way of advance.
 */
function reached(bodies: ts.Node[], fns: Map<string, ts.Node[]>): Map<string, string> {
  const via = new Map<string, string>()
  const queue: Array<[string, string]> = bodies.flatMap((b) => calledNames(b).map((name): [string, string] => [name, name]))
  while (queue.length > 0) {
    const [name, first] = queue.shift()!
    if (via.has(name)) continue
    via.set(name, first)
    for (const body of fns.get(name) ?? []) for (const next of calledNames(body)) queue.push([next, first])
  }
  return via
}

/** The states of a file and their setters: const [index, setIndex] = useState(...) gives setIndex to index. */
function stateSetters(sf: ts.SourceFile): Map<string, string> {
  const setters = new Map<string, string>()
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)) {
      const hook = n.initializer.expression.getText(sf)
      const [state, setter] = n.name.elements
      if (/^(React\.)?use(State|Reducer)$/.test(hook) && state && setter && ts.isBindingElement(state) && ts.isBindingElement(setter) && ts.isIdentifier(state.name) && ts.isIdentifier(setter.name)) {
        setters.set(setter.name.text, state.name.text)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return setters
}

/** The effect call a node sits in, inside its callback rather than its dependency list, or null. */
function enclosingEffect(node: ts.Node, sf: ts.SourceFile): ts.CallExpression | null {
  for (let at = node.parent; at; at = at.parent) {
    if (ts.isCallExpression(at) && /^(React\.)?use(Layout)?Effect$/.test(at.expression.getText(sf)) && at.arguments[0] && node.pos >= at.arguments[0].pos && node.end <= at.arguments[0].end) return at
  }
  return null
}

/** An identifier that reads nothing: a property's name after a dot, a key, or a name being declared. */
function readsNothing(id: ts.Identifier): boolean {
  const p = id.parent
  if (ts.isPropertyAccessExpression(p)) return p.name === id
  if (ts.isBindingElement(p)) return p.name === id || p.propertyName === id
  if (ts.isPropertyAssignment(p) || ts.isParameter(p) || ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)) return p.name === id
  return false
}

/** The names a node reads: index and slides in slides[index].title, not title. */
function readNames(node: ts.Node): string[] {
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n) && !readsNothing(n)) out.push(n.text)
    ts.forEachChild(n, visit)
  }
  visit(node)
  return out
}

/** The names a declaration binds: index and setIndex in const [index, setIndex], title in const { title }. */
function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((el) => (ts.isBindingElement(el) ? boundNames(el.name) : []))
}

type Declaration = ts.VariableDeclaration | ts.FunctionDeclaration

/** A name's declaration in a node or under it, leaving out the functions inside it, which keep their own names. */
function declarationIn(node: ts.Node, name: string): Declaration | undefined {
  if (ts.isFunctionDeclaration(node) && node.name?.text === name) return node
  if (isFunction(node)) return undefined
  if (ts.isVariableDeclaration(node) && boundNames(node.name).includes(name)) return node
  return ts.forEachChild(node, (child) => declarationIn(child, name))
}

/** A name's declaration as a node sees it: in the functions around the node, innermost first, then at the top of the file. */
function declarationOf(name: string, from: ts.Node): Declaration | undefined {
  for (let at: ts.Node | undefined = from.parent; at; at = at.parent) {
    const scope = ts.isSourceFile(at) ? at : isFunction(at) ? at.body : undefined
    const found = scope ? ts.forEachChild(scope, (child) => declarationIn(child, name)) : undefined
    if (found) return found
  }
  return undefined
}

/** Whether a node sits inside a function, such as a component or a hook, so its line runs on every render. */
function inFunction(node: ts.Node): boolean {
  for (let at = node.parent; at; at = at.parent) if (isFunction(at)) return true
  return false
}

/** An expression without the brackets, casts and non-null marks around it. */
function bare(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e)) e = e.expression
  return e
}

/** A value made anew each time its line runs: a function, an object, a list, an element or an instance written out. */
function madeAnew(e: ts.Expression): boolean {
  const v = bare(e)
  return (
    ts.isArrowFunction(v) ||
    ts.isFunctionExpression(v) ||
    ts.isObjectLiteralExpression(v) ||
    ts.isArrayLiteralExpression(v) ||
    ts.isNewExpression(v) ||
    ts.isJsxElement(v) ||
    ts.isJsxSelfClosingElement(v) ||
    ts.isJsxFragment(v)
  )
}

/**
 * For the effect a timer sits in: why setting a state runs that effect
 * again, as the end of a sentence, or null when it does not. The effect
 * depends on each state its dependency list names, and on each state a
 * value in the list is read from, followed through the component's own
 * values as far as they go. With no list, a list that is not written out,
 * or a list that names a function, object or list made anew on every
 * render, the effect runs after every render, so every state counts.
 */
function runsAgainOn(effect: ts.CallExpression, states: Set<string>): (state: string) => string | null {
  const list = effect.arguments[1]
  if (!list) return () => 'and the effect it sits in has no dependency list, so it runs again after every render'
  if (!ts.isArrayLiteralExpression(list)) return () => 'and the effect it sits in has a dependency list that is not written out, so it counts as one that runs again after every render'
  /** Each state the effect depends on, with the entry of the list it is read through. */
  const through = new Map<string, string>()
  for (const el of list.elements) {
    const dep = bare(el)
    if (ts.isIdentifier(dep) && !states.has(dep.text)) {
      const decl = declarationOf(dep.text, effect)
      if (decl && inFunction(decl) && (ts.isFunctionDeclaration(decl) || (decl.initializer !== undefined && madeAnew(decl.initializer)))) {
        const name = dep.text
        return () => `and the effect it sits in depends on ${name}, made anew on every render, so it runs again after every render`
      }
    }
    const seen = new Set<string>()
    const queue = readNames(el)
    while (queue.length > 0) {
      const name = queue.shift()!
      if (seen.has(name)) continue
      seen.add(name)
      if (states.has(name)) {
        if (!through.has(name)) through.set(name, el.getText())
        continue
      }
      const decl = declarationOf(name, effect)
      if (decl && ts.isVariableDeclaration(decl) && decl.initializer) queue.push(...readNames(decl.initializer))
    }
  }
  return (state) => {
    const entry = through.get(state)
    if (entry === undefined) return null
    return entry === state ? 'a state the effect it sits in depends on, so the effect runs again' : `a state the effect it sits in depends on through ${entry}, so the effect runs again`
  }
}

/** Why a setTimeout or requestAnimationFrame call runs again by itself, or null when it runs once. */
function loopReason(call: ts.CallExpression, sf: ts.SourceFile, setters: Map<string, string>, fns: Map<string, ts.Node[]>): string | null {
  const callback = call.arguments[0]
  if (!callback) return null
  const around = enclosingNames(call)
  const effect = enclosingEffect(call, sf)
  const runsAgain = effect ? runsAgainOn(effect, new Set(setters.values())) : () => null
  /** The state a setter sets, with why the effect around the timer runs again once it is set, or null. */
  const sets = (name: string): { state: string; why: string } | null => {
    const state = setters.get(name)
    const why = state === undefined ? null : runsAgain(state)
    return state !== undefined && why !== null ? { state, why } : null
  }
  const named = plainName(callback)
  if (named !== null) {
    if (around.includes(named)) return `its callback is ${named}, the function it sits in`
    // A setter or a helper given by name: it, and what it runs in turn, counts as the callback's.
    const reach = [named, ...reached(fns.get(named) ?? [], fns).keys()]
    const again = reach.find((name) => around.includes(name))
    if (again) return `its callback, ${named}, leads back to ${again}, the function it sits in`
    const set = reach.map(sets).find((s) => s !== null)
    if (set) return `its callback, ${named}, sets ${set.state}, ${set.why}`
    return null
  }
  if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
    const called = calledNames(callback.body)
    const again = called.find((name) => around.includes(name))
    if (again) return `its callback calls ${again}, the function it sits in`
    const direct = called.map(sets).find((s) => s !== null)
    if (direct) return `its callback sets ${direct.state}, ${direct.why}`
    const reach = reached([callback.body], fns)
    const back = [...reach.keys()].find((name) => around.includes(name))
    if (back) return `its callback calls ${reach.get(back)}, which leads back to ${back}, the function it sits in`
    for (const [name, first] of reach) {
      const set = sets(name)
      if (set) return `its callback calls ${first}, which sets ${set.state}, ${set.why}`
    }
  }
  return null
}

/** Reads every .ts and .tsx file under root/src and checks its timers against the allowlist. */
function scan(root: string, allowed: Allowed[] = ALLOWED): Scan {
  const result: Scan = { intervals: [], oneShots: [], loops: [], problems: [] }
  for (const path of filesUnder(join(root, 'src')).sort()) {
    const file = relative(root, path).split('\\').join('/')
    const sf = ts.createSourceFile(file, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const setters = stateSetters(sf)
    const fns = localFunctions(sf)
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const timer = timerOf(n)
        if (timer) {
          const found = { file, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, timer }
          if (timer === INTERVAL) result.intervals.push(found)
          else {
            const why = loopReason(n, sf, setters, fns)
            if (why) result.loops.push({ ...found, why })
            else result.oneShots.push(found)
          }
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  const byFile = new Map<string, number>()
  for (const f of result.intervals) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1)
  for (const [file, count] of byFile) {
    const entry = allowed.find((a) => a.file === file)
    if (!entry) {
      for (const f of result.intervals.filter((i) => i.file === file)) {
        result.problems.push(`${f.file}:${f.line} ${INTERVAL} repeats with no entry in the allowlist; nothing on the site may move on by itself`)
      }
    } else if (entry.count !== count) {
      result.problems.push(`${file} has ${count} ${INTERVAL} call(s) where the allowlist says ${entry.count}`)
    }
  }
  for (const entry of allowed) {
    if (!byFile.has(entry.file)) result.problems.push(`${entry.file} has no ${INTERVAL} call where the allowlist says ${entry.count}; take its entry down`)
  }
  for (const l of result.loops) result.problems.push(`${l.file}:${l.line} ${l.timer} runs again by itself: ${l.why}`)
  return result
}

describe('the timers in src', () => {
  const tree = scan(ROOT)

  it('repeat only where the allowlist says, with the count it says, and none runs again by itself', () => {
    expect(tree.problems).toEqual([])
    expect(tree.loops).toEqual([])
  })

  it('finds the five repeating calls the tree holds: the slideshow\'s two, the email poll, the minute clock and the price clock in a .ts hook', () => {
    const where = tree.intervals.map((f) => f.file)
    expect(where).toEqual(['src/hooks/useNow.ts', 'src/pages/AdminEmailPage.tsx', 'src/pages/AnnualMeetingPage.tsx', 'src/pages/HomePage.tsx', 'src/pages/HomePage.tsx'])
  })

  it('reads the one-shot timers as one-shot: the debounce, the reload, the give-up, the scroll, the copied message and the rest', () => {
    const files = new Set(tree.oneShots.map((f) => f.file))
    for (const file of [
      'src/areas/membership/components/UscfSearchInput.tsx',
      'src/areas/households/components/FamilyRegistrationPanel.tsx',
      'src/pages/ResetPasswordPage.tsx',
      'src/pages/TournamentsPage.tsx',
      'src/pages/ScannerPage.tsx',
      'src/areas/clubs/clubMap.ts',
    ]) expect(files, file).toContain(file)
    expect(tree.oneShots.length).toBeGreaterThanOrEqual(7)
  })

  it('gives every entry a reason and a count, one entry a file, and keeps the slideshow\'s until WS03', () => {
    expect(new Set(ALLOWED.map((a) => a.file)).size).toBe(ALLOWED.length)
    for (const a of ALLOWED) {
      expect(a.count, a.file).toBeGreaterThan(0)
      expect(a.reason.length, a.file).toBeGreaterThan(60)
    }
    expect(ALLOWED.find((a) => a.file === 'src/pages/HomePage.tsx')?.reason).toMatch(/newLook off.*WS03/s)
  })

  it('the home page sets its two only inside HeroSlideshow, which is drawn only with newLook off', () => {
    const source = readFileSync(join(ROOT, 'src/pages/HomePage.tsx'), 'utf8')
    const sf = ts.createSourceFile('HomePage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const inside: string[] = []
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && timerOf(n)) inside.push(enclosingNames(n).at(-1) ?? '(top level)')
      ts.forEachChild(n, visit)
    }
    visit(sf)
    expect(inside).toEqual(['HeroSlideshow', 'HeroSlideshow'])
    expect(source).toContain('{FEATURES.newLook ? <HomeHero /> : <HeroSlideshow />}')
    expect(source.match(/<HeroSlideshow\b/g)).toHaveLength(1)
  })
})

describe('the rules on a planted tree', () => {
  const work = mkdtempSync(join(tmpdir(), 'no-rotation-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  let n = 0

  function plant(files: Record<string, string>): string {
    const root = join(work, `t${n++}`)
    mkdirSync(join(root, 'src'), { recursive: true })
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }

  /** The allowlisted files as they are today, so a planted tree starts clean. */
  const today = () => Object.fromEntries(ALLOWED.map((a) => [a.file, readFileSync(join(ROOT, a.file), 'utf8')]))

  it('passes the allowlisted files as they are, and a one-shot timer anywhere', () => {
    const root = plant({
      ...today(),
      'src/pages/Planted.tsx': `export function Planted({ q }: { q: string }) {\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => search(q), 300)\n    return () => clearTimeout(t)\n  }, [q])\n  return null\n}\n`,
    })
    expect(scan(root).problems).toEqual([])
  })

  it('fails a slideshow on a repeating timer in a TSX page', () => {
    const root = plant({
      ...today(),
      'src/pages/Planted.tsx': `export function Planted() {\n  const [i, setI] = useState(0)\n  useEffect(() => {\n    const t = ${INTERVAL}(() => setI((c) => c + 1), 5000)\n    return () => clearInterval(t)\n  }, [])\n  return <p>{i}</p>\n}\n`,
    })
    expect(scan(root).problems).toEqual([`src/pages/Planted.tsx:4 ${INTERVAL} repeats with no entry in the allowlist; nothing on the site may move on by itself`])
  })

  it('fails a repeating timer in a .ts hook, and one called on window', () => {
    const root = plant({
      ...today(),
      'src/hooks/usePlanted.ts': `export function usePlanted(next: () => void) {\n  useEffect(() => {\n    const t = window.${INTERVAL}(next, 4000)\n    return () => window.clearInterval(t)\n  }, [next])\n}\n`,
    })
    expect(scan(root).problems).toEqual([`src/hooks/usePlanted.ts:3 ${INTERVAL} repeats with no entry in the allowlist; nothing on the site may move on by itself`])
  })

  it('fails a timer that schedules itself again', () => {
    const root = plant({ ...today(), 'src/components/Ticker.tsx': `function tick() {\n  advance()\n  ${TIMEOUT}(tick, 5000)\n}\nexport function Ticker() {\n  tick()\n  return null\n}\n` })
    expect(scan(root).problems).toEqual([`src/components/Ticker.tsx:3 ${TIMEOUT} runs again by itself: its callback is tick, the function it sits in`])
  })

  it('fails a timer whose callback starts the function it sits in, and a frame that asks for the next', () => {
    const root = plant({
      ...today(),
      'src/components/Rotator.tsx': `const rotate = () => {\n  show(next())\n  ${TIMEOUT}(() => { rotate() }, 5000)\n}\nexport function Rotator() {\n  rotate()\n  return null\n}\n`,
      'src/components/Marquee.tsx': `export function Marquee() {\n  function frame() {\n    slide(1)\n    ${FRAME}(frame)\n  }\n  frame()\n  return null\n}\n`,
    })
    expect(scan(root).problems).toEqual([
      `src/components/Marquee.tsx:4 ${FRAME} runs again by itself: its callback is frame, the function it sits in`,
      `src/components/Rotator.tsx:3 ${TIMEOUT} runs again by itself: its callback calls rotate, the function it sits in`,
    ])
  })

  it('fails a slideshow built on an effect that sets the state it depends on', () => {
    const root = plant({
      ...today(),
      'src/pages/Planted.tsx': `export function Planted() {\n  const [slide, setSlide] = useState(0)\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => setSlide((s) => (s + 1) % 5), 5000)\n    return () => clearTimeout(t)\n  }, [slide])\n  return <p>{slide}</p>\n}\n`,
    })
    expect(scan(root).problems).toEqual([`src/pages/Planted.tsx:4 ${TIMEOUT} runs again by itself: its callback sets slide, a state the effect it sits in depends on, so the effect runs again`])
  })

  it('fails a slideshow on an effect with no dependency list, or with one that is not written out, which runs again after every render', () => {
    const root = plant({
      ...today(),
      'src/components/Slides.tsx': `export function Slides() {\n  const [index, setIndex] = useState(0)\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => setIndex((i) => (i + 1) % 5), 5000)\n    return () => clearTimeout(t)\n  })\n  return <p>{index}</p>\n}\n`,
      'src/components/Reel.tsx': `export function Reel({ deps }: { deps: unknown[] }) {\n  const [frame, setFrame] = useState(0)\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => setFrame((f) => f + 1), 3000)\n    return () => clearTimeout(t)\n  }, deps)\n  return <p>{frame}</p>\n}\n`,
    })
    expect(scan(root).problems).toEqual([
      `src/components/Reel.tsx:4 ${TIMEOUT} runs again by itself: its callback sets frame, and the effect it sits in has a dependency list that is not written out, so it counts as one that runs again after every render`,
      `src/components/Slides.tsx:4 ${TIMEOUT} runs again by itself: its callback sets index, and the effect it sits in has no dependency list, so it runs again after every render`,
    ])
  })

  it('fails a slideshow whose effect lists a value read from the state its timer sets, through useMemo or not', () => {
    const root = plant({
      ...today(),
      'src/components/Showcase.tsx': `const slides = ['a', 'b', 'c']\nexport function Showcase() {\n  const [index, setIndex] = useState(0)\n  const slide = slides[index]\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => setIndex((i) => (i + 1) % slides.length), 5000)\n    return () => clearTimeout(t)\n  }, [slide])\n  return <p>{slide}</p>\n}\n`,
      'src/components/Spotlight.tsx': `export function Spotlight({ items }: { items: string[] }) {\n  const [at, setAt] = useState(0)\n  const current = useMemo(() => items[at % items.length], [items, at])\n  const label = current.toUpperCase()\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => setAt((n) => n + 1), 4000)\n    return () => clearTimeout(t)\n  }, [label])\n  return <p>{label}</p>\n}\n`,
    })
    expect(scan(root).problems).toEqual([
      `src/components/Showcase.tsx:6 ${TIMEOUT} runs again by itself: its callback sets index, a state the effect it sits in depends on through slide, so the effect runs again`,
      `src/components/Spotlight.tsx:6 ${TIMEOUT} runs again by itself: its callback sets at, a state the effect it sits in depends on through label, so the effect runs again`,
    ])
  })

  it('fails a slideshow whose effect lists a function written in the component without useCallback, made anew on every render', () => {
    const root = plant({
      ...today(),
      'src/components/Rotor.tsx': `export function Rotor() {\n  const [index, setIndex] = useState(0)\n  const next = () => setIndex((i) => (i + 1) % 3)\n  useEffect(() => {\n    const t = ${TIMEOUT}(next, 5000)\n    return () => clearTimeout(t)\n  }, [next])\n  return <p>{index}</p>\n}\n`,
      'src/components/Tumbler.tsx': `export function Tumbler() {\n  const [face, setFace] = useState(0)\n  function roll() {\n    setFace((f) => (f + 1) % 6)\n  }\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => roll(), 2000)\n    return () => clearTimeout(t)\n  }, [roll])\n  return <p>{face}</p>\n}\n`,
    })
    expect(scan(root).problems).toEqual([
      `src/components/Rotor.tsx:5 ${TIMEOUT} runs again by itself: its callback, next, sets index, and the effect it sits in depends on next, made anew on every render, so it runs again after every render`,
      `src/components/Tumbler.tsx:7 ${TIMEOUT} runs again by itself: its callback calls roll, which sets face, and the effect it sits in depends on roll, made anew on every render, so it runs again after every render`,
    ])
  })

  it('passes an effect with an empty list, one whose list names only a prop, a function kept by useCallback, or a figure read from an object made in the component', () => {
    const root = plant({
      ...today(),
      'src/components/GiveUp.tsx': `export function GiveUp() {\n  const [phase, setPhase] = useState('waiting')\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => setPhase('gave up'), 6000)\n    return () => clearTimeout(t)\n  }, [])\n  return <p>{phase}</p>\n}\n`,
      'src/components/Notice.tsx': `export function Notice({ message }: { message: string }) {\n  const [shown, setShown] = useState(true)\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => setShown(false), 4000)\n    return () => clearTimeout(t)\n  }, [message])\n  return shown ? <p>{message}</p> : null\n}\n`,
      'src/components/Kept.tsx': `export function Kept() {\n  const [count, setCount] = useState(0)\n  const bump = useCallback(() => setCount((c) => c + 1), [])\n  useEffect(() => {\n    const t = ${TIMEOUT}(bump, 1000)\n    return () => clearTimeout(t)\n  }, [bump])\n  return <p>{count}</p>\n}\n`,
      'src/components/Delay.tsx': `export function Delay() {\n  const [done, setDone] = useState(false)\n  const options = { wait: 500 }\n  useEffect(() => {\n    const t = ${TIMEOUT}(() => setDone(true), options.wait)\n    return () => clearTimeout(t)\n  }, [options.wait])\n  return <p>{String(done)}</p>\n}\n`,
    })
    const planted = scan(root)
    expect(planted.problems).toEqual([])
    expect(planted.oneShots.filter((f) => /GiveUp|Notice|Kept|Delay/.test(f.file)).map((f) => f.file)).toEqual([
      'src/components/Delay.tsx',
      'src/components/GiveUp.tsx',
      'src/components/Kept.tsx',
      'src/components/Notice.tsx',
    ])
  })

  it('fails one call more than the allowlist allows in an allowlisted file, and an entry left up after its calls are gone', () => {
    const home = readFileSync(join(ROOT, 'src/pages/HomePage.tsx'), 'utf8')
    const more = plant({ ...today(), 'src/pages/HomePage.tsx': `${home}\nexport function useThird(go: () => void) {\n  useEffect(() => {\n    const t = ${INTERVAL}(go, 5000)\n    return () => clearInterval(t)\n  }, [go])\n}\n` })
    expect(scan(more).problems).toEqual([`src/pages/HomePage.tsx has 3 ${INTERVAL} call(s) where the allowlist says 2`])
    const files = today()
    delete files['src/pages/AnnualMeetingPage.tsx']
    const gone = plant(files)
    expect(scan(gone).problems).toEqual([`src/pages/AnnualMeetingPage.tsx has no ${INTERVAL} call where the allowlist says 1; take its entry down`])
  })

  it('fails a carousel whose effect runs a helper on a timer, or hands it a reducer\'s dispatch, that moves the slide the effect depends on', () => {
    const root = plant({
      ...today(),
      'src/components/Carousel.tsx': `export function Carousel({ count }: { count: number }) {\n  const [index, setIndex] = useState(0)\n  const next = () => setIndex((i) => (i + 1) % count)\n  useEffect(() => {\n    const t = ${TIMEOUT}(next, 5000)\n    return () => clearTimeout(t)\n  }, [index])\n  return <p>{index}</p>\n}\n`,
      'src/components/Gallery.tsx': `export function Gallery() {\n  const [shown, setShown] = useState(0)\n  function advance() {\n    setShown((s) => s + 1)\n  }\n  useEffect(() => {\n    const t = window.${TIMEOUT}(() => advance(), 4000)\n    return () => window.clearTimeout(t)\n  }, [shown])\n  return <p>{shown}</p>\n}\n`,
      'src/components/Stepper.tsx': `export function Stepper() {\n  const [step, next] = useReducer((s: number) => s + 1, 0)\n  useEffect(() => {\n    const t = ${TIMEOUT}(next, 3000)\n    return () => clearTimeout(t)\n  }, [step])\n  return <p>{step}</p>\n}\n`,
    })
    expect(scan(root).problems).toEqual([
      `src/components/Carousel.tsx:5 ${TIMEOUT} runs again by itself: its callback, next, sets index, a state the effect it sits in depends on, so the effect runs again`,
      `src/components/Gallery.tsx:7 ${TIMEOUT} runs again by itself: its callback calls advance, which sets shown, a state the effect it sits in depends on, so the effect runs again`,
      `src/components/Stepper.tsx:4 ${TIMEOUT} runs again by itself: its callback, next, sets step, a state the effect it sits in depends on, so the effect runs again`,
    ])
  })

  it('fails a timer that a useCallback, a class method or a class field schedules again, and one that comes back through another function', () => {
    const root = plant({
      ...today(),
      'src/components/Ticker.tsx': `export function Ticker() {\n  const tick = useCallback(() => {\n    advance()\n    ${TIMEOUT}(tick, 5000)\n  }, [])\n  useEffect(() => {\n    tick()\n  }, [tick])\n  return null\n}\n`,
      'src/components/Banner.tsx': `export class Banner extends Component {\n  rotate() {\n    this.setState(next)\n    ${TIMEOUT}(() => this.rotate(), 5000)\n  }\n  spin = () => {\n    this.setState(next)\n    ${FRAME}(this.spin)\n  }\n  render() {\n    return null\n  }\n}\n`,
      'src/areas/news/headlines.ts': `function show() {\n  advance()\n  ${TIMEOUT}(again, 3000)\n}\nfunction again() {\n  show()\n}\nexport function startHeadlines() {\n  show()\n}\n`,
      'src/components/Fader.tsx': `export function Fader() {\n  const fade = () => {\n    dim()\n    ${TIMEOUT}(() => later(), 1000)\n  }\n  const later = () => fade()\n  fade()\n  return null\n}\n`,
    })
    expect(scan(root).problems).toEqual([
      `src/areas/news/headlines.ts:3 ${TIMEOUT} runs again by itself: its callback, again, leads back to show, the function it sits in`,
      `src/components/Banner.tsx:4 ${TIMEOUT} runs again by itself: its callback calls rotate, the function it sits in`,
      `src/components/Banner.tsx:8 ${FRAME} runs again by itself: its callback is spin, the function it sits in`,
      `src/components/Fader.tsx:4 ${TIMEOUT} runs again by itself: its callback calls later, which leads back to fade, the function it sits in`,
      `src/components/Ticker.tsx:4 ${TIMEOUT} runs again by itself: its callback is tick, the function it sits in`,
    ])
  })

  it('passes a debounce whose helper sets only what its effect does not depend on, and a message a helper clears once', () => {
    const root = plant({
      ...today(),
      'src/components/Lookup.tsx': `export function Lookup({ id }: { id: string }) {\n  const [status, setStatus] = useState('idle')\n  const [found, setFound] = useState(null)\n  async function look() {\n    setStatus('loading')\n    setFound(await find(id))\n    setStatus('done')\n  }\n  useEffect(() => {\n    const t = ${TIMEOUT}(look, 600)\n    return () => clearTimeout(t)\n  }, [id])\n  return <p>{status}{String(found)}</p>\n}\n`,
      'src/components/Copied.tsx': `export function Copied() {\n  const [copied, setCopied] = useState(false)\n  const clear = () => setCopied(false)\n  function copy() {\n    setCopied(true)\n    ${TIMEOUT}(() => clear(), 2000)\n  }\n  return <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>\n}\n`,
    })
    const planted = scan(root)
    expect(planted.problems).toEqual([])
    expect(planted.oneShots.filter((f) => /Lookup|Copied/.test(f.file)).map((f) => `${f.file}:${f.line}`)).toEqual(['src/components/Copied.tsx:6', 'src/components/Lookup.tsx:10'])
  })
})
