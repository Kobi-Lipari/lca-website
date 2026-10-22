// test/unit/helpers/workflow.ts
//
// Reads the parts of a GitHub Actions workflow file the tests look at, line
// by line, so no YAML library is needed: a block is the lines under a header
// line, indented deeper than it.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')

/** The text of a file in the repository, split into lines. */
export function fileLines(path: string): string[] {
  return readFileSync(join(ROOT, path), 'utf8').split('\n')
}

const indentOf = (line: string) => line.match(/^ */)![0].length

/** The lines of the block that starts at the first line from `from` that matches `header`. */
export function block(lines: string[], header: RegExp, from = 0): string[] {
  const start = lines.findIndex((l, i) => i >= from && header.test(l))
  if (start < 0) throw new Error(`No line matches ${header}`)
  const indent = indentOf(lines[start])
  const out: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() !== '' && indentOf(l) <= indent) break
    out.push(l)
  }
  return out
}

/** The `run: |` script of the step whose line matches `stepLine`, with its indentation removed. */
export function stepScript(lines: string[], stepLine: RegExp): string {
  const at = lines.findIndex((l) => stepLine.test(l))
  if (at < 0) throw new Error(`No step matches ${stepLine}`)
  const run = lines.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l))
  const indent = indentOf(lines[run])
  const body: string[] = []
  for (let i = run + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '' && indentOf(lines[i]) <= indent) break
    body.push(lines[i].slice(indent + 2))
  }
  return body.join('\n')
}
