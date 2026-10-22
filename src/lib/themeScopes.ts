// src/lib/themeScopes.ts
//
// The looks a part of the page can be drawn in, which look each page gets,
// and how looks may sit inside one another. ThemeScope
// (src/components/ThemeScope.tsx) puts a look on the page; this file holds
// the rules, so they can be tested without rendering anything.
//
// The looks:
//   - base: Looks-3 Minimal, the site's own look. As a scope it is
//     data-theme="", which puts the base look back inside another scope.
//   - heritage: Looks-1 Heritage Club, for the lasting record (About,
//     governance, the annual meeting and Champions).
//   - live: Looks-7 Broadcast Night, for what is happening now at an event.
//   - scholastic: Looks-6 Bright Scholastic, for the Scholastic pages.
// Their colours are the data-theme blocks in src/index.css.
//
// Scopes nest one level only. The one nesting allowed is base inside
// heritage, so the editors and forms on a heritage page keep the base look.
// Heritage never renders inside live.

/** The name of a look, as ThemeScope's scope prop takes it. */
export type ThemeScopeName = 'base' | 'heritage' | 'live' | 'scholastic'

/** Every look, base first. */
export const THEME_SCOPES: readonly ThemeScopeName[] = ['base', 'heritage', 'live', 'scholastic']

/** Whether a value names a look. */
export function isThemeScope(value: unknown): value is ThemeScopeName {
  return typeof value === 'string' && (THEME_SCOPES as readonly string[]).includes(value)
}

/** The data-theme value a look puts on its container; "" is the base look. */
export function dataThemeOf(scope: ThemeScopeName): string {
  return scope === 'base' ? '' : scope
}

/**
 * The pages drawn in the heritage look, exactly these six. The old addresses
 * that redirect here (/governance, /state-champions and /governance/rules)
 * are not pages of their own: they send the visitor on before anything is
 * drawn, so they resolve to base.
 */
export const HERITAGE_ROUTES: readonly string[] = [
  '/about',
  '/governance/board',
  '/governance/bylaws',
  '/governance/minutes',
  '/meeting',
  '/champions',
]

/**
 * Where people do their work: the admin panel, the workspace, the club and
 * tournament tools, My LCA, account settings and the board inbox. Each entry
 * covers the address itself and everything under it. These are always base,
 * whatever else is added to the map later.
 */
export const ALWAYS_BASE_PREFIXES: readonly string[] = [
  '/admin',
  '/workspace',
  '/manage',
  '/dashboard',
  '/account',
  '/board/inbox',
]

/** The path alone, in lower case, with no query, hash or trailing slash. */
function normalise(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0].toLowerCase()
  const trimmed = path.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/**
 * The look a page is drawn in, from its address. The working pages are
 * always base, the six heritage pages are heritage, and everything else is
 * base. React Router matches addresses without regard to case, so this does
 * too. The live and scholastic looks are not chosen by address here: live
 * follows an event's state, and the Scholastic pages get their look when the
 * Scholastic work adds it.
 */
export function routeScope(pathname: string): ThemeScopeName {
  const path = normalise(pathname)
  if (ALWAYS_BASE_PREFIXES.some((prefix) => under(path, prefix))) return 'base'
  if (HERITAGE_ROUTES.includes(path)) return 'heritage'
  return 'base'
}

/**
 * What is wrong with drawing `scope` inside the scopes in `ancestors`
 * (outermost first), or null when it is allowed. A scope with no scope
 * around it is always allowed; inside another scope, only base directly
 * inside heritage is.
 */
export function nestingProblem(ancestors: readonly ThemeScopeName[], scope: ThemeScopeName): string | null {
  if (ancestors.length === 0) return null
  if (ancestors.length === 1 && ancestors[0] === 'heritage' && scope === 'base') return null
  const chain = [...ancestors, scope].join(' > ')
  if (scope === 'heritage' && ancestors.includes('live')) {
    return `ThemeScope: the heritage look never renders inside the live look (${chain}).`
  }
  return `ThemeScope: looks nest one level only, and the one nesting allowed is base inside heritage (${chain}).`
}
