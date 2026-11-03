// test/unit/json-response-edges.test.ts
//
// jsonResponse's third argument (functions/utils/response.ts, WS02 step 9)
// at its edges, beside test/unit/json-response.test.ts: the headers a
// caller hands it are merged over its own, so a header it names is added,
// or wins over one of the same name. A header's name is the same name in
// any letter case, as HTTP reads it, so a caller's own header wins however
// it is written, and one value is sent, never two joined by a comma. A call
// that names a header of its own leaves the next call's headers as they
// were, and a caller's header of a name the helper does not send is added
// in any letter case.
import { describe, expect, it } from 'vitest'
import { jsonResponse } from '../../functions/utils/response'

describe('jsonResponse\'s third argument, at its edges', () => {
  it('adds a header of a name it does not send, in any letter case, once', () => {
    const res = jsonResponse({}, 200, { 'cache-control': 'public, max-age=60' })
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect([...res.headers.keys()].filter((name) => name === 'cache-control')).toHaveLength(1)
  })

  it('leaves the next call\'s headers as they were after a call that named its own', () => {
    jsonResponse({}, 200, { 'Access-Control-Allow-Origin': 'https://www.louisianachess.org', 'Cache-Control': 'no-store' })
    const next = jsonResponse({})
    expect(next.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(next.headers.get('Cache-Control')).toBeNull()
  })

  it('lets a caller\'s header win over its own of the same name written in another letter case, sending one value and not two', () => {
    const typed = jsonResponse({}, 200, { 'content-type': 'application/json; charset=utf-8' })
    expect(typed.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    const origin = jsonResponse({}, 200, { 'access-control-allow-origin': 'https://www.louisianachess.org' })
    expect(origin.headers.get('Access-Control-Allow-Origin')).toBe('https://www.louisianachess.org')
  })
})
