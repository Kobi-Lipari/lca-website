// What K's look at the test site asked of the new club page (K's decision
// 12, checkpoint W), read from the tree: nothing in the server, the client,
// the domain, the workers or the scripts calls the code that built the author
// words, the keepers' own line is the only line the page's band draws, the
// words of the old told line are gone from the code that writes or draws the
// page, and the files this step wrote use no dash of the long kinds.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
/** A file's lines with the whole-line comments left out, so a comment that says what is gone is not read as the thing itself. */
const codeOf = (rel: string) => read(rel).split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n')

/** Every source file under the folders given, never node_modules or build output. */
function sources(dirs: string[]): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx|js|mjs|sql)$/.test(name)) out.push(full)
    }
  }
  for (const dir of dirs) walk(join(root, dir))
  return out
}

describe('the code that built the author words', () => {
  const code = sources(['functions', 'src', 'domain', 'workers', 'scripts'])

  it('is called by nothing: no file names clubAuthorLine, authorWords, nameForLine or AuthorKind', () => {
    const hits = code.filter((file) => /\b(clubAuthorLine|authorWords|nameForLine|AuthorKind)\b/.test(readFileSync(file, 'utf8')))
    expect(hits).toEqual([])
  })

  it('leaves its file with the told line alone', () => {
    const file = read('functions/utils/clubs/authorLine.ts')
    const exported = [...file.matchAll(/^export (?:async )?(?:function|const|type|interface) (\w+)/gm)].map((m) => m[1])
    expect(exported.sort()).toEqual(['clubToldLine', 'toldWords'])
  })

  it('leaves no author key in the answer\'s builder, its contract or the page\'s client', () => {
    for (const rel of ['functions/utils/clubs/pageAnswer.ts', 'domain/contracts/clubPage.ts', 'src/areas/clubs/clubPage.ts']) {
      expect(read(rel), rel).not.toMatch(/\bauthor\s*[:?]/)
    }
    // told_by is read for the told line's save rule alone and never answered.
    const builder = codeOf('functions/utils/clubs/pageAnswer.ts')
    expect(builder).not.toMatch(/confirmed_by|guardian/i)
    expect(builder).not.toMatch(/\.told_by\b/)
  })
})

describe('the words of the lines', () => {
  it('writes "Last checked" and none of the old told line\'s words in the code that writes or draws the page', () => {
    const files = ['functions/utils/clubs/authorLine.ts', 'functions/utils/clubs/pageAnswer.ts', 'functions/utils/clubs/pageHtml.ts', 'domain/contracts/clubPage.ts']
    for (const rel of files) expect(read(rel), rel).not.toMatch(/As told to|As told by|Kept by/)
    for (const file of sources(['src/areas/clubs'])) expect(readFileSync(file, 'utf8'), file).not.toMatch(/As told to|As told by/)
    expect(read('functions/utils/clubs/authorLine.ts')).toContain('Last checked ')
  })

  it('draws the keeper\'s own line from the session alone: the band component takes a keeper and nothing about the club\'s keeping', () => {
    const band = codeOf('src/areas/clubs/components/AuthorLine.tsx')
    expect(band).toMatch(/function AuthorLine\(\{ keeper \}: \{ keeper: Keeper \}\)/)
    expect(band).not.toMatch(/Kept by|author\b/)
    const words = read('src/areas/clubs/clubPage.ts')
    expect(words).toContain("This is your club\\'s page")
    expect(words).toContain('You can edit this page as the ${keeper.region} representative')
  })
})

describe('plain words in the files this step wrote', () => {
  const written = [
    'test/unit/club-page-k-notes.test.tsx',
    'test/unit/club-page-k-notes-source.test.ts',
    'test/integration/club-page-k-notes.test.ts',
    'test/integration/club-page-last-checked.test.ts',
    'test/unit/redesign-status-ws09-w-k-notes.test.ts',
    'functions/utils/clubs/authorLine.ts',
    'functions/utils/clubs/pageAnswer.ts',
    'domain/contracts/clubPage.ts',
    'src/areas/clubs/components/AuthorLine.tsx',
    'src/areas/clubs/components/ClubPage.tsx',
  ]
  const EM = String.fromCharCode(0x2014)
  const EN = String.fromCharCode(0x2013)

  it('hold no em dash and no en dash', () => {
    for (const rel of written) {
      const text = read(rel)
      expect(text.includes(EM), `${rel} has an em dash`).toBe(false)
      expect(text.includes(EN), `${rel} has an en dash`).toBe(false)
    }
  })

  it('write the association\'s name as US Chess and never the old name', () => {
    for (const rel of written) expect(read(rel), rel).not.toMatch(/\bUSCF\b/)
  })
})
