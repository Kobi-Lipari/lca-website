// src/areas/admin/newsletter/SendQuestion.tsx
//
// The one plain question before the newsletter goes to the list (WS16 part two, page step 6, the send half), asked
// from the bar's Send and the email's sheet once the page's own Send is switched on (mailPageSend): "Send to 155
// people?", in the form of the chooser's "Replace this letter?" (TemplateChooser.tsx). An alert dialog over the page,
// the focus on "Not now" as it opens, Escape meaning "Not now", a press outside doing nothing, the site's root inert
// while it is open. While the send is posted its Send reads "Sending..." and neither answer can be pressed again.
// "Stop sending" asks "Stop the newsletter?" in the same form, with its own words passed in.

import { useLayoutEffect, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

/** The site's root, made inert while the question is open, as the chooser, Help and the email's sheet make it. */
const SITE_ROOT_ID = 'root'

/** What the question is asked about: the count read just now, and the letter's subject. */
export interface SendAsking {
  willGet: number
  subject: string
}

export interface SendQuestionProps {
  /** The question open, or null while it is closed. */
  asking: SendAsking | null
  /** The send posted and not yet answered. */
  posting: boolean
  /** "Send" gives true, "Not now" or Escape false. */
  onAnswer: (send: boolean) => void
  /** Where the focus goes as it closes: the control that opened it while it is still drawn, else the bar's Send. */
  returnTo: () => HTMLElement | null
  /** Stop's question in the same form: its own title, description and answers. Left out, it is Send's question. */
  words?: SendQuestionWords
}

/** The words of a question asked in this form, for one other than Send's own (Stop's). */
export interface SendQuestionWords {
  title: string
  description: string
  no: string
  yes: string
}

/** Holds the site's root inert while it is drawn; a root made inert by something else is left as it is. */
function HoldRootInert() {
  useLayoutEffect(() => {
    const root = document.getElementById(SITE_ROOT_ID)
    if (!root || root.hasAttribute('inert')) return
    root.setAttribute('inert', '')
    return () => root.removeAttribute('inert')
  }, [])
  return null
}

export function SendQuestion({ asking, posting, onAnswer, returnTo, words }: SendQuestionProps) {
  const notNow = useRef<HTMLButtonElement>(null)
  const people = asking ? `${asking.willGet.toLocaleString('en-US')} ${asking.willGet === 1 ? 'person' : 'people'}` : ''
  const said: SendQuestionWords = words ?? {
    title: `Send to ${people}?`,
    description: `“${asking?.subject ?? ''}” goes to the LCA newsletter list. A sent newsletter cannot be taken back.`,
    no: 'Not now',
    yes: 'Send',
  }
  return (
    <DialogPrimitive.Root
      open={asking !== null}
      onOpenChange={(next) => {
        if (!next && !posting) onAnswer(false)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="send-scrim"
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-brand-navy/55 px-4 pb-3 pt-[calc(var(--header-h,4rem)+0.75rem)]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) event.preventDefault()
          }}
        >
          <HoldRootInert />
          <DialogPrimitive.Content
            role="alertdialog"
            aria-modal="true"
            data-slot="send-question"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              notNow.current?.focus()
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const to = returnTo()
              if (to?.isConnected) to.focus()
            }}
            onEscapeKeyDown={(event) => {
              if (posting) event.preventDefault()
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onFocus={(event) => {
              // As in the chooser's question: Tab going round gives the focus without the browser's scroll, where the dim scrolls.
              if (event.target !== event.currentTarget) event.target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
            }}
            className="my-auto w-[min(28rem,100%)] rounded-xl border border-border bg-background p-5 text-ink shadow-xl outline-none"
          >
            <DialogPrimitive.Title className="text-lg font-bold">{said.title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-[15px] text-ink [overflow-wrap:anywhere]">
              {said.description}
            </DialogPrimitive.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                ref={notNow}
                type="button"
                aria-disabled={posting || undefined}
                onClick={() => {
                  if (!posting) onAnswer(false)
                }}
                className="inline-flex min-h-12 md:min-h-11 items-center rounded-lg border border-muted-foreground bg-background px-4 text-[15px] font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
              >
                {said.no}
              </button>
              <button
                type="button"
                aria-disabled={posting || undefined}
                onClick={() => {
                  if (!posting) onAnswer(true)
                }}
                // A border of no colour, as the site's own buttons have, so forced colours frames it as it frames Not now.
                className="inline-flex min-h-12 md:min-h-11 items-center rounded-lg border border-transparent bg-brand-navy px-4 text-[15px] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-focus"
              >
                {posting ? 'Sending...' : said.yes}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
