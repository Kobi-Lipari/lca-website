// functions/utils/json.ts

/**
 * Reads a JSON array out of a text column.
 *
 * Several tables keep arrays as JSON strings, and every reader had spelled the
 * same six lines out by hand: declare, try to parse, reset to empty in the
 * catch. Ten copies of that, with the initial value dead in every one.
 *
 * Also checks the result is actually an array, which the hand-written versions
 * did not — `JSON.parse('{"a":1}')` returned an object that the call site then
 * used as `unknown[]`, and anything downstream that mapped over it would have
 * thrown well away from the cause.
 */
export function parseJsonArray(value: unknown): unknown[] {
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
