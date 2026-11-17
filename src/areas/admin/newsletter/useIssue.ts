// src/areas/admin/newsletter/useIssue.ts
//
// The newsletter page's letter: reading it, saving it by itself, and the
// version it is held to (WS16 part two, page step 4). One letter, which
// everyone who may send sees and edits, one writer at a time (K's decision
// 56, answer 3).
//
// - Reading: GET /api/admin/mail/newsletter/issue. With no letter yet the
//   page holds a blank letter for the month now, in Central time, with that
//   month's subject; nothing is written until the person changes something,
//   and the first save is the one with id null and version 0.
// - Saving: about two seconds after a pause in typing, and as the page is
//   left. One save is in flight at a time; words typed while it is on the
//   way go in the next, which carries the version the answer gave. Nothing
//   is saved when nothing changed. An answer never touches the words on the
//   page: when the server's cleaner changed what was sent, the page keeps
//   typing on its own words and says nothing.
// - Refusals, each in words and none tried again by itself: a 409 stops the
//   saving until the person shows the newer letter, so nothing is ever saved
//   over another person's later save, and the person's words stay on the
//   page; a 400 or a 413 is the server's own words, and the words it refused
//   are never sent again by the page itself, as it goes, as it comes back or
//   as it is left within the site, while a change to them sends them; anything
//   else is "Could not save", and the next change, or Try again, tries again.
//   A read of their letter that fails is counted, so the line says each
//   failure again in one change of its own.
// - The page's own saves it never heard back about: a save sent as the page
//   went, and a save that got no answer, may each be stored at a version the
//   page does not know. A 409 'changed' while there is one, and a page
//   brought back by Back or Forward, read the letter again: when it holds
//   words this page sent, it is the page's own save, so the page takes its
//   version and goes on saying nothing; any other newer letter is refused in
//   words as before.
// - Starting a new letter (page step 5, second part), from the chooser: the
//   words on the page are saved first, and the start waits for that save;
//   when it cannot be made, nothing is started. With nothing to save, the
//   letter is read first, since the start sends no version and the server
//   judges whatever letter is open then: when someone else has saved over
//   it, made it, replaced it or sent it since the page last heard, the words
//   on the page are sent as a save at the version the page knows, which the
//   server refuses, as it refuses every such save, with who did it and when,
//   and nothing is started. The read, and each wait for a save on its way,
//   end after 20 seconds with nothing started (SAVE_FIRST_WAIT_MS). Then one
//   request, POST /api/admin/mail/newsletter/issue/start, for the month the
//   page is on; the server sets the open letter aside, its words kept, when
//   it holds words, and reuses it in place when it holds none. One start at a
//   time, waited for until it answers. A start the server refuses with 409
//   stops the saving as a save's 409 does, and one that fails leaves
//   everything as it was. Whether a letter holds words is holdsWords below,
//   the server's own rule, which the chooser's question and the first step's
//   wiggle both ask. The server copies a past letter's body alone, so a
//   letter set aside with a subject of its own, started from for the same
//   month, has that subject put back on the page as the person's own words,
//   saved after the pause as an edit is.
// - "Send a test to me" (page step 6): the words on the page are saved
//   first by the same path the chooser's start uses (saveFirst), and when
//   that save cannot be made nothing is sent; then one request asks the
//   server for a test of the stored letter by the id and version the page
//   then holds, to the signed-in account's own address. A test the server
//   refuses with 409 stops the saving as a save's 409 does, the saved line
//   saying who did what and when, unless the page's own save was on its way
//   or landed as the test went; nothing is ever tried again by itself.
// - Leaving with words not saved: a press on a link to another of the site's
//   pages asks first, and the person who stays keeps the page and their
//   words; one who goes has the save sent at once, or once the save on the
//   way has answered, and after a refusal nothing is saved. Leaving the site,
//   closing the tab or reloading, the save is sent as the page goes, as a
//   request that outlives the page, and the browser asks its own question
//   first, since nobody can know that save worked. Nothing is left to go off
//   later. The browser's Back within the site asks nothing, since the site's
//   router can hold no move back: it saves the same way, and after a refusal
//   keeps nothing.
//
// The keeper below holds all of it between draws, apart from React's state,
// so a save never waits on a draw; the hook hands React what it reports.

import { useEffect, useState } from 'react'
import { zonedParts } from '@domain/format/date'
import { STARTERS, STARTER_IDS, defaultSubject, monthLabel, type StarterId } from '@domain/mail/letter'
import {
  getNewsletterIssue,
  saveNewsletterIssue,
  sendNewsletterIssueTest,
  startNewsletterIssue,
  type ApiNewsletterIssue,
  type ApiNewsletterIssueRefused,
} from '@/lib/api'
import { ApiError, authHeaders } from '@/lib/http'

/** The words of a letter the page holds: its month, subject, inbox preview line and body. */
export interface LetterDraft {
  monthLabel: string
  subject: string
  preheader: string
  bodyHtml: string
}

/**
 * What the saved line says. Every time is the database's stored text, in UTC. A refusal for a newer letter counts the
 * reads of their letter that have failed since it came, 0 for none, so each failure is said again.
 */
export type SaveLine =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'failed' }
  | { kind: 'refused'; words: string }
  | { kind: 'conflict'; reason: 'changed' | 'sent' | 'set_aside'; by: string | null; at: string; readFailures: number }
  | { kind: 'started'; from: string }

/** Where a new letter's words come from: a blank letter or one of LCA's starters by its id, a past letter, or a past send. */
export type StartFrom = StarterId | { issueId: string } | { campaignId: string }

/**
 * A subject of its own that a new letter takes back: a letter set aside's, as "Your last newsletters" lists it, with the
 * month that letter was for. The server's start gives every new letter its month's subject and copies a past letter's
 * body alone, so this is put back on the page when the new letter is for that same month.
 */
export interface SubjectBack {
  monthLabel: string
  subject: string
}

/**
 * The save made before a new letter is started: 'saved' once the server holds every word on the page at the version
 * the page knows, else why not: it failed, the server refused it in its own words, a 409 met it now ('conflict'), or
 * one had stopped the saving before, the words on the page not saved ('stopped') or, nothing typed since, the words
 * the page knows the server held ('changed-before'); or, after SAVE_FIRST_WAIT_MS, a save of the words on the page was
 * still on its way, or words typed since still waited behind the save sent only to learn who changed the letter or the
 * read made after its 409 ('waiting'). With nothing to save: the letter read was someone else's newer letter, so the
 * words on the page were sent as a save and the server refused it with 409 ('changed'); or the read failed or had not
 * answered in time, or that save came back with neither a save nor a 409 at the press that sent it, or it, or check's
 * read after its 409, had not answered in time, at that press or at a later one with nothing typed since, or the letter
 * left the page before it was sent ('unchecked'). A later press
 * that sees that save fail reads the letter again, as any press does. The saved line says a save's failures and
 * refusals as a save's own line does, but for that save sent only to learn who changed the letter, whose failure or
 * refusal in the server's words it does not say, since the person had nothing unsaved.
 */
export type SavedFirst = 'saved' | 'failed' | 'refused' | 'conflict' | 'stopped' | 'changed-before' | 'waiting' | 'changed' | 'unchecked'

/**
 * What a start came to: the new letter on the page; refused with 409, the saved line then saying who did what and
 * when, as a save's 409 does; the past letter or send not found; failed, with the server's own words for a 400 or a
 * 413, else '' for a start that got no answer or any other; or, asked for while another is on its way, nothing at all
 * ('busy'), the start on its way saying what it came to.
 */
export type StartOutcome = { kind: 'started' } | { kind: 'refused' } | { kind: 'not-found' } | { kind: 'failed'; words: string } | { kind: 'busy' }

/**
 * What "Send a test to me" came to (page step 6): sent, with the address the server sent it to; nothing sent, since the
 * words on the page could not be saved first (`first`, saveFirst's answer), or the server holds no letter yet; refused
 * with 409, someone else having changed, replaced or sent the letter since the version the page holds, the saved line
 * then saying who and when ('conflict'); refused with 409 while the page's own save was on its way or had landed as the
 * test went ('moved'); refused in the server's own words, '' for an answer that brings none or for none at all; or,
 * the letter having left the page meanwhile, nothing to say ('gone').
 */
export type TestOutcome =
  | { kind: 'sent'; to: string }
  | { kind: 'not-saved'; first: Exclude<SavedFirst, 'saved'> }
  | { kind: 'empty' }
  | { kind: 'conflict' }
  | { kind: 'moved' }
  | { kind: 'refused'; words: string }
  | { kind: 'gone' }

export interface Issue {
  /** 'loading' until the first read answers, 'failed' when it could not be read, 'ready' after. */
  status: 'loading' | 'failed' | 'ready'
  /** The server's words for a read it refused, or '' for a read that got no answer. */
  loadError: string
  /** The words the page is to show, and a key that moves each time they replace what is on the page. */
  letter: LetterDraft
  letterKey: number
  /** 'draft' for an open letter, 'none' until a letter the server has no row for yet is first saved. */
  state: 'none' | 'draft'
  line: SaveLine
  /** The words on the page now; a save follows a pause. */
  edit: (draft: LetterDraft) => void
  /** Try again: saves at once. */
  saveNow: () => void
  /** Reads the letter that took the place of the person's, and puts it on the page in place of their words. */
  showTheirs: () => Promise<void>
  /** Reads the letter again after a read that failed. */
  reload: () => void
  /**
   * Saves the words on the page now, the pause cut short, and waits for the server's answer (SavedFirst); with nothing
   * to save, reads the letter to learn that the server still holds it at the version the page knows. `onSaving` is
   * called as a save of words the server may not hold is sent or waited for, so the page can say which of the two it
   * is doing; `onPage` says whether the letter is still on the page: once it is not, the save sent to learn who
   * changed the letter is not sent, while a save of the words on the page over one of the page's own saves the read
   * finds still goes, as the page's leave save would.
   */
  saveFirst: (onSaving?: () => void, onPage?: () => boolean) => Promise<SavedFirst>
  /**
   * Starts a new letter for `month` from a choice, once saveFirst has saved the words on the page; `startedFrom` names
   * the choice for the saved line, and `subjectBack` is a letter set aside's own subject, which the new letter takes
   * back when it is for that letter's month. One at a time: another asked for while one is on its way starts nothing
   * and answers 'busy'.
   */
  start: (from: StartFrom, month: string, startedFrom: string, subjectBack?: SubjectBack) => Promise<StartOutcome>
  /**
   * "Send a test to me": saves the words on the page first (saveFirst), then asks for one test of the stored letter at
   * the version the page then holds; `onPage` says whether the letter is still on the page, as for saveFirst.
   */
  sendTest: (onPage?: () => boolean) => Promise<TestOutcome>
  /** The name of the choice the letter on the page was started from, until the page has drawn it and said so; else null. */
  startedFrom: string | null
  /** Once the letter a start put on the page is drawn: the saved line says which choice it was started from, once. */
  sayStarted: () => void
}

/** The pause after the last change before a save, about two seconds. */
export const SAVE_PAUSE_MS = 2000

/** A save sent as the page goes must be small enough for a request that outlives the page; a longer one is left to the leave question. */
const KEEPALIVE_MAX_BYTES = 60000

/** How long the sign-in headers kept for a save as the page goes are trusted before they are read again. */
const HEADERS_FRESH_MS = 60000

/**
 * The longest saveFirst waits for the letter it reads, and each time for a save on its way, before it answers without
 * them, so a request that never answers does not hold the person in the chooser: 20 seconds. Each wait has its own, so
 * one call can wait about 40 seconds when the read and a save are both slow, and the read made again once "Replace it"
 * is pressed waits again. The request goes on; its answer, whenever it comes, does what it always does and nothing
 * more. A start is not held to it (start).
 */
export const SAVE_FIRST_WAIT_MS = 20000

/** What a promise gives, or 'late' once SAVE_FIRST_WAIT_MS has passed first; its one timer is cleared once either has come. */
function inTime<T>(promise: Promise<T>): Promise<T | 'late'> {
  let timer: number | undefined
  const late = new Promise<'late'>((resolve) => {
    timer = window.setTimeout(() => resolve('late'), SAVE_FIRST_WAIT_MS)
  })
  return Promise.race([promise, late]).finally(() => window.clearTimeout(timer))
}

const EMPTY: LetterDraft = { monthLabel: '', subject: '', preheader: '', bodyHtml: '' }

/** A body with nothing in it, as the editor writes an empty letter. */
const bodyOf = (html: string) => (html === '<p></p>' ? '' : html)

/** A month's label as its subject reads it (defaultSubject): its runs of spaces made one, and trimmed. */
const monthOf = (label: string) => label.replace(/\s+/g, ' ').trim()

/** Whether two letters say the same once trimmed as the server trims them. */
function same(a: LetterDraft, b: LetterDraft): boolean {
  return (
    a.monthLabel.trim() === b.monthLabel.trim() &&
    a.subject.trim() === b.subject.trim() &&
    a.preheader.trim() === b.preheader.trim() &&
    bodyOf(a.bodyHtml) === bodyOf(b.bodyHtml)
  )
}

/** The three plain fields trimmed, as the server stores them. */
function trimmed(draft: LetterDraft): LetterDraft {
  return { monthLabel: draft.monthLabel.trim(), subject: draft.subject.trim(), preheader: draft.preheader.trim(), bodyHtml: draft.bodyHtml }
}

/** A starter's letter as a start writes it, each heading an h2 over an empty paragraph: the server's starterLetter. */
function starterLetter(id: StarterId): string {
  const text = (words: string) => words.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return STARTERS[id].headings.map((heading) => `<h2>${text(heading)}</h2><p></p>`).join('')
}

/**
 * Whether a body is one of LCA's starters untouched, once line breaks, runs of spaces between two tags and then empty
 * paragraphs are dropped, a "<" that is a word read as a word first: the server's untouchedStarter, line for line.
 */
function untouchedStarter(body: string): boolean {
  if (/<(?![a-z/])/.test(body)) return false
  const asStarted = (html: string) =>
    html
      .replace(/<br>/g, '')
      .replace(/(<\/?[a-z][a-z0-9]*(?: [^<>]*)?>)[ \t\n\f\r]+(?=<\/?[a-z])/g, '$1')
      .replace(/<p><\/p>/g, '')
  const form = asStarted(body)
  return STARTER_IDS.some((id) => form === asStarted(starterLetter(id)))
}

/**
 * Whether a letter holds words a person wrote: the one rule the chooser's question before a letter is replaced and the
 * first step's wiggle both ask, so the two never differ. It is the server's own (holdsWords in
 * functions/utils/mail/issues.ts, which decides whether a start sets the open letter aside or reuses it in place),
 * asked of the fields as a save sends them, trimmed: words in the body, its headings among them, unless it is one of
 * LCA's starters untouched; an inbox preview line; or a subject other than its month's own. The month alone is never
 * words. The body is the editor's, which holds only what the cleaner keeps, so once a save has answered, the page and
 * the server read the same words. test/unit/admin-newsletter-chooser.test.tsx holds the two equal.
 */
export function holdsWords(draft: LetterDraft): boolean {
  const letter = trimmed(draft)
  const words = letter.bodyHtml
    .replace(/<\/?(?:p|br|strong|em|h2|h3|ul|ol|li|hr|a)(?: [^<>]*)?>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .trim()
  if (words !== '' && !untouchedStarter(letter.bodyHtml)) return true
  if (letter.preheader !== '') return true
  return letter.subject !== '' && letter.subject !== defaultSubject(letter.monthLabel)
}

/** A stored letter's words, as the page holds them. */
function wordsOf(issue: NonNullable<ApiNewsletterIssue['issue']>): LetterDraft {
  return { monthLabel: issue.monthLabel, subject: issue.subject, preheader: issue.preheader, bodyHtml: issue.bodyHtml }
}

/** A blank letter for the month now, as the site writes a month, in Central time. */
function blankLetter(now: number): LetterDraft {
  const parts = zonedParts(now)
  const month = parts ? monthLabel(parts.year, parts.month) : ''
  return { monthLabel: month, subject: defaultSubject(month), preheader: '', bodyHtml: '' }
}

/** What the keeper tells the page. */
interface Report {
  letter: (draft: LetterDraft) => void
  state: (state: Issue['state']) => void
  line: (line: SaveLine | ((now: SaveLine) => SaveLine)) => void
  status: (status: Issue['status'], error: string) => void
  started: (from: string | null) => void
}

/** The letter between draws: what is on the page, what the server holds, and the one save at a time. */
function createKeeper(report: Report) {
  /** The letter by its id and version: id null and version 0 for one the server has no row for yet. */
  let id: string | null = null
  let version = 0
  /** The words on the page now, and the words the server holds as far as the page knows, with when they were saved. */
  let current = EMPTY
  let stored = EMPTY
  let savedAt: string | null = null
  let ready = false
  let inFlight = false
  /** A save was asked for while one was on the way: it goes as soon as that one answers. */
  let wanted = false
  /** A 409 stopped the saving: nothing more is saved over the newer letter until the person shows it. */
  let stopped = false
  /** The pause's timer, while one runs. */
  let pause: number | undefined
  /** The sign-in headers, read ahead, so a save can be sent at once as the page goes. */
  let headers: { value: HeadersInit; at: number } | null = null
  /**
   * The words of this page's saves it never heard back about, since the last version it knows: a save sent as the page
   * went, and a save that got no answer. The server may hold any of them.
   */
  let unanswered: LetterDraft[] = []
  /**
   * The words of the last save the server refused in its own words, a 400 or a 413, with those words of the server's,
   * until a save is answered or a letter is put on the page: the server would refuse them again, so the page never sends
   * them again of itself.
   */
  let refused: { draft: LetterDraft; words: string } | null = null
  /** Moves each time a letter the server answered is put on the page, so a read made for the one before is set aside. */
  let era = 0
  /** The last save's own outcome, read by saveFirst once that save has answered. */
  let lastOutcome: 'saved' | 'failed' | 'refused' | 'conflict' | null = null
  /**
   * Moves each time the server says it holds what the page knows as stored, at the version the page knows: a save it
   * answered, a read that showed one of the page's own saves, a letter it gave the page. saveFirst reads nothing more
   * when this has moved during its call.
   */
  let held = 0
  /** saveFirst waiting for the save on its way to answer. */
  let landings: Array<() => void> = []
  /** A start is on its way: no second one is sent. */
  let starting = false
  /**
   * The save on its way is the one saveFirst sent only to learn who changed the letter, or, after its 409, the read check
   * makes to learn whether the newer letter is one of the page's own saves: cleared wherever inFlight is.
   */
  let forcing = false
  /** The name of the choice the letter on the page was started from, until the page has said it on the saved line. */
  let startedWords: string | null = null

  /** A save, or the read that checks one, has answered: whoever waits for it looks again. */
  function landed() {
    const waiting = landings
    landings = []
    for (const go of waiting) go()
  }
  const nextLanding = () =>
    new Promise<void>((resolve) => {
      landings.push(resolve)
    })

  const lastSave = (): SaveLine => (savedAt ? { kind: 'saved', at: savedAt } : { kind: 'idle' })
  /**
   * A line that says a save failed, or that one is on its way, goes back to the last save once there is nothing left to
   * save; it is called only while no save is on its way.
   */
  const settled = (now: SaveLine): SaveLine => (now.kind === 'failed' || now.kind === 'refused' || now.kind === 'saving' ? lastSave() : now)

  function stopPause() {
    window.clearTimeout(pause)
    pause = undefined
  }

  function keepHeaders() {
    if (headers && Date.now() - headers.at < HEADERS_FRESH_MS) return
    authHeaders().then(
      (value) => {
        headers = { value, at: Date.now() }
      },
      () => {
        // Without them no save is sent as the page goes; the leave question still asks.
      },
    )
  }

  /**
   * Puts a letter the server answered on the page, in place of what was there. A letter a start made comes with the
   * name of its choice, which the saved line says once the page has drawn it (sayStarted), its line empty till then,
   * and may come with a subject it takes back (start): that subject is put on the page in place of the month's own as
   * the person's words, drawn with the letter so no field's words are set after it is drawn, and saved after the pause,
   * as an edit is, so the saved line says the start first.
   */
  function accept(answer: ApiNewsletterIssue, started: string | null = null, subjectBack: string | null = null) {
    const issue = answer.issue
    const draft: LetterDraft = issue ? wordsOf(issue) : blankLetter(Date.now())
    stopPause()
    id = issue ? issue.id : null
    version = issue ? issue.version : 0
    current = subjectBack === null ? draft : { ...draft, subject: subjectBack }
    stored = draft
    savedAt = issue ? answer.lastSavedAt : null
    ready = true
    wanted = false
    stopped = false
    unanswered = []
    refused = null
    startedWords = started
    era += 1
    held += 1
    report.letter(current)
    report.state(issue ? 'draft' : 'none')
    report.line(started === null ? lastSave() : { kind: 'idle' })
    report.started(started)
    report.status('ready', '')
    if (subjectBack !== null) {
      keepHeaders()
      pause = window.setTimeout(startSave, SAVE_PAUSE_MS)
    }
  }

  function failRead(error: unknown) {
    report.status('failed', error instanceof ApiError ? error.message : '')
  }

  /** The first read; the answer of a read the page no longer waits for is set aside. */
  function read(): () => void {
    let gone = false
    getNewsletterIssue().then(
      (answer) => {
        if (!gone) accept(answer)
      },
      (error: unknown) => {
        if (!gone) failRead(error)
      },
    )
    keepHeaders()
    return () => {
      gone = true
    }
  }

  /** Whether these are the words of the last save the server refused in its own words. */
  const refusedAgain = (draft: LetterDraft) => refused !== null && same(draft, refused.draft)

  /**
   * Sends the words on the page now, unless a save is on the way (then it goes once that one answers), nothing changed,
   * a 409 stopped the saving, or they are the words the server last refused in its own words, which it would refuse
   * again: the line then says that refusal. It takes nothing, since Try again hands it the press.
   */
  function startSave() {
    save(false)
  }

  /**
   * startSave's work. With `force` the words are sent though they are what the page knows the server held: saveFirst
   * asks for that once a read has shown that the server's letter is no longer the page's, so the save goes at the
   * version the page knows and the server refuses it, as it refuses every save at an older version, with who changed,
   * sent or replaced the letter and when. The person had nothing unsaved, so that save puts on the saved line only its
   * 409, or the save it made where it made the page's letter, as a first save can: never "Saving", and neither its
   * failure nor a refusal in the server's words, which saveFirst answers for. One that got no answer still joins the
   * saves the page never heard back about, since a first save may have been stored. While it is on its way, and while
   * check reads the letter after its 409 (`forcing`), the person can type, once the chooser has let them go: a save
   * asked for then waits behind it, as any save asked for while one is on its way does, and puts the saved line on
   * "Saving", since words are now held for a save; when that save fails, the save waiting behind it is sent at once, so
   * the words meet the server's refusal, which says who changed the letter, as the person's next save would have, or,
   * when they were written back as they were saved, nothing is sent and the line goes back to the last save
   * (settled); and while it has no answer the line stays on "Saving", as for any save with no answer.
   */
  function save(force: boolean) {
    stopPause()
    if (!ready || stopped) return
    if (inFlight) {
      wanted = true
      if (forcing && !force) report.line({ kind: 'saving' })
      return
    }
    wanted = false
    const sent = trimmed(current)
    if (!force && same(sent, stored)) {
      report.line(settled)
      return
    }
    /** The saved line's words for this save, which a save sent only to learn who changed the letter keeps to itself. */
    const say = (line: SaveLine) => {
      if (!force) report.line(line)
    }
    if (refused && same(sent, refused.draft)) {
      say({ kind: 'refused', words: refused.words })
      return
    }
    inFlight = true
    forcing = force
    say({ kind: 'saving' })
    saveNewsletterIssue({ id, version, ...sent }).then(
      (answer) => {
        if ('refused' in answer) {
          // A letter written since the version the page knows may be one of the page's own saves it never heard back about.
          if (answer.refused.reason === 'changed' && unanswered.length > 0) {
            check(answer.refused)
            return
          }
          inFlight = false
          forcing = false
          refuse(answer.refused)
          landed()
          return
        }
        inFlight = false
        forcing = false
        // What was sent is what the page holds; the cleaner's own form, when it differs, is the server's to keep. A save
        // at the version the page knew means none of its unanswered saves was stored after it, so none is left to wonder about.
        id = answer.saved.id
        version = answer.saved.version
        stored = sent
        savedAt = answer.saved.savedAt
        unanswered = []
        refused = null
        lastOutcome = 'saved'
        held += 1
        report.state('draft')
        report.line({ kind: 'saved', at: answer.saved.savedAt })
        // Words typed while it was on the way: at once if a save was asked for meanwhile, else after their own pause.
        if (wanted) startSave()
        landed()
      },
      (error: unknown) => {
        inFlight = false
        forcing = false
        const after = force && wanted
        wanted = false
        const words = error instanceof ApiError && (error.status === 400 || error.status === 413) ? error.message : ''
        // A 400 or a 413 wrote nothing, and its words are kept from being sent again by the page itself; any other
        // failure may have been stored with no answer reaching the page.
        if (words) refused = { draft: sent, words }
        else unanswered.push(sent)
        lastOutcome = words ? 'refused' : 'failed'
        say(words ? { kind: 'refused', words } : { kind: 'failed' })
        // Words typed while the save sent to learn who changed the letter was on its way go now, to meet the refusal.
        if (after) startSave()
        landed()
      },
    )
  }

  /**
   * Whether the letter a read answered holds the words of one of this page's own saves it never heard back about: if so
   * it is that save, and the page takes its id, version and time as stored and says its last save, nothing more.
   */
  function adoptOwn(answer: ApiNewsletterIssue): boolean {
    const issue = answer.issue
    const theirs = issue && (id === null || issue.id === id) ? wordsOf(issue) : null
    if (!issue || !theirs || !unanswered.some((words) => same(words, theirs))) return false
    id = issue.id
    version = issue.version
    stored = trimmed(theirs)
    savedAt = answer.lastSavedAt
    unanswered = []
    lastOutcome = 'saved'
    held += 1
    report.state('draft')
    report.line(lastSave())
    return true
  }

  /** A newer letter, in words: nothing more is saved over it until the person shows it. */
  function refuse(refusal: ApiNewsletterIssueRefused) {
    stopped = true
    wanted = false
    lastOutcome = 'conflict'
    report.line({ kind: 'conflict', reason: refusal.reason, by: refusal.changedBy, at: refusal.changedAt, readFailures: 0 })
  }

  /**
   * Reads the letter again, as one save on the way, to learn whether a newer letter is one of this page's own saves it
   * never heard back about. If its words are words this page sent, it is: the page takes its id, version and time as
   * stored and goes on saving its own words, saying nothing. Otherwise `refusal`, when a save was refused, is shown,
   * naming the writer and time of the letter read when it is the page's own letter, since someone may have saved it
   * after the refusal; with none, as a page brought back by Back or Forward has, the next save meets the newer letter
   * and is refused in words. Made after the 409 of the save sent only to learn who changed the letter, the read is that
   * save's (`forcing`) until it answers.
   */
  function check(refusal: ApiNewsletterIssueRefused | null) {
    inFlight = true
    const at = era
    const goOn = () => {
      if (wanted || !same(trimmed(current), stored)) startSave()
      else report.line(settled)
    }
    getNewsletterIssue().then(
      (answer) => {
        inFlight = false
        forcing = false
        if (at !== era || stopped) return landed()
        if (adoptOwn(answer)) {
          goOn()
          return landed()
        }
        const issue = answer.issue
        if (refusal) refuse(issue && issue.id === id ? { ...refusal, changedBy: answer.lastSavedBy, changedAt: answer.lastSavedAt ?? refusal.changedAt } : refusal)
        else goOn()
        landed()
      },
      () => {
        inFlight = false
        forcing = false
        if (at !== era || stopped) return landed()
        if (refusal) refuse(refusal)
        else goOn()
        landed()
      },
    )
  }

  function edit(draft: LetterDraft) {
    current = draft
    if (!ready || stopped) return
    keepHeaders()
    stopPause()
    if (same(trimmed(draft), stored) && !inFlight) {
      report.line(settled)
      return
    }
    pause = window.setTimeout(startSave, SAVE_PAUSE_MS)
  }

  /**
   * Their letter, read and put in place of the person's words. A read that fails is counted on the line, which leaves
   * the line as it is while the read is on its way, so a failure that repeats is said again in one change of the line.
   */
  async function showTheirs() {
    try {
      accept(await getNewsletterIssue())
    } catch {
      report.line((now) => (now.kind === 'conflict' ? { ...now, readFailures: now.readFailures + 1 } : now))
    }
  }

  function reload() {
    report.status('loading', '')
    getNewsletterIssue().then(accept, failRead)
  }

  /**
   * The save made before a new letter is started: the pause cut short and the words on the page sent at once, or once
   * the save on its way has answered, and its answer waited for, at most SAVE_FIRST_WAIT_MS each time: a save of the
   * words on the page that has not answered by then is 'waiting', and goes on by itself. 'saved' once the server holds
   * every word on the page at the version the page knows. The page cannot be typed on while the chooser is open, so no
   * word comes in meanwhile; a save that answers without saving them is the answer: it failed, was refused in the
   * server's words (the words it refused before are not sent again, as ever), or met a 409, which stops the saving
   * ('conflict'). With the saving stopped already, nothing is sent and nothing is started: 'stopped' when words on the
   * page are not on the server, and 'changed-before' when they are the words the page knows the server held, nothing
   * typed since, so only the letter on the server has changed.
   *
   * With nothing to save and no word from the server during the call, the letter is read, since the start sends no
   * version and the server judges whatever letter is open then: someone else may have saved over it, made it, started
   * a new one or sent it since the page last heard. Read at the version the page knows, it is the page's. Read as one of
   * the page's own saves it never heard back about, it is taken, as check takes it, and the words on the page are saved
   * over it where they differ, whether or not the letter is still on the page, as the page's leave save would.
   * Read as anything else, and while the letter is still on the page (`onPage`), the words on the page are sent once as
   * a save at the version the page knows, which the server refuses with 409, as it refuses every save at an older
   * version, writing nothing and saying who changed, sent or replaced the letter and when: the saving stops, and the
   * answer is 'changed'. 'unchecked' when the read fails or has not answered within SAVE_FIRST_WAIT_MS, a late answer
   * then set aside unread; when that save, sent by this call, comes back with neither a save nor a 409; when that save,
   * or check's read after its 409, has not answered within the wait, whether this call sent it or found it still on its
   * way (`forcing`) with nothing typed since, as a later press does once an earlier one was let go; and when the letter
   * has left the page before that save, which is then not sent. A later press that sees that save fail goes on as any
   * press does, reading the letter again; one that sees its 409 stop the saving answers as a press after an earlier
   * refusal does ('changed-before', or 'stopped' with words typed since). Words typed since, waiting behind that save,
   * are a save of the person's words: the press waits for them, as for any, and answers 'waiting' once the wait is over.
   * `onSaving` is called as a save of words the server may not hold is sent or waited for, never for that save alone,
   * at any press, whose failure the saved line does not say either (save).
   */
  async function saveFirst(onSaving?: () => void, onPage: () => boolean = () => true): Promise<SavedFirst> {
    const heard = held
    let sent = false
    let asked = false
    for (;;) {
      if (!ready) return 'failed'
      if (stopped) return asked ? 'changed' : sent ? 'conflict' : same(trimmed(current), stored) ? 'changed-before' : 'stopped'
      if (inFlight) {
        // Only that save, with no words typed since waiting behind it, is no save of the person's.
        const learning = forcing && same(trimmed(current), stored)
        if (!asked && !learning) onSaving?.()
        if ((await inTime(nextLanding())) === 'late') return asked || learning ? 'unchecked' : 'waiting'
        continue
      }
      stopPause()
      const now = trimmed(current)
      if (same(now, stored)) {
        if (held !== heard) return 'saved'
        // The save sent to learn why the letter read is not the page's came back with neither a save nor a 409.
        if (asked) return 'unchecked'
        const at = era
        let answer: ApiNewsletterIssue | 'late'
        try {
          answer = await inTime(getNewsletterIssue())
        } catch {
          return 'unchecked'
        }
        if (answer === 'late') return 'unchecked'
        if (at !== era || stopped || inFlight) continue
        const issue = answer.issue
        if (issue === null ? id === null : issue.id === id && issue.version === version) return 'saved'
        if (adoptOwn(answer)) continue
        if (!onPage()) return 'unchecked'
        asked = true
        save(true)
        continue
      }
      if (sent) return lastOutcome === 'refused' ? 'refused' : 'failed'
      if (refused && same(now, refused.draft)) {
        report.line({ kind: 'refused', words: refused.words })
        return 'refused'
      }
      sent = true
      lastOutcome = null
      onSaving?.()
      startSave()
    }
  }

  /**
   * A new letter for `month`, from a blank letter, a starter, a past letter or a past send, by one request, once
   * saveFirst has saved the words on the page. The server reads the open letter itself: it sets it aside, its words
   * kept, when it holds words, or reuses it in place when it holds none, and answers with the new open letter, which
   * goes on the page, the saved line saying which choice it came from once the page has drawn it. The server gives the
   * new letter its month's subject and a past letter's body alone, so a letter set aside started from for its own
   * month, as the new letter's month reads in the answer, takes back its own subject (`subjectBack`), put on the page
   * and saved after the pause; for any other month the month's subject stands. A 409 wrote nothing: the open letter
   * was changed, sent or set aside by someone else as this one was started, so the saving stops, as after a save's
   * 409, the line saying who did it and when. Any other answer, or none, leaves everything as it was, with the
   * server's own words only for a 400 or a 413, as a save keeps only those, so a sign-in it refuses (401, 403) says
   * the chooser's own. A start asked for while one is on its way sends nothing and answers 'busy'. A start is waited
   * for until it answers, with no time limit: one given up on could still land on the server, which only a start that
   * carries the version the page read can tell from the letter it replaced (page step 6).
   */
  async function start(from: StartFrom, month: string, startedFrom: string, subjectBack?: SubjectBack): Promise<StartOutcome> {
    if (starting) return { kind: 'busy' }
    if (!ready || stopped) return { kind: 'failed', words: '' }
    starting = true
    stopPause()
    const at = era
    try {
      const answer = await startNewsletterIssue({ from, monthLabel: month.trim() })
      if (at !== era) return { kind: 'failed', words: '' }
      if ('refused' in answer) {
        refuse(answer.refused)
        return { kind: 'refused' }
      }
      const made = answer.started.issue
      const back =
        subjectBack && made && monthOf(made.monthLabel) === monthOf(subjectBack.monthLabel) && made.subject !== subjectBack.subject ? subjectBack.subject : null
      accept(answer.started, startedFrom, back)
      return { kind: 'started' }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return { kind: 'not-found' }
      const words = error instanceof ApiError && [400, 413].includes(error.status) ? error.message : ''
      return { kind: 'failed', words }
    } finally {
      starting = false
    }
  }

  /**
   * "Send a test to me": the words on the page saved first by saveFirst, the chooser's own path, so the test is of the
   * words on the page; when they cannot be saved, nothing is sent, and the answer says why. Then one request for a test
   * of the stored letter by the id and version the page holds then, which the server sends to the signed-in account's
   * own address; nothing is sent for a letter the server holds no row for yet. A 409 means the letter on the server is
   * not the one the page holds at that version: when the page's own save is on its way, or landed as the test went, it
   * is the page's own doing ('moved') and nothing more is done; else someone else changed, replaced or sent it, and the
   * saving stops, as after a save's 409, the saved line saying who did it and when. Any other refusal, or none, changes
   * nothing. An answer for a letter that has left the page meanwhile is set aside ('gone').
   */
  async function sendTest(onPage: () => boolean = () => true): Promise<TestOutcome> {
    const first = await saveFirst(undefined, onPage)
    if (!onPage()) return { kind: 'gone' }
    if (first !== 'saved') return { kind: 'not-saved', first }
    if (id === null) return { kind: 'empty' }
    const named = { issueId: id, version }
    const at = era
    try {
      const answer = await sendNewsletterIssueTest(named)
      if (at !== era) return { kind: 'gone' }
      if ('refused' in answer) {
        if (inFlight || id !== named.issueId || version !== named.version) return { kind: 'moved' }
        if (!stopped) refuse(answer.refused)
        return { kind: 'conflict' }
      }
      return { kind: 'sent', to: answer.sent.to }
    } catch (error) {
      if (at !== era) return { kind: 'gone' }
      return { kind: 'refused', words: error instanceof ApiError ? error.message : '' }
    }
  }

  /** Says once on the saved line which choice the letter on the page was started from, unless the line has moved on. */
  function sayStarted() {
    if (startedWords === null) return
    const from = startedWords
    startedWords = null
    report.started(null)
    report.line((now) => (now.kind === 'idle' ? { kind: 'started', from } : now))
  }

  /**
   * Words on the page that the server may not hold, for the leave question. The save sent only to learn who changed the
   * letter, and the read made after its 409 (`forcing`), carry none of the person's, so neither counts.
   */
  const unsaved = () => ready && (stopped || (inFlight && !forcing) || pause !== undefined || !same(trimmed(current), stored))

  /** The question a link of the site asks before it takes the page away from words not saved. */
  const leaveQuestion = () =>
    stopped
      ? 'Leave this page? Your words on it are not saved, and leaving loses them. Copy anything you want to keep first.'
      : 'Leave this page? Your latest words may not be saved.'

  /**
   * Watches the page being left. Leaving the site, closing the tab or reloading: the browser asks its own question
   * while words are not saved, and the save goes as a request that outlives the page, held to the version the page
   * knows, so if a save on the way lands first this one is refused and writes nothing; the pause is stopped, so nothing
   * goes off later with a version that save may have moved. A page the browser kept and brings back by Back or Forward
   * reads the letter again when it sent a save as it went, to learn that save's version, and goes on from there.
   * Leaving within the site, where the page's code stays loaded: a press on a link asks first while words are not
   * saved, and once the page has gone the save goes at once, or once the save on the way has answered.
   */
  function watchLeaving(): () => void {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsaved()) return
      event.preventDefault()
      event.returnValue = ''
    }
    // A link to another of the site's pages takes this one away with no question of the browser's, and the site's router
    // can hold no move back, so the press is caught on its way down, before the link acts on it. A link the router
    // follows does nothing once its press is marked handled. Left alone: a link that opens elsewhere, one to another
    // site (the browser asks then), one to this same page, and one inside the letter, which the browser does not follow.
    const onLinkPress = (event: MouseEvent) => {
      if (!unsaved() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || link.closest('[contenteditable="true"]')) return
      if ((link.target !== '' && link.target !== '_self') || link.origin !== window.location.origin) return
      if (link.pathname === window.location.pathname && link.search === window.location.search) return
      if (!window.confirm(leaveQuestion())) event.preventDefault()
    }
    const onPageHide = () => {
      stopPause()
      if (!ready || stopped || !headers) return
      const sent = trimmed(current)
      if (same(sent, stored) || refusedAgain(sent)) return
      const body = { id, version, ...sent }
      if (new TextEncoder().encode(JSON.stringify(body)).byteLength > KEEPALIVE_MAX_BYTES) return
      unanswered.push(sent)
      saveNewsletterIssue(body, { headers: headers.value, keepalive: true }).catch(() => {})
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !ready || stopped) return
      keepHeaders()
      // A save on the way when the page went answers by itself, and a 409 for the save sent as the page went is checked then;
      // the words typed after it wait for that answer, as words typed while a save is on the way always do.
      if (inFlight) {
        wanted = true
        return
      }
      if (unanswered.length > 0) check(null)
      else if (!same(trimmed(current), stored)) startSave()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('click', onLinkPress, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('click', onLinkPress, true)
      stopPause()
      if (!ready || stopped) return
      if (inFlight) wanted = true
      else startSave()
    }
  }

  return { read, edit, startSave, showTheirs, reload, watchLeaving, saveFirst, start, sendTest, sayStarted }
}

/**
 * The page's letter. `enabled` is false for anyone the server would refuse, a media manager with no second factor
 * among them, so no call is made that would be refused.
 */
export function useIssue(enabled: boolean): Issue {
  const [status, setStatus] = useState<Issue['status']>('loading')
  const [loadError, setLoadError] = useState('')
  const [letter, setLetter] = useState<LetterDraft>(EMPTY)
  const [letterKey, setLetterKey] = useState(0)
  const [state, setState] = useState<Issue['state']>('none')
  const [line, setLine] = useState<SaveLine>({ kind: 'idle' })
  const [startedFrom, setStartedFrom] = useState<string | null>(null)
  const [keeper] = useState(() =>
    createKeeper({
      letter: (draft) => {
        setLetter(draft)
        setLetterKey((key) => key + 1)
      },
      state: setState,
      line: setLine,
      status: (next, error) => {
        setStatus(next)
        setLoadError(error)
      },
      started: setStartedFrom,
    }),
  )

  useEffect(() => (enabled ? keeper.read() : undefined), [enabled, keeper])
  useEffect(() => (enabled ? keeper.watchLeaving() : undefined), [enabled, keeper])

  return {
    status, loadError, letter, letterKey, state, line,
    edit: keeper.edit, saveNow: keeper.startSave, showTheirs: keeper.showTheirs, reload: keeper.reload,
    saveFirst: keeper.saveFirst, start: keeper.start, sendTest: keeper.sendTest, startedFrom, sayStarted: keeper.sayStarted,
  }
}
