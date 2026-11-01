import { readFileSync } from 'node:fs'
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { PREPAINT_SCRIPT } from './src/lib/colorScheme.ts'

/** The mode of the accessibility test build, the only mode that reads VITE_FLAGS (FLAG_OVERRIDE_MODE in src/lib/features.ts). */
const FLAG_OVERRIDE_MODE = 'a11y'

/** The switches the build itself reads: newLook for the color scheme script, and newNav with it for the viewport tag. */
export type BuildSwitch = 'newLook' | 'newNav'

/**
 * Whether a switch is on in this build. src/lib/features.ts cannot be
 * imported here, because it reads import.meta.env, which only exists inside
 * the site's own bundle; so this reads the value written in that file and,
 * in the accessibility test build only, the names in VITE_FLAGS, the same
 * rule as applyFlagOverrides. A file that sets the switch other than once,
 * as true or false, stops the build. test/unit/prepaint-gate.test.ts checks
 * the two agree, for each switch read here.
 */
export function switchInBuild(name: BuildSwitch, featuresSource: string, mode: string, flags: string | undefined): boolean {
  const written = [...featuresSource.matchAll(new RegExp(`^\\s*${name}:\\s*(true|false),`, 'gm'))]
  if (written.length !== 1) {
    throw new Error(`src/lib/features.ts should set ${name} once, as true or false; found ${written.length} settings.`)
  }
  if (written[0][1] === 'true') return true
  if (mode !== FLAG_OVERRIDE_MODE) return false
  return (flags ?? '').split(',').map((flag) => flag.trim()).includes(name)
}

/** Whether the newLook switch is on in this build. */
export function newLookInBuild(featuresSource: string, mode: string, flags: string | undefined): boolean {
  return switchInBuild('newLook', featuresSource, mode, flags)
}

/** Whether the newNav switch is on in this build. */
export function newNavInBuild(featuresSource: string, mode: string, flags: string | undefined): boolean {
  return switchInBuild('newNav', featuresSource, mode, flags)
}

/** The viewport tag of today's index.html, byte for byte. */
export const TODAYS_VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'

/**
 * The same tag with viewport-fit=cover, which lets the page reach under a
 * phone's notch and its home indicator, where the new chrome's bars keep
 * their words and controls inside the safe area (env(safe-area-inset-*)).
 */
export const COVER_VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />'

/**
 * The page with today's viewport tag given viewport-fit=cover. It writes
 * nothing new into the page: a page that does not hold today's tag exactly
 * once stops the build, so a changed index.html is found here and not on a
 * phone.
 */
export function withCoverViewport(html: string): string {
  const found = html.split(TODAYS_VIEWPORT).length - 1
  if (found !== 1) throw new Error(`index.html should hold today's viewport tag once; found ${found}.`)
  return html.replace(TODAYS_VIEWPORT, COVER_VIEWPORT)
}

/** The name of the meta that holds the build's date, which the new footer reads (src/components/layout/footerParts.ts). */
export const BUILD_DATE_META = 'build-date'

/** An instant as the build writes it: Date's toISOString, in UTC, to the millisecond. */
const BUILD_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * The page with the build's date written into it: one meta right after the
 * viewport tag, on a line of its own at that tag's indent,
 * <meta name="build-date" content="the instant" />. A page that does not
 * hold the viewport tag with viewport-fit=cover exactly once, or an instant
 * not in the build's own form, stops the build, so the meta is never
 * written anywhere else or twice.
 */
export function withBuildDate(html: string, instant: string): string {
  if (!BUILD_INSTANT.test(instant)) throw new Error(`The build's date should be an instant such as 2026-10-31T14:42:00.000Z; found ${JSON.stringify(instant)}.`)
  const found = html.split(COVER_VIEWPORT).length - 1
  if (found !== 1) throw new Error(`index.html should hold the viewport tag with viewport-fit=cover once; found ${found}.`)
  const at = html.indexOf(COVER_VIEWPORT)
  const indent = html.slice(html.lastIndexOf('\n', at) + 1, at)
  const end = at + COVER_VIEWPORT.length
  return `${html.slice(0, end)}\n${indent}<meta name="${BUILD_DATE_META}" content="${instant}" />${html.slice(end)}`
}

/**
 * Puts the color scheme script (PREPAINT_SCRIPT in src/lib/colorScheme.ts)
 * at the top of the page head when newLook is on, so the new look and dark
 * mode are applied before the first paint. With newLook off it adds nothing:
 * a build without the switch can never add .dark to the page. With the
 * chrome on, newNav and newLook both (chromeOn in src/lib/nav.ts), it also
 * gives the page's viewport tag viewport-fit=cover, since only the new
 * chrome pads for a phone's notch; with either switch off the tag is today's.
 * Both switches are read from one reading of the file.
 *
 * With the chrome on it also writes the build's date into the page, as a
 * meta beside the viewport tag (withBuildDate), which the new footer's trust
 * line shows as "Site last updated" (WS02 step 8): the instant the build
 * ran, in UTC, which the footer shows as its Louisiana day. Each build with
 * the chrome on writes its own, the CI build and the Pages build alike, so
 * the date is the build's, not the commit's. It goes into index.html alone,
 * which every deploy writes anew and nothing names by a hash, so no other
 * file changes for it and no file is renamed; with either switch off nothing
 * is written for it at all.
 */
export function prepaintPlugin(featuresFile = path.resolve(__dirname, 'src/lib/features.ts')): Plugin {
  let newLook = false
  let cover = false
  let instant = ''
  return {
    name: 'lca-prepaint',
    configResolved(config) {
      const source = readFileSync(featuresFile, 'utf8')
      newLook = newLookInBuild(source, config.mode, config.env.VITE_FLAGS)
      cover = newNavInBuild(source, config.mode, config.env.VITE_FLAGS) && newLook
      // The build's own instant, worked out once for the build.
      instant = new Date().toISOString()
    },
    transformIndexHtml(html) {
      if (!newLook) return undefined
      const tags = [{ tag: 'script', children: PREPAINT_SCRIPT, injectTo: 'head-prepend' as const }]
      return cover ? { html: withBuildDate(withCoverViewport(html), instant), tags } : tags
    },
  }
}

/**
 * The new footer's two sized copies of the logo (src/assets/lca-logo-56.webp
 * and lca-logo-112.webp), by their path.
 */
export const SIZED_LOGO = /[\\/]src[\\/]assets[\\/]lca-logo-(?:56|112)\.webp$/

/**
 * Whether an imported file is written into the script that imports it as a
 * data address: never for the logo's two sized copies, which stay files of
 * their own, fetched only by the page that draws them, rather than riding in
 * the main script every visitor loads (the 56 pixel copy is under Vite's
 * 4,096 byte line); every other file by Vite's own rule (undefined).
 */
export function inlineAsset(file: string): false | undefined {
  return SIZED_LOGO.test(file) ? false : undefined
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    prepaintPlugin(),
  ],
  build: {
    // The logo's sized copies stay files of their own (inlineAsset).
    assetsInlineLimit: inlineAsset,
    rolldownOptions: {
      output: {
        // The switches keep a chunk of their own (features-[hash].js) now
        // that src/main.tsx reads one, so the accessibility tests can load
        // the very switches a build was made with (test/a11y/builds.spec.ts).
        // The class helpers (src/lib/utils.ts with clsx and tailwind-merge)
        // and tslib, the small helper library the sign-in library and the
        // dialog parts both use, make one file every page loads
        // (utils-[hash].js), so tslib never becomes a file of its own when
        // the parts fetched on demand that ask for it differ from those that
        // ask for the sign-in library.
        codeSplitting: {
          groups: [
            { name: 'features', test: /[\\/]src[\\/]lib[\\/]features\.ts$/ },
            { name: 'utils', test: /([\\/]src[\\/]lib[\\/]utils\.ts$)|([\\/]node_modules[\\/](clsx|tailwind-merge|tslib)[\\/])/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@domain': path.resolve(__dirname, './domain'),
    },
  },
})
