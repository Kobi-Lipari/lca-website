// test/unit/image-budget.test.ts
//
// The hero pictures scripts/images.mjs writes (WS01 step 29; acceptance
// criterion 7 and the brief's budget of 200 KB for the homepage picture a
// phone downloads, with a width and a height on every image).
//
// - src/assets/generated holds the 30 files and nothing else: each of the
//   five slide photos as AVIF and as WebP, 640, 1024 and 1600 pixels wide.
//   Each file's width and height are read from its own header (the AVIF's
//   ispe box, the WebP's frame header), not from its name, and its height is
//   its photo's shape at its width; each is 200,000 bytes or less, the 1600
//   pixel file of slide 1 that a 390 pixel phone at three times density
//   takes among them.
// - The home page's still picture names slide 1's six files and gives the
//   photo's own width and height, read from LCA_Slide_1.jpg's header.
// - hero.png is left out: no file is written from it and nothing names it.
// - sharp is used by the script alone, run by hand: no file a build or a
//   test loads imports it, so neither needs it. It and lighthouse are pinned
//   to exact versions.
//
// Nothing here loads sharp: the headers are read byte by byte.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const GENERATED = join(ROOT, 'src/assets/generated')
const LIMIT = 200_000
const SLIDES = [1, 2, 3, 4, 5]
const WIDTHS = [640, 1024, 1600]
const FORMATS = ['avif', 'webp'] as const
const EXPECTED = SLIDES.flatMap((n) => WIDTHS.flatMap((w) => FORMATS.map((f) => `LCA_Slide_${n}-${w}.${f}`))).sort()
/** The image library's name, put together here so this file holds no import of it to find. */
const SHARP = ['sh', 'arp'].join('')

interface Size {
  width: number
  height: number
}

/** A JPEG's size, from its first start-of-frame marker. */
function jpegSize(buf: Buffer): Size {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG')
  let at = 2
  while (at < buf.length) {
    if (buf[at] !== 0xff) throw new Error(`no marker at ${at}`)
    const marker = buf[at + 1]
    if (marker === 0xff) {
      at += 1
      continue
    }
    const frame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (frame) return { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) }
    at += 2 + buf.readUInt16BE(at + 2)
  }
  throw new Error('no start-of-frame marker')
}

/** A WebP's size, from its first chunk: a lossy frame, a lossless one or the extended header. */
function webpSize(buf: Buffer): Size {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') throw new Error('not a WebP')
  const chunk = buf.toString('latin1', 12, 16)
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) throw new Error('no VP8 start code')
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
  throw new Error(`unknown WebP chunk ${chunk}`)
}

/** The boxes of an ISO media file between two offsets: their type and where their content starts and ends. */
function boxes(buf: Buffer, start: number, end: number): Array<{ type: string; body: number; end: number }> {
  const out: Array<{ type: string; body: number; end: number }> = []
  let at = start
  while (at + 8 <= end) {
    let size = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    let body = at + 8
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(at + 8))
      body = at + 16
    } else if (size === 0) size = end - at
    out.push({ type, body, end: at + size })
    at += size
  }
  return out
}

/** An AVIF's brand and size, from the one ispe box its meta box holds. */
function avifSize(buf: Buffer): Size & { brand: string } {
  const top = boxes(buf, 0, buf.length)
  const ftyp = top.find((b) => b.type === 'ftyp')
  const meta = top.find((b) => b.type === 'meta')
  if (!ftyp || !meta) throw new Error('no ftyp or meta box')
  // meta, like ispe, is a full box: four bytes of version and flags come first.
  const iprp = boxes(buf, meta.body + 4, meta.end).find((b) => b.type === 'iprp')
  const ipco = iprp && boxes(buf, iprp.body, iprp.end).find((b) => b.type === 'ipco')
  const ispe = ipco ? boxes(buf, ipco.body, ipco.end).filter((b) => b.type === 'ispe') : []
  if (ispe.length !== 1) throw new Error(`${ispe.length} ispe boxes`)
  return { brand: buf.toString('latin1', ftyp.body, ftyp.body + 4), width: buf.readUInt32BE(ispe[0].body + 4), height: buf.readUInt32BE(ispe[0].body + 8) }
}

const slidePhoto = (n: number) => jpegSize(readFileSync(join(ROOT, `src/assets/LCA_Slide_${n}.jpg`)))

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

describe('the generated hero pictures', () => {
  it('are the 30 files and nothing else: five slides, three widths, AVIF and WebP', () => {
    expect(readdirSync(GENERATED).sort()).toEqual(EXPECTED)
    expect(EXPECTED).toHaveLength(30)
  })

  it('reads the photos\' own shapes from their headers: 2048 pixels wide, three shapes among them', () => {
    expect(SLIDES.map(slidePhoto)).toEqual([
      { width: 2048, height: 1237 },
      { width: 2048, height: 1536 },
      { width: 2048, height: 1536 },
      { width: 2048, height: 882 },
      { width: 2048, height: 1536 },
    ])
  })

  describe.each(SLIDES)('slide %i', (n) => {
    it.each(WIDTHS.flatMap((w) => FORMATS.map((f) => [w, f] as const)))('at %i pixels as %s: that width in its header, the photo\'s shape, 200,000 bytes or less', (w, format) => {
      const name = `LCA_Slide_${n}-${w}.${format}`
      const buf = readFileSync(join(GENERATED, name))
      const size = format === 'avif' ? avifSize(buf) : webpSize(buf)
      if (format === 'avif') expect((size as ReturnType<typeof avifSize>).brand, name).toBe('avif')
      expect(size.width, name).toBe(w)
      const photo = slidePhoto(n)
      expect(Math.abs(size.height - (w * photo.height) / photo.width), name).toBeLessThanOrEqual(1)
      expect(buf.length, name).toBeLessThanOrEqual(LIMIT)
    })
  })

  it('keeps the file a 390 pixel phone at three times density takes for the hero, slide 1 at 1600, under 200,000 bytes in both formats', () => {
    // 390 times 3 is 1170 device pixels, and the picture is drawn at least 696 pixels wide, so the browser takes the 1600 file.
    for (const format of FORMATS) expect(statSync(join(GENERATED, `LCA_Slide_1-1600.${format}`)).size, format).toBeLessThanOrEqual(LIMIT)
  })
})

describe('the home page\'s still picture', () => {
  const home = readFileSync(join(ROOT, 'src/pages/HomePage.tsx'), 'utf8')
  const still = home.slice(home.indexOf('const heroStill = {'), home.indexOf('\n}\n', home.indexOf('const heroStill = {')))

  it('names slide 1\'s six files, each imported on its own so a build carries only those', () => {
    for (const w of WIDTHS) {
      for (const f of FORMATS) {
        const name = `slide1${f[0].toUpperCase()}${f.slice(1)}${w}`
        expect(home, name).toContain(`import ${name} from '@/assets/generated/LCA_Slide_1-${w}.${f}'`)
        expect(still, name).toContain(`{ src: ${name}, width: ${w} }`)
      }
    }
    expect(home).not.toMatch(/import\.meta\.glob/)
    expect(home.match(/@\/assets\/generated\//g)).toHaveLength(6)
  })

  it('gives the photo\'s own width and height, as LCA_Slide_1.jpg\'s header has them', () => {
    const photo = slidePhoto(1)
    expect(still).toContain(`width: ${photo.width},`)
    expect(still).toContain(`height: ${photo.height},`)
  })
})

describe('what the pictures are made from, and with', () => {
  const script = readFileSync(join(ROOT, 'scripts/images.mjs'), 'utf8')

  it('leaves hero.png out: the script reads the five slides only, writes nothing from it, and no page names it', () => {
    expect(script).toContain("const SOURCES = ['LCA_Slide_1.jpg', 'LCA_Slide_2.jpg', 'LCA_Slide_3.jpg', 'LCA_Slide_4.jpg', 'LCA_Slide_5.jpg']")
    expect(script).toContain('const WIDTHS = [640, 1024, 1600]')
    expect(script).toContain('const LIMIT = 200_000')
    expect(readdirSync(GENERATED).filter((name) => name.startsWith('hero'))).toEqual([])
    const named = [...filesUnder(join(ROOT, 'src')), join(ROOT, 'index.html')].filter((path) => /\.(tsx?|css|html)$/.test(path) && readFileSync(path, 'utf8').includes('hero.png'))
    expect(named).toEqual([])
  })

  it('imports sharp in the script alone: nothing a build or a test loads does', () => {
    const importsIt = new RegExp(`(?:\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\brequire\\s*\\(\\s*)['"]${SHARP}['"]`)
    expect(script).toMatch(importsIt)
    const loaded = [
      ...['src', 'test', 'functions', 'domain', 'workers'].flatMap((dir) => filesUnder(join(ROOT, dir))),
      ...['vite.config.ts', 'vitest.config.ts', 'vitest.integration.config.ts', 'playwright.config.ts', 'eslint.config.js', 'index.html'].map((f) => join(ROOT, f)),
    ].filter((path) => /\.(m?[jt]sx?|html)$/.test(path) && !path.includes('node_modules'))
    expect(loaded.length).toBeGreaterThan(300)
    const importers = loaded.filter((path) => importsIt.test(readFileSync(path, 'utf8'))).map((path) => relative(ROOT, path))
    expect(importers).toEqual([])
  })

  it('pins sharp and lighthouse to exact versions, sharp at the one copy the lockfile already held', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { devDependencies: Record<string, string>; dependencies: Record<string, string>; scripts: Record<string, string> }
    expect(pkg.devDependencies[SHARP]).toBe('0.34.5')
    expect(pkg.devDependencies.lighthouse).toBe('13.5.0')
    expect(pkg.dependencies[SHARP]).toBeUndefined()
    expect(pkg.scripts.images).toBe('node scripts/images.mjs')
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string; dev?: boolean }> }
    expect(lock.packages[''].devDependencies).toMatchObject({ [SHARP]: '0.34.5', lighthouse: '13.5.0' })
    const copies = Object.keys(lock.packages).filter((key) => key === `node_modules/${SHARP}` || key.endsWith(`/node_modules/${SHARP}`))
    expect(copies).toEqual([`node_modules/${SHARP}`])
    expect(lock.packages[`node_modules/${SHARP}`]).toMatchObject({ version: '0.34.5', dev: true })
    expect(lock.packages['node_modules/lighthouse']).toMatchObject({ version: '13.5.0', dev: true })
  })
})
