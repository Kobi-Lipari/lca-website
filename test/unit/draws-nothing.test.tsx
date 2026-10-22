// test/unit/draws-nothing.test.tsx
//
// drawsNothing (src/lib/drawsNothing.ts), which StatusBadge asks before it
// shows a status tag's words and ScrollPanel before it draws its header bar
// (WS01 step 26). A node draws nothing when it is nothing at all, a
// boolean, blank text, or a list or a fragment holding only those, however
// deeply; anything else draws something, a number (0 included) and any
// element that is not a fragment among them, since what an element draws is
// known only when it renders.
import { Fragment, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { drawsNothing } from '@/lib/drawsNothing'

function Nothing(): ReactNode {
  return null
}

/** A caller's words that may come out empty: an opening date it may not have yet. */
const opens = (opensOn?: string) => <>{opensOn && `Opens ${opensOn}`}</>

describe('drawsNothing', () => {
  it.each<[string, ReactNode]>([
    ['null', null],
    ['undefined', undefined],
    ['false', false],
    ['true', true],
    ['an empty string', ''],
    ['spaces', '   '],
    ['a tab and a new line', '\t\n'],
    ['a no-break space', ' '],
    ['an empty list', []],
    ['a list of nothing', [null, false, '', undefined]],
    ['nested lists of blanks', [[''], [' ', null], []]],
    ['an empty fragment', <></>],
    ['a fragment of blank text', <>{'  '}</>],
    ['a fragment holding only nothing', <>{null}{false}{undefined}</>],
    ['a keyed fragment with nothing in it', <Fragment key="k" />],
    ['a fragment inside a fragment', <><></></>],
    ['a list of empty fragments', [<Fragment key="a" />, <Fragment key="b">{''}</Fragment>]],
    ['a fragment whose condition fails', opens()],
    ['a fragment whose condition is an empty string', opens('')],
  ])('%s draws nothing', (_, node) => {
    expect(drawsNothing(node)).toBe(true)
  })

  it.each<[string, ReactNode]>([
    ['words', 'Registration open'],
    ['words with spaces around them', '  Live  '],
    ['a number', 3],
    ['zero, which React draws', 0],
    ['an element', <span>Live</span>],
    ['an empty element, whose box is drawn', <span />],
    ['a component, known only when it renders', <Nothing />],
    ['a fragment with words', <>{'Opens Mon, Oct 12'}</>],
    ['a fragment whose condition holds', opens('Mon, Oct 12')],
    ['a fragment with an element', <><time dateTime="2026-10-12">Opens Mon, Oct 12</time></>],
    ['a list with words among nothing', [null, '', 'Waitlist']],
    ['a fragment inside a fragment, with words', <><>{'Live'}</></>],
  ])('%s draws something', (_, node) => {
    expect(drawsNothing(node)).toBe(false)
  })
})
