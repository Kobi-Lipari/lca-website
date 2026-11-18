// src/areas/clubs/approval.ts
//
// What the approval wait's panel (components/ApprovalWait.tsx, WS09 step 19)
// keeps outside its component: the browser's memory that the panel's Help
// has opened by itself once, under its own key, as My region's Help and the
// club editor's Help keep theirs (region.ts and editor.ts).

/** The id of the part the wait's Help opens, which its button controls. */
export const WAIT_HELP_ID = 'approval-wait-help'

/** The one key the wait's panel keeps in the browser: that its Help has opened by itself once. */
export const WAIT_HELP_SHOWN_KEY = 'lca-approval-wait-help'

/**
 * Whether the wait's Help has opened by itself in this browser before. As
 * My region's Help reads its own key, a browser whose storage cannot be read
 * at all reads as yes, so Help opens from its button alone there.
 */
export function waitHelpShownBefore(): boolean {
  try {
    return window.localStorage.getItem(WAIT_HELP_SHOWN_KEY) !== null
  } catch {
    return true
  }
}

export function rememberWaitHelpShown(): void {
  try {
    window.localStorage.setItem(WAIT_HELP_SHOWN_KEY, 'shown')
  } catch {
    // Nothing is kept: where storage can still be read, Help opens by itself on the next visit too.
  }
}
