// @vitest-environment jsdom
//
// The message editor's one choice, tallOnPhone, which Group email's newsletter
// tab alone passes, with mailLists on, before the switch-on: each toolbar
// button is then at least 44px tall under 40rem, the width a phone has, read
// from the class it wears as Tailwind compiles it (test/unit/helpers/tailwindPx.ts).
// Every other use draws the editor with no choice, and its markup is then the
// editor's as it stood at d2c5ec0 (test/unit/fixtures/rich-text-editor-today.tsx),
// byte for byte; no file but Group email's page passes the choice.
//
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only, as the governance editor
// tests give them. The words typed here are made up.
import { act, cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { builder, setBy } from './helpers/tailwindPx'

const ROOT = resolve(__dirname, '../..')

const rects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
const saved = {
  rangeRects: Range.prototype.getClientRects,
  rangeBox: Range.prototype.getBoundingClientRect,
  elementFromPoint: document.elementFromPoint,
}
beforeAll(() => {
  Range.prototype.getClientRects = rects
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  document.elementFromPoint = () => null
})
afterAll(() => {
  Range.prototype.getClientRects = saved.rangeRects
  Range.prototype.getBoundingClientRect = saved.rangeBox
  document.elementFromPoint = saved.elementFromPoint
})
afterEach(() => cleanup())

const { RichTextEditor } = await import('@/areas/governance/components/RichTextEditor')
const { RichTextEditorToday } = await import('./fixtures/rich-text-editor-today')

const CONTENT = '<p>Example words for a sample note.</p>'
const noop = () => {}

/** An editor drawn, once its library has made it, as markup and its toolbar's buttons. */
async function drawn(editor: ReactElement): Promise<{ markup: string; tools: HTMLElement[] }> {
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(editor)
  })
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  const toolbar = view!.container.querySelector('.border-b')
  expect(toolbar).not.toBeNull()
  const tools = [...toolbar!.querySelectorAll('button')] as HTMLElement[]
  const markup = view!.container.innerHTML
  cleanup()
  return { markup, tools }
}

/** Every file under a folder, its path from the repository's root. */
function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(ROOT, dir, name)
    return statSync(path).isDirectory() ? filesUnder(relative(ROOT, path)) : [relative(ROOT, path)]
  })
}

describe('the message editor\'s choice for the newsletter tab on a phone (before the switch-on, F2)', () => {
  it('makes each of the six toolbar buttons at least 44px tall under 40rem when the choice is passed', async () => {
    const { tools } = await drawn(<RichTextEditor content={CONTENT} onChange={noop} tallOnPhone />)
    expect(tools).toHaveLength(6)
    const css = (await builder())(['max-sm:min-h-11', 'h-9'])
    expect(setBy(css, 'max-sm:min-h-11', 'min-height')).toEqual({ px: 44, media: 'width < 40rem' })
    // Today's height, which the class leaves in place at every other width.
    expect(setBy(css, 'h-9', 'height')).toEqual({ px: 36, media: null })
    for (const tool of tools) {
      const classes = tool.getAttribute('class')!.split(/\s+/)
      expect(classes).toContain('max-sm:min-h-11')
      expect(classes).toContain('h-9')
    }
  })

  it('draws the editor byte for byte as it stood at d2c5ec0 without the choice, and with it set to false', async () => {
    const today = await drawn(<RichTextEditorToday content={CONTENT} onChange={noop} />)
    expect(today.markup).toContain('Example words for a sample note.')
    expect((await drawn(<RichTextEditor content={CONTENT} onChange={noop} />)).markup).toBe(today.markup)
    expect((await drawn(<RichTextEditor content={CONTENT} onChange={noop} tallOnPhone={false} />)).markup).toBe(today.markup)
    expect(today.markup).not.toContain('max-sm:min-h-11')
  })

  it('is passed by Group email\'s page alone, so News posts and the governance documents keep today\'s editor', () => {
    const passing = filesUnder('src')
      .filter((path) => /\.tsx?$/.test(path))
      .filter((path) => /<RichTextEditor\b[^>]*\btallOnPhone\b/.test(readFileSync(join(ROOT, path), 'utf8')))
    expect(passing).toEqual(['src/pages/AdminEmailPage.tsx'])
  })
})
