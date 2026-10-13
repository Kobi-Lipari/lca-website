import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { readdirSync } from 'node:fs'

// domain/ holds pure code shared by the site, the server functions and the
// workers, so it may not reach into any of them, into React, or into the
// Workers runtime. Relative paths are matched by the folder they name.
const domainImportBans = [
  { regex: '^@/', message: 'domain/ is shared with the server and workers; it cannot import the site (@/).' },
  { regex: '(^|/)src(/|$)', message: 'domain/ cannot import from src/.' },
  { regex: '(^|/)functions(/|$)', message: 'domain/ cannot import from functions/.' },
  { regex: '^react(-dom)?(/|$)', message: 'domain/ holds no React code.' },
  { regex: '^cloudflare:', message: 'domain/ holds no Workers runtime code.' },
]

// The base block gives every file the browser globals, and flat-config
// globals merge rather than replace, so removing them here would not help.
// typescript-eslint also turns no-undef off for TypeScript. Naming the
// globals is what makes a use of them fail inside domain/.
const domainGlobalBans = ['window', 'document', 'localStorage', 'navigator'].map((name) => ({
  name,
  message: `domain/ code runs on the server and in workers too, where \`${name}\` does not exist.`,
}))

// src/areas holds the site's code by area (events, live, clubs and so on).
// Pages compose the areas, so an area never reaches back into a page.
const areaPageBans = [
  { regex: '^@/pages(/|$)', message: 'src/areas cannot import a page; move the shared piece into the area instead.' },
  { regex: '^(\\.\\./)+pages(/|$)', message: 'src/areas cannot import a page; move the shared piece into the area instead.' },
  { regex: '(^|/)src/pages(/|$)', message: 'src/areas cannot import a page; move the shared piece into the area instead.' },
]

// One area reaches another only through that area's index.ts or api.ts
// (`@/areas/events`, `@/areas/events/index` or `@/areas/events/api`), so each
// area can rearrange its own files freely. Imports inside an area are not
// limited. A warning for now: the deep imports that existed when the rule
// was added are follow-ups in REDESIGN_STATUS.md.
const AREAS = readdirSync(new URL('./src/areas', import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
const crossAreaBans = (area) => {
  const others = `(?!${area}/)(?:${AREAS.join('|')})`
  const deep = '/(?!(?:index|api)(?:\\.[jt]sx?)?$)'
  const message = `Import another area through its index.ts or api.ts, not one of its files (this file is in src/areas/${area}).`
  return [
    { regex: `^@/areas/${others}${deep}`, message },
    { regex: `^(?:\\.\\./)+(?:areas/)?${others}${deep}`, message },
  ]
}

// Pages get their data through the area api modules, not by calling fetch
// themselves. A warning for now: the pages that called fetch when the rule
// was added are follow-ups in REDESIGN_STATUS.md.
const pageFetchMessage = "Pages call the area api modules (such as '@/areas/events/api') rather than fetch."

export default defineConfig([
  // The lint fixtures break the domain/ and src/areas rules on purpose; their
  // tests lint them.
  globalIgnores(['dist', '.claude', 'test/unit/fixtures/lint']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: domainImportBans }],
      'no-restricted-globals': ['error', ...domainGlobalBans],
    },
  },
  {
    files: ['src/areas/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: areaPageBans }],
    },
  },
  // The TypeScript twin of no-restricted-imports carries the cross-area rule,
  // so it can warn while the page rule above stays an error.
  ...AREAS.map((area) => ({
    files: [`src/areas/${area}/**/*.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['warn', { patterns: crossAreaBans(area) }],
    },
  })),
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['warn', { name: 'fetch', message: pageFetchMessage }],
      'no-restricted-properties': [
        'warn',
        ...['window', 'globalThis', 'self'].map((object) => ({ object, property: 'fetch', message: pageFetchMessage })),
      ],
    },
  },
])
