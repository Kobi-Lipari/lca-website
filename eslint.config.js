import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

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

export default defineConfig([
  // The lint fixture breaks the domain/ rules on purpose; its test lints it.
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
])
