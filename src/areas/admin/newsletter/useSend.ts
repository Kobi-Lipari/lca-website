// src/areas/admin/newsletter/useSend.ts
//
// The newsletter page's count and the state of its own Send (WS16 part two,
// page step 6), from the read Group email's newsletter tab makes, GET
// /api/admin/mail/newsletter.
//
// - With mailPageSend off: the count is read once as the page opens and never
//   again, as the page has always read it, and the state is 'off'.
// - With it on: the hook keeps the service the newsletter goes through, the
//   send that is on its way if there is one, why it waits, and the count. It
//   reads again every 3 seconds only while a newsletter is sending, or a
//   send's start is not yet read, and stops when the page is left.
// - The state comes from that read: 'waits' while the newsletter goes through
//   Resend, 'unknown' while no read has answered, 'sending' while one is on
//   its way, else 'ready'. While the press is at work the page sets a state
//   of its own ('preparing', 'asking', 'posting', 'started', 'stopping'),
//   which wins. 'started' holds from a send's answer until a read of the
//   count answers (every 3 seconds while one fails), so the next control
//   drawn in Send's place is Stop sending.
// - The line it says (`said`) is set only when a send this page saw sending
//   ends (or one it started has ended by the first read that answers), when a send starts to wait or waits for a new reason, after a stop,
//   and when the page asks (a start, a refusal). A read in between never sets
//   it, so a screen reader hears each line once. A line carries a number that
//   grows, and `fresh` until the page has said it.
import { useCallback, useEffect, useRef, useState } from 'react'
import { FEATURES } from '@/lib/features'
import { getNewsletter, type ApiNewsletter } from '@/lib/api'
import type { BarSaid } from './FootBar'
import type { ReachRead } from './MoreOptions'

/** One of the newsletter's last sends, as the tab's read gives it. */
export type NewsletterRow = ApiNewsletter['summary']['recent'][number]

/** What the press is doing while it is at work, which the page sets and clears. */
export type SendLocal = 'preparing' | 'asking' | 'posting' | 'started' | 'stopping'

export type SendState = 'off' | 'waits' | 'unknown' | 'ready' | 'sending' | SendLocal

/** A line for the bar's status line: said once while `fresh`, then marked said. */
export interface SendSaid {
  seq: number
  words: string
  tone: BarSaid['tone']
  fresh: boolean
}

export interface NewsletterSend {
  state: SendState
  /** The count for the count card, Send and More options. */
  reach: ReachRead
  /** The service the newsletter goes through, or null until a read answers. */
  sendsThrough: string | null
  /** The send on its way, or null. */
  sending: NewsletterRow | null
  /** Why the send on its way waits, in the server's words, or null. */
  waits: string | null
  willGet: number | null
  said: SendSaid | null
  setLocal: (local: SendLocal | null) => void
  /** Reads the tab again and keeps what it gives; null when the read fails, which keeps the last one. */
  reread: () => Promise<ApiNewsletter | null>
  /** Puts a line of the page's own on the bar. */
  say: (words: string, tone: BarSaid['tone']) => void
  /** Marks the line said, so a letter drawn afresh does not say it again. */
  markSaid: () => void
  /** After Stop has answered: reads again and says how many were sent, with no end line after it. */
  afterStop: () => Promise<void>
  /**
   * After a send has answered: the first read that answers says how it ended when it shows no send on its way and a
   * row this matches, since a short list can end before any read sees it sending.
   */
  started: (isThisSend: (row: NewsletterRow) => boolean) => void
}

const count = (n: number) => n.toLocaleString('en-US')

/**
 * "Sent to 155 people.", "Sent to 1 person.", or "Sent to 150 of 155 people." for a send that ended short. A send that
 * reached nobody says it could not be sent and what to do, as the page's Send does for a refusal with no words.
 */
export function sentWords(row: Pick<NewsletterRow, 'sentCount' | 'totalRecipients'>): string {
  if (row.sentCount === 0 && row.totalRecipients > 0) return 'The newsletter could not be sent. Try again in a moment.'
  if (row.sentCount === row.totalRecipients) return `Sent to ${count(row.totalRecipients)} ${row.totalRecipients === 1 ? 'person' : 'people'}.`
  return `Sent to ${count(row.sentCount)} of ${count(row.totalRecipients)} ${row.totalRecipients === 1 ? 'person' : 'people'}.`
}

/** "Stopped. 40 of 155 were sent." */
export function stoppedWords(row: Pick<NewsletterRow, 'sentCount' | 'totalRecipients'>): string {
  return `Stopped. ${count(row.sentCount)} of ${count(row.totalRecipients)} were sent.`
}

/** "“<subject>” is waiting. <the server's words>" */
export function waitingWords(subject: string, waits: string): string {
  return `“${subject}” is waiting. ${waits}`
}

const POLL_MS = 3000

const reachOf = ({ summary }: ApiNewsletter) => ({ willGet: summary.willGet, addresses: summary.addresses, turnedOff: summary.turnedOff, stoppedAll: summary.stoppedAll, doNotSend: summary.doNotSend })
const sendingIn = (answer: ApiNewsletter) => answer.summary.recent.find((r) => r.status === 'sending') ?? null

export function useNewsletterSend(mayCall: boolean): NewsletterSend {
  const on = FEATURES.mailPageSend
  const [reach, setReach] = useState<ReachRead>(null)
  const [read, setRead] = useState<ApiNewsletter | null>(null)
  const [local, setLocal] = useState<SendLocal | null>(null)
  const [said, setSaid] = useState<SendSaid | null>(null)
  const gone = useRef(false)
  // The send this page saw on its way, and what it last said waited: a line is said only when either moves.
  const seen = useRef<string | null>(null)
  const waited = useRef<string | null>(null)
  // A send this page stopped, which says its own line and no end line; and one whose stop line is still to be said,
  // when the read just after the stop failed.
  const stopped = useRef<string | null>(null)
  const stopOwed = useRef<string | null>(null)
  // A send this page started, until a read answers: a short list can end before any read sees it sending.
  const startOwed = useRef<((row: NewsletterRow) => boolean) | null>(null)
  const seq = useRef(0)

  const say = useCallback((words: string, tone: BarSaid['tone']) => {
    seq.current += 1
    setSaid({ seq: seq.current, words, tone, fresh: true })
  }, [])

  const take = useCallback(
    (answer: ApiNewsletter, first: boolean) => {
      setRead(answer)
      setReach(reachOf(answer))
      const now = sendingIn(answer)
      const before = seen.current
      if (before && now?.id !== before) {
        const ended = answer.summary.recent.find((r) => r.id === before)
        if (ended && stopped.current !== before) say(sentWords(ended), ended.sentCount > 0 ? 'sent' : 'not-sent')
        else if (ended && stopOwed.current === before) {
          stopOwed.current = null
          say(stoppedWords(ended), 'note')
        }
      }
      const owed = startOwed.current
      startOwed.current = null
      const endedFirst = owed && !now ? answer.summary.recent.find(owed) : undefined
      if (endedFirst) say(sentWords(endedFirst), endedFirst.sentCount > 0 ? 'sent' : 'not-sent')
      seen.current = now?.id ?? null
      const waits = now ? answer.summary.waits : null
      if (!first && now && waits && waits !== waited.current) say(waitingWords(now.subject, waits), 'note')
      waited.current = waits
    },
    [say],
  )

  const reread = useCallback(async () => {
    try {
      const answer = await getNewsletter()
      if (!gone.current) take(answer, false)
      return answer
    } catch {
      return null
    }
  }, [take])

  // The read as the page opens. With the switch off it is the only one, exactly as before.
  useEffect(() => {
    gone.current = false
    if (!mayCall) return
    getNewsletter().then(
      (answer) => {
        if (gone.current) return
        if (on) take(answer, true)
        else setReach(reachOf(answer))
      },
      () => {
        if (!gone.current) setReach('failed')
      },
    )
    return () => {
      gone.current = true
    }
  }, [mayCall, on, take])

  const sending = on && read ? sendingIn(read) : null
  // Also while 'started' holds: when the read just after a send's answer fails, the next read that answers ends it.
  const polling = on && mayCall && (sending !== null || local === 'started')
  useEffect(() => {
    if (!polling) return
    const timer = setInterval(() => {
      void reread().then((answer) => {
        if (answer) setLocal((now) => (now === 'started' ? null : now))
      })
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [polling, reread])

  const afterStop = useCallback(async () => {
    const id = seen.current
    stopped.current = id
    stopOwed.current = id
    const answer = await reread()
    const row = answer?.summary.recent.find((r) => r.id === id)
    // A stop the person chose is no failure: said as a note, with no alert mark. When the read fails, or the read's
    // own take has said it already, the next read that shows the send closed says it instead.
    if (row && stopOwed.current === id) {
      stopOwed.current = null
      say(stoppedWords(row), 'note')
    }
  }, [reread, say])

  const markSaid = useCallback(() => setSaid((line) => (line && line.fresh ? { ...line, fresh: false } : line)), [])
  const started = useCallback((isThisSend: (row: NewsletterRow) => boolean) => {
    startOwed.current = isThisSend
  }, [])

  const state: SendState = !on
    ? 'off'
    : local ?? (read?.sendsThrough === 'resend' ? 'waits' : read === null ? 'unknown' : sending ? 'sending' : 'ready')

  return {
    state,
    reach,
    sendsThrough: on ? (read?.sendsThrough ?? null) : null,
    sending,
    waits: on && sending ? (read?.summary.waits ?? null) : null,
    willGet: on && read ? read.summary.willGet : null,
    said,
    setLocal,
    reread,
    say,
    markSaid,
    afterStop,
    started,
  }
}
