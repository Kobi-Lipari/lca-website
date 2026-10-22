// test/unit/helpers/tailwindRules.ts
//
// Reading a stylesheet as a list of rules with their selectors and the
// at-rules around them, following the nesting Tailwind writes: an @supports
// block inside a rule belongs to that rule's selector, and "&" stands for
// the parent. semantic-map.test.ts reads Tailwind's output for the status
// map's classes with it, and src/index.css's block for browsers that cannot
// mix colours. (semantic-map-cascade.test.ts keeps its own copy for the step
// 23 map.)

export interface LeafRule {
  /** The at-rules around the declarations, outermost first. */
  within: string[]
  selector: string
  /** The declarations, "property: value" joined with "; ". */
  body: string
}

/** Every set of declarations in a stylesheet, with its selector and the at-rules around it. */
export function leafRules(css: string, within: string[] = [], selector = ''): LeafRule[] {
  const out: LeafRule[] = []
  const decls: string[] = []
  let start = 0
  let i = 0
  while (i < css.length) {
    if (css[i] === ';') {
      decls.push(css.slice(start, i).trim())
      start = ++i
      continue
    }
    if (css[i] !== '{') {
      i++
      continue
    }
    const prelude = css.slice(start, i).trim().replace(/\s+/g, ' ')
    let depth = 1
    let j = i + 1
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
      j++
    }
    const body = css.slice(i + 1, j - 1)
    if (prelude.startsWith('@')) {
      out.push(...leafRules(body, [...within, prelude], selector))
    } else {
      // An unescaped & stands for the parent selector; "\&" is part of a class name, as in [&_a]:.
      const parent = /(?<!\\)&/
      const inner = parent.test(prelude) ? prelude.replace(new RegExp(parent, 'g'), selector) : selector ? `${selector} ${prelude}` : prelude
      out.push(...leafRules(body, within, inner))
    }
    start = i = j
  }
  const own = [...decls, css.slice(start).trim()].filter(Boolean)
  if (own.length > 0 && selector) out.unshift({ within, selector, body: own.map((d) => d.replace(/\s+/g, ' ')).join('; ') })
  return out
}

/** A class name as a CSS selector writes it. */
export const escapeClass = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
