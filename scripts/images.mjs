// scripts/images.mjs
//
// Writes the homepage hero's pictures in the sizes and formats a browser can
// choose from: each of the five slide photos (src/assets/LCA_Slide_1.jpg to
// LCA_Slide_5.jpg, 2048 pixels wide, 2,171,020 bytes in all) as AVIF and as
// WebP at 640, 1024 and 1600 pixels wide, 30 files, into
// src/assets/generated/ as LCA_Slide_<n>-<width>.<avif|webp>. A picture's
// height follows its width, so each file keeps its photo's own shape.
//
// The files are committed, so a build never runs this or needs sharp: run it
// by hand (npm run images) after a slide photo changes, then commit what it
// writes. src/assets/hero.png is left out, because no page or file uses it.
//
// Each file must be 200,000 bytes or less, the brief's 200 KB budget for the
// homepage picture a phone downloads (a 390 pixel wide phone at three times
// density takes the 1600 pixel file). QUALITY below sets the encoder quality
// of each format, with the few files that need less to stay inside the
// budget listed by name. The script checks every file it writes and stops
// with an error, after writing them all, when one is over.
//
// Encoder settings: AVIF and WebP at effort 4, AVIF with its colour stored at
// half resolution (4:2:0, as the photos' own JPEG files and every lossy WebP
// store it). Nothing is copied from the photos but their pixels: no camera
// data and no colour profile. Slides 2, 3 and 5 carry a Display P3 profile,
// which sharp uses to turn their colours into sRGB, the colour space of every
// file written here.
//
// Written and checked with sharp 0.34.5, the version package.json pins. Its
// files are the same, byte for byte, on every run with that version; another
// version may write files of other sizes, which the check catches.
//
// Usage: node scripts/images.mjs
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = join(ROOT, 'src/assets')
const OUT_DIR = join(SOURCE_DIR, 'generated')

/** The slide photos, by file name in src/assets. hero.png is not one of them. */
const SOURCES = ['LCA_Slide_1.jpg', 'LCA_Slide_2.jpg', 'LCA_Slide_3.jpg', 'LCA_Slide_4.jpg', 'LCA_Slide_5.jpg']

/** The widths written, in pixels. */
const WIDTHS = [640, 1024, 1600]

/** The most bytes a written file may hold. */
const LIMIT = 200_000

/**
 * The encoder quality of each format: `all` for every file, and the files
 * that need less to stay at LIMIT or under, by "<photo>@<width>", each with
 * the size it then has. At their format's usual quality those files are
 * over the limit: slide 3 at 1600 pixels is 228,891 bytes as AVIF at 60 and
 * 264,114 as WebP at 75, slide 5 210,463 and 229,892.
 */
const QUALITY = {
  avif: {
    all: 60,
    'LCA_Slide_3@1600': 55, // 195,594 bytes
    'LCA_Slide_5@1600': 57, // 188,139 bytes
  },
  webp: {
    all: 75,
    'LCA_Slide_3@1600': 48, // 192,900 bytes
    'LCA_Slide_5@1600': 60, // 191,364 bytes
  },
}

/** The encoder settings of one format at one quality. */
const ENCODE = {
  avif: (quality) => ({ quality, effort: 4, chromaSubsampling: '4:2:0' }),
  webp: (quality) => ({ quality, effort: 4 }),
}

/** The name a written file gets: LCA_Slide_1.jpg at 640 pixels as AVIF is LCA_Slide_1-640.avif. */
function outputName(source, width, format) {
  return `${source.replace(/\.jpg$/, '')}-${width}.${format}`
}

/** The quality a format is written at for one photo at one width. */
function qualityFor(format, source, width) {
  const table = QUALITY[format]
  return table[`${source.replace(/\.jpg$/, '')}@${width}`] ?? table.all
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const written = []
  for (const source of SOURCES) {
    const input = join(SOURCE_DIR, source)
    for (const width of WIDTHS) {
      for (const format of ['avif', 'webp']) {
        const quality = qualityFor(format, source, width)
        const resized = sharp(input).resize({ width })
        const encoded = format === 'avif' ? resized.avif(ENCODE.avif(quality)) : resized.webp(ENCODE.webp(quality))
        const { data, info } = await encoded.toBuffer({ resolveWithObject: true })
        const name = outputName(source, width, format)
        writeFileSync(join(OUT_DIR, name), data)
        written.push({ name, width: info.width, height: info.height, quality, bytes: statSync(join(OUT_DIR, name)).size })
      }
    }
  }
  for (const f of written) {
    const size = f.bytes.toLocaleString('en-US').padStart(8)
    console.log(`${f.name.padEnd(24)} ${String(f.width).padStart(4)} by ${String(f.height).padEnd(4)} quality ${String(f.quality).padStart(2)}  ${size} bytes`)
  }
  const over = written.filter((f) => f.bytes > LIMIT)
  if (over.length > 0) {
    console.error(`${over.length} file(s) over ${LIMIT.toLocaleString('en-US')} bytes: ${over.map((f) => f.name).join(', ')}. Lower their quality in QUALITY and run this again.`)
    return 1
  }
  console.log(`Wrote ${written.length} files to src/assets/generated, each ${LIMIT.toLocaleString('en-US')} bytes or less.`)
  return 0
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    },
  )
}
