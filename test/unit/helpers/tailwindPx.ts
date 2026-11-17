// test/unit/helpers/tailwindPx.ts
//
// What a Tailwind class sets, in pixels, read from Tailwind's own compile of
// the project's tokens and its default theme (the scale text-sm, min-h-11 and
// the others are written in), for the tests that hold a size and a height by
// the classes a page uses. A media variant such as max-sm: is read with the
// width it applies under, so a phone's rule is told from a computer's. A rem
// is 16px, the browser's own default.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from 'tailwindcss'
import { read, ROOT, stripComments } from './cssTokens'

/** The project's tokens and Tailwind's default theme, enough to build the size and spacing utilities. */
function source(): string {
  const css = stripComments(read('src/index.css'))
  const variant = css.match(/@custom-variant dark [^;]+;/)?.[0] ?? ''
  const blocks = [...css.matchAll(/^@theme(?: inline)? \{[\s\S]*?^\}/gm)].map((m) => m[0])
  return `@import "tailwindcss/theme.css" layer(theme);\n${variant}\n${blocks.join('\n')}\n@tailwind utilities;`
}

type Build = (classes: string[]) => string
let building: Promise<Build> | null = null

/** Tailwind's compile, made once. */
export function builder(): Promise<Build> {
  building ??= compile(source(), {
    base: ROOT,
    loadStylesheet: async (id) => {
      const path = join(ROOT, 'node_modules', id)
      return { content: readFileSync(path, 'utf8'), base: ROOT, path }
    },
  }).then((compiler) => (classes: string[]) => compiler.build(classes))
  return building
}

const PX = 16

/** A length as the compile writes it, its custom properties and its one multiplication worked out, in pixels. */
function lengthIn(css: string, value: string): number | null {
  let text = value.trim()
  for (let round = 0; round < 5 && /var\(/.test(text); round++) {
    text = text.replace(/var\((--[\w-]+)\)/g, (_, name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim() ?? 'unknown')
  }
  // A negative utility, such as -ml-2.5, multiplies by a negative number.
  const product = /^calc\(\s*([\d.]+)(rem|px)\s*\*\s*(-?[\d.]+)\s*\)$/.exec(text)
  if (product) return Number(product[1]) * Number(product[3]) * (product[2] === 'rem' ? PX : 1)
  const plain = /^([\d.]+)(rem|px)$/.exec(text)
  return plain ? Number(plain[1]) * (plain[2] === 'rem' ? PX : 1) : null
}

export interface Setting {
  /** The property's value in pixels. */
  px: number
  /** The width condition the rule applies under, such as "width < 40rem", or null for every width. */
  media: string | null
}

/** What one class, as the page writes it, sets for one property, or null when it sets none. */
export function setBy(css: string, className: string, property: string): Setting | null {
  // The class as a selector writes it, each character that is not a letter, a digit or a hyphen behind a backslash.
  const selector = className.replace(/[^\w-]/g, (c) => `\\${c}`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`(?:@media \\(([^)]+)\\) \\{\\s*)?\\.${selector}\\s*\\{([^}]*)\\}`).exec(css)
  if (!rule) return null
  const value = new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(rule[2])?.[1]
  const px = value === undefined ? null : lengthIn(css, value)
  return px === null ? null : { px, media: rule[1] ?? null }
}

/**
 * The space a space-y- class puts under each child but the last, in pixels, or null when the class sets none.
 * Tailwind writes it as a bottom margin on those children, with the reverse flag at its starting value, 0.
 */
export function spaceBelowChildren(css: string, className: string): number | null {
  const selector = className.replace(/[^\w-]/g, (c) => `\\${c}`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`:where\\(\\.${selector} > :not\\(:last-child\\)\\)\\s*\\{([^}]*)\\}`).exec(css)
  const value = rule && /margin-block-end:\s*([^;]+);/.exec(rule[1])?.[1]
  if (!value) return null
  return lengthIn(css, value.replace(/var\(--tw-space-y-reverse\)/g, '0').replace(/calc\(\s*1 - 0\s*\)/g, '1'))
}

/** The text size class an element wears, or the nearest one around it, which is the size its words are drawn at. */
export function sizeClassOf(el: Element | null): string | null {
  for (let at = el; at; at = at.parentElement) {
    const found = (at.getAttribute('class') ?? '').split(/\s+/).find((token) => /^text-(?:xs|sm|base|lg|xl|\d+xl|\[[\d.]+(?:px|rem)\])$/.test(token))
    if (found) return found
  }
  return null
}
