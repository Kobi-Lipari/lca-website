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
import { defaultSubject, monthLabel } from '@domain/mail/letter'
import { getNewsletterIssue, saveNewsletterIssue, type ApiNewsletterIssue, type ApiNewsletterIssueRefused } from '@/lib/api'
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
}

/** The pause after the last change before a save, about two seconds. */
export const SAVE_PAUSE_MS = 2000

/** A save sent as the page goes must be small enough for a request that outlives the page; a longer one is left to the leave question. */
const KEEPALIVE_MAX_BYTES = 60000

/** How long the sign-in headers kept for a save as the page goes are trusted before they are read again. */
const HEADERS_FRESH_MS = 60000

const EMPTY: LetterDraft = { monthLabel: '', subject: '', preheader: '', bodyHtml: '' }

/** A body with nothing in it, as the editor writes an empty letter. */
const bodyOf = (html: string) => (html === '<p></p>' ? '' : html)

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

  const lastSave = (): SaveLine => (savedAt ? { kind: 'saved', at: savedAt } : { kind: 'idle' })
  /** A line that says a save failed goes back to the last save once there is nothing left to save. */
  const settled = (now: SaveLine): SaveLine => (now.kind === 'failed' || now.kind === 'refused' ? lastSave() : now)

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

  /** Puts a letter the server answered on the page, in place of what was there. */
  function accept(answer: ApiNewsletterIssue) {
    const issue = answer.issue
    const draft: LetterDraft = issue ? wordsOf(issue) : blankLetter(Date.now())
    stopPause()
    id = issue ? issue.id : null
    version = issue ? issue.version : 0
    current = draft
    stored = draft
    savedAt = issue ? answer.lastSavedAt : null
    ready = true
    wanted = false
    stopped = false
    unanswered = []
    refused = null
    era += 1
    report.letter(draft)
    report.state(issue ? 'draft' : 'none')
    report.line(lastSave())
    report.status('ready', '')
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
   * again: the line then says that refusal.
   */
  function startSave() {
    stopPause()
    if (!ready || stopped) return
    if (inFlight) {
      wanted = true
      return
    }
    wanted = false
    const sent = trimmed(current)
    if (same(sent, stored)) {
      report.line(settled)
      return
    }
    if (refused && same(sent, refused.draft)) {
      report.line({ kind: 'refused', words: refused.words })
      return
    }
    inFlight = true
    report.line({ kind: 'saving' })
    saveNewsletterIssue({ id, version, ...sent }).then(
      (answer) => {
        if ('refused' in answer) {
          // A letter written since the version the page knows may be one of the page's own saves it never heard back about.
          if (answer.refused.reason === 'changed' && unanswered.length > 0) {
            check(answer.refused)
            return
          }
          inFlight = false
          refuse(answer.refused)
          return
        }
        inFlight = false
        // What was sent is what the page holds; the cleaner's own form, when it differs, is the server's to keep. A save
        // at the version the page knew means none of its unanswered saves was stored after it, so none is left to wonder about.
        id = answer.saved.id
        version = answer.saved.version
        stored = sent
        savedAt = answer.saved.savedAt
        unanswered = []
        refused = null
        report.state('draft')
        report.line({ kind: 'saved', at: answer.saved.savedAt })
        // Words typed while it was on the way: at once if a save was asked for meanwhile, else after their own pause.
        if (wanted) startSave()
      },
      (error: unknown) => {
        inFlight = false
        wanted = false
        const words = error instanceof ApiError && (error.status === 400 || error.status === 413) ? error.message : ''
        // A 400 or a 413 wrote nothing, and its words are kept from being sent again by the page itself; any other
        // failure may have been stored with no answer reaching the page.
        if (words) refused = { draft: sent, words }
        else unanswered.push(sent)
        report.line(words ? { kind: 'refused', words } : { kind: 'failed' })
      },
    )
  }

  /** A newer letter, in words: nothing more is saved over it until the person shows it. */
  function refuse(refusal: ApiNewsletterIssueRefused) {
    stopped = true
    wanted = false
    report.line({ kind: 'conflict', reason: refusal.reason, by: refusal.changedBy, at: refusal.changedAt, readFailures: 0 })
  }

  /**
   * Reads the letter again, as one save on the way, to learn whether a newer letter is one of this page's own saves it
   * never heard back about. If its words are words this page sent, it is: the page takes its id, version and time as
   * stored and goes on saving its own words, saying nothing. Otherwise `refusal`, when a save was refused, is shown,
   * naming the writer and time of the letter read when it is the page's own letter, since someone may have saved it
   * after the refusal; with none, as a page brought back by Back or Forward has, the next save meets the newer letter
   * and is refused in words.
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
        if (at !== era || stopped) return
        const issue = answer.issue
        const theirs = issue && (id === null || issue.id === id) ? wordsOf(issue) : null
        if (issue && theirs && unanswered.some((words) => same(words, theirs))) {
          id = issue.id
          version = issue.version
          stored = trimmed(theirs)
          savedAt = answer.lastSavedAt
          unanswered = []
          report.state('draft')
          report.line(lastSave())
          goOn()
          return
        }
        if (refusal) refuse(issue && issue.id === id ? { ...refusal, changedBy: answer.lastSavedBy, changedAt: answer.lastSavedAt ?? refusal.changedAt } : refusal)
        else goOn()
      },
      () => {
        inFlight = false
        if (at !== era || stopped) return
        if (refusal) refuse(refusal)
        else goOn()
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

  /** Words on the page that the server may not hold. */
  const unsaved = () => ready && (stopped || inFlight || pause !== undefined || !same(trimmed(current), stored))

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

  return { read, edit, startSave, showTheirs, reload, watchLeaving }
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
    }),
  )

  useEffect(() => (enabled ? keeper.read() : undefined), [enabled, keeper])
  useEffect(() => (enabled ? keeper.watchLeaving() : undefined), [enabled, keeper])

  return {
    status, loadError, letter, letterKey, state, line,
    edit: keeper.edit, saveNow: keeper.startSave, showTheirs: keeper.showTheirs, reload: keeper.reload,
  }
}
