// Render a canvas artboard (.dc.html) to PNG for local review.
// Usage: node render.mjs <board.dc.html> <outPrefix> [width] [scale]
// Rewrites the canvas-only /_blob/ URLs to local files so kit.css and the
// hall photo resolve, then screenshots the full page at the given width.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const [,, input, outPrefix, widthArg, scaleArg] = process.argv
if (!input || !outPrefix) { console.error('usage: render.mjs <board.dc.html> <outPrefix> [width] [scale]'); process.exit(2) }
const width = Number(widthArg || 1440)
const scale = Number(scaleArg || 0.5)

// <repo>: the repository root, three folders above this file (docs/redesign/tools).
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const KIT = `file://${REPO}/docs/redesign/lca-redesign-boards/kit.css`
const PHOTO = `file://${REPO}/src/assets/LCA_Slide_1.jpg`
const LOGO = `file://${REPO}/public/lca-logo.jpg`

let html = readFileSync(input, 'utf8')
html = html.replace(/\/_blob\/6107adb451dbab26ee5d89f4189b81f8/g, KIT)
// Any other blob: a logo if the tag mentions logo, otherwise the hall photo.
html = html.replace(/(<img[^>]*?)src="\/_blob\/[a-f0-9]+"/g, (m, pre) => /logo|mark|seal/i.test(m) ? `${pre}src="${LOGO}"` : `${pre}src="${PHOTO}"`)
html = html.replace(/url\((['"]?)\/_blob\/[a-f0-9]+\1\)/g, `url(${PHOTO})`)
html = html.replace(/<script src="\.\/support\.js"><\/script>/, '')
// Replace any residual {{hole}} with its name so the layout still reads.
html = html.replace(/\{\{([^}]+)\}\}/g, '$1')

// Keep the temp copy out of the repo: write it next to the output prefix, but
// resolve relative asset paths (kit.css, photos) against the input's folder.
const inputDir = dirname(resolve(input))
html = html.replace(/(href|src)="\.\/([^"]+)"/g, (m, attr, rel) => `${attr}="file://${inputDir}/${rel}"`)
const tmp = resolve(`${outPrefix}.render.html`)
writeFileSync(tmp, html)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] })
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: scale })
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text().slice(0, 200)) })
await page.goto(`file://${tmp}`, { waitUntil: 'load' })
await page.waitForTimeout(800)
const height = await page.evaluate(() => document.documentElement.scrollHeight)
await page.screenshot({ path: `${outPrefix}.full.png`, fullPage: true })
await page.setViewportSize({ width, height: Math.min(1100, height) })
await page.screenshot({ path: `${outPrefix}.top.png`, fullPage: false })
await browser.close()
console.log(JSON.stringify({ input: basename(input), width, height, full: `${outPrefix}.full.png`, top: `${outPrefix}.top.png` }))
