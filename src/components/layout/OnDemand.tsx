// src/components/layout/OnDemand.tsx
//
// The new chrome's bars fetch two parts the first time a person asks for
// them, rather than with the header every page loads: the donation dialog,
// on the first press of Donate, and the Menu sheet, on the first press of
// Menu. This boundary, the bars' own, holds each while its code arrives and
// catches it if the code cannot be had, as when a tab left open across a
// deploy asks for a file the deploy took away and the one reload the site
// allows a tab (src/lib/reloadOnStaleChunk.ts) has been used. The rest of
// the page is untouched: the error screen of src/components/errors/
// ErrorBoundary.tsx, which wraps the whole app, never shows for it.
//
// What failed is closed by the bar (onFailed), so nothing waits on it, and
// a short notice in plain words takes its place just under the bar, on a
// light surface of its own, until its one button puts it away. The notice
// follows the bar's row in the header, past the bar's own height, so the
// bar keeps its height and a second notice, should both parts fail, sits
// under the first rather than over it. The site keeps a failed fetch's
// answer for the page's life, so asking for the part again (tries counts
// each time) shows the notice again rather than a second failure;
// reloading the page fetches the files again.
//
// The focus is never left with nothing to hold it, which would send the
// next Tab back to the start of the page. The control that asked for the
// part keeps it while the notice shows; when that control has gone, as the
// sheet's Donate goes with the sheet, the focus goes to the control the bar
// names (returnFocus), the Menu button that opened the sheet; and putting
// the notice away gives the focus to that same control.
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { focusIsHeld } from '@/components/layout/headerParts'

interface OnDemandProps {
  /** The notice's words, naming what could not be loaded. */
  notice: string
  /** Closes the dialog or the sheet that was being opened. */
  onFailed: () => void
  /**
   * The control the focus goes to once the notice is put away, or once the
   * part has failed when the control that asked for it has gone: Donate for
   * a press of Donate, and the Menu button when the ask came from the sheet.
   */
  returnFocus?: () => HTMLElement | null
  /** How many times the part has been asked for; each new ask tries again. */
  tries: number
  children: ReactNode
}

interface OnDemandState {
  failed: boolean
  /** The notice was put away. */
  dismissed: boolean
  /** The ask the state belongs to. */
  tries: number
}

export class OnDemand extends Component<OnDemandProps, OnDemandState> {
  state: OnDemandState = { failed: false, dismissed: false, tries: this.props.tries }

  static getDerivedStateFromProps(props: OnDemandProps, state: OnDemandState): Partial<OnDemandState> | null {
    // A new ask after a failure tries again, and its failure shows the notice again.
    return props.tries !== state.tries ? { failed: false, dismissed: false, tries: props.tries } : null
  }

  static getDerivedStateFromError(): Partial<OnDemandState> {
    return { failed: true, dismissed: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A part of the header could not be loaded:', error, info)
    this.props.onFailed()
    // The control that asked keeps the focus; if it has gone, nothing in the
    // page holds the focus, so it goes to the control the bar names.
    if (!focusIsHeld()) this.giveFocusBack()
  }

  /** Puts the focus on the control the bar names, without scrolling the page under the bar fixed to the window's top. */
  giveFocusBack() {
    const to = this.props.returnFocus?.()
    if (to?.isConnected) to.focus({ preventScroll: true })
  }

  render() {
    if (!this.state.failed) return <Suspense fallback={null}>{this.props.children}</Suspense>
    if (this.state.dismissed) return null
    return (
      <div
        role="alert"
        data-slot="on-demand-notice"
        data-ring-ground="light"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hairline bg-raised px-4 py-2 text-sm text-ink shadow-md"
      >
        <p>{this.props.notice}</p>
        <button
          type="button"
          onClick={() => {
            // The notice and this button go; the focus goes back to the control that asked for the part.
            this.setState({ dismissed: true })
            this.giveFocusBack()
          }}
          className="inline-flex min-h-11 items-center px-2 font-semibold underline-offset-4 hover:underline"
        >
          Dismiss
        </button>
      </div>
    )
  }
}
